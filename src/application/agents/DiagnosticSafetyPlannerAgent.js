const { DiagnosticSafetyPlannerInput, DiagnosticSafetyPlannerOutput } = require('../contracts/agentSchemas');
const { buildPrompt } = require('../retrieval/buildPrompt');

/**
 * Diagnostic Safety Planner Agent
 * 
 * Responsible for retrieving and structuring diagnostic steps and safety prerequisites
 * for a given equipment symptom. Enforces strict safety content requirements.
 */
class DiagnosticSafetyPlannerAgent {
  /**
   * @param {Object} vectorSearchRepository - Repository for vector/keyword search
   * @param {Object} llmProvider - LLM provider with embed/complete methods
   * @param {Object} options - Configuration options
   * @param {number} options.maxFormatAttempts - Max retries for LLM formatting (default: 2)
   * @param {number} options.timeoutMs - Timeout for LLM calls in ms (default: 30000)
   * @param {number} options.topK - Number of results to retrieve (default: 10)
   */
  constructor(vectorSearchRepository, llmProvider, options = {}) {
    this.vectorSearchRepository = vectorSearchRepository;
    this.llmProvider = llmProvider;
    this.maxFormatAttempts = options.maxFormatAttempts || 2;
    this.timeoutMs = options.timeoutMs || 30000;
    this.topK = options.topK || 10;
    this.embeddingCache = new Map();
  }

  /**
   * Main execution method
   * @param {Object} rawInput - Raw input data
   * @returns {Promise<Object>} Structured output with diagnostic steps and safety prerequisites
   */
  async run(rawInput) {
    // Parse and validate input
    const input = DiagnosticSafetyPlannerInput.parse(rawInput);
    this.validateInput(input);

    // Get embedding with caching
    const embedding = await this.getCachedEmbedding(input.symptomDescription);

    // Handle version filtering
    const versionFilter = this.getVersionFilter(input.manualVersion);

    // Perform parallel retrieval
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearchRepository.searchByVector(embedding, {
        limit: this.topK,
        manualVersion: versionFilter,
      }),
      this.vectorSearchRepository.searchByKeyword(input.symptomDescription, {
        limit: this.topK,
        manualVersion: versionFilter,
      }),
    ]);

    // Merge and deduplicate results
    const uniqueChunks = this.mergeAndDeduplicateResults(vectorResults, keywordResults);

    // Categorize chunks by section type
    const { diagnosticChunks, safetyChunks } = this.categorizeChunks(uniqueChunks);

    // Enforce safety content requirement
    this.ensureSafetyContentExists(safetyChunks, input);

    // Warn if diagnostic content is missing (but don't fail)
    if (diagnosticChunks.length === 0) {
      console.warn(
        `No diagnostic sections found for ${input.equipmentId} (${input.manualVersion}). Proceeding with safety-only content.`
      );
    }

    // Build prompt and get LLM response
    const relevantChunks = [...diagnosticChunks, ...safetyChunks];
    const response = await this.getLLMResponse(input, relevantChunks);

    // Extract and validate lists
    const { diagnosticSteps, safetyPrerequisites } = this.extractListsFromResponse(
      response,
      input
    );

    // Structure and validate output
    const output = {
      diagnosticSteps,
      safetyPrerequisites,
      sourceChunkIds: uniqueChunks.map((c) => c.id),
      metadata: {
        equipmentId: input.equipmentId,
        manualVersion: input.manualVersion,
        totalChunksRetrieved: uniqueChunks.length,
        safetyChunksFound: safetyChunks.length,
        diagnosticChunksFound: diagnosticChunks.length,
      },
    };

    // Attach LLM usage metadata after Zod parse (Zod strips unknown keys during
    // parse, so we use Object.assign to add observability fields without touching
    // the contract schema in agentSchemas.js).
    const parsed = DiagnosticSafetyPlannerOutput.parse(output);
    return Object.assign(parsed, {
      tokensUsed: this._lastTokensUsed ?? 0,
      cost: this._lastCost ?? 0,
    });
  }

  /**
   * Validate input fields
   * @param {Object} input - Parsed input
   * @throws {Error} If validation fails
   */
  validateInput(input) {
    if (!input.symptomDescription || input.symptomDescription.trim().length === 0) {
      throw new Error('Symptom description is required and cannot be empty');
    }

    if (!input.equipmentId || input.equipmentId.trim().length === 0) {
      throw new Error('Equipment ID is required');
    }
  }

  /**
   * Get version filter with proper handling of 'unknown' value
   * @param {string} manualVersion - Manual version string
   * @returns {string|undefined} Filter value or undefined
   */
  getVersionFilter(manualVersion) {
    // 'unknown' means the source document had no version marker
    // Filtering by literal 'unknown' would never match NULL values in DB
    return manualVersion !== 'unknown' ? manualVersion : undefined;
  }

  /**
   * Get cached embedding to avoid redundant API calls
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async getCachedEmbedding(text) {
    // Use first 100 chars as cache key (good enough for deduplication)
    const cacheKey = text.toLowerCase().trim().slice(0, 100);
    
    if (!this.embeddingCache.has(cacheKey)) {
      const { embedding } = await this.llmProvider.embed(text);
      this.embeddingCache.set(cacheKey, embedding);
    }
    return this.embeddingCache.get(cacheKey);
  }

  /**
   * Merge and deduplicate results from vector and keyword search
   * @param {Array} vectorResults - Results from vector search
   * @param {Array} keywordResults - Results from keyword search
   * @returns {Array} Deduplicated results
   */
  mergeAndDeduplicateResults(vectorResults, keywordResults) {
    const allResults = [...vectorResults, ...keywordResults];
    const uniqueById = new Map(allResults.map((r) => [r.id, r]));
    return [...uniqueById.values()];
  }

  /**
   * Categorize chunks by section type
   * @param {Array} chunks - Array of chunks
   * @returns {Object} Categorized chunks
   */
  categorizeChunks(chunks) {
    // More robust section detection with multiple patterns
    const isDiagnostic = (chunk) => {
      const section = chunk.section?.toLowerCase() || '';
      return /diagnostic|troubleshooting|fault|problem|issue|error/i.test(section);
    };

    const isSafety = (chunk) => {
      const section = chunk.section?.toLowerCase() || '';
      return /safety|warning|caution|precaution|danger|hazard|safe|protective/i.test(section);
    };

    return {
      diagnosticChunks: chunks.filter(isDiagnostic),
      safetyChunks: chunks.filter(isSafety),
    };
  }

  /**
   * Ensure safety content exists
   * @param {Array} safetyChunks - Safety chunks
   * @param {Object} input - Input data
   * @throws {Error} If no safety content found
   */
  ensureSafetyContentExists(safetyChunks, input) {
    if (safetyChunks.length === 0) {
      throw new Error(
        `No safety prerequisites section found for ${input.equipmentId} (${input.manualVersion}). ` +
        `Refusing to proceed without documented safety evidence.`
      );
    }
  }

  /**
   * Get LLM response with retry logic for formatting
   * @param {Object} input - Input data
   * @param {Array} relevantChunks - Relevant chunks for context
   * @returns {Promise<string>} LLM response text
   */
  async getLLMResponse(input, relevantChunks) {
    const basePrompt = buildPrompt(
      `List the diagnostic steps and safety prerequisites for ${input.equipmentId} given this symptom: "${input.symptomDescription}". ` +
      `Respond with two clearly labeled lists: "DIAGNOSTIC STEPS:" and "SAFETY PREREQUISITES:", one item per line, no extra commentary.`,
      relevantChunks
    );

    // Reset token/cost accumulators for this run
    this._lastTokensUsed = 0;
    this._lastCost = 0;

    let lastError = null;

    for (let attempt = 1; attempt <= this.maxFormatAttempts; attempt++) {
      try {
        const prompt = this.buildAttemptPrompt(basePrompt, attempt);
        const llmResult = await this.callLLMWithTimeout(prompt);
        const response = typeof llmResult === 'string' ? llmResult : llmResult.text;

        // Capture token/cost metadata from the provider result
        if (llmResult && typeof llmResult === 'object') {
          this._lastTokensUsed = (this._lastTokensUsed ?? 0) + (llmResult.tokensUsed ?? 0);
          this._lastCost = (this._lastCost ?? 0) + (llmResult.cost ?? 0);
        }

        if (typeof response !== 'string') {
          throw new Error('LLM provider returned no response text');
        }
        
        // Quick validation before returning
        const extracted = this.extractListSection(response, 'SAFETY PREREQUISITES:');
        if (extracted.length > 0) {
          return response;
        }
        
        // If we got here, safety section was missing but we have more attempts
        if (attempt < this.maxFormatAttempts) {
          console.warn(`Attempt ${attempt}: No safety section found, retrying...`);
        }
      } catch (error) {
        lastError = error;
        if (attempt === this.maxFormatAttempts) {
          throw new Error(`Failed to get LLM response after ${this.maxFormatAttempts} attempts: ${error.message}`);
        }
        // Continue to next attempt
      }
    }

    // If we exhausted attempts without success
    const fallbackResponse = this.buildGroundedFallbackResponse(relevantChunks);
    if (fallbackResponse) {
      console.warn('Model response was not structured; using retrieved safety and diagnostic content.');
      return fallbackResponse;
    }

    throw new Error(
      `Model did not produce any safety prerequisites for ${input.equipmentId} after ${this.maxFormatAttempts} attempts, ` +
      `even though a safety section was retrieved. Refusing to proceed.`
    );
  }

  /**
   * Build a deterministic response from retrieved evidence when the model
   * cannot satisfy the required list format.
   * @param {Array} relevantChunks - Retrieved diagnostic and safety chunks
   * @returns {string|null} Structured fallback response or null
   */
  buildGroundedFallbackResponse(relevantChunks) {
    const { diagnosticChunks, safetyChunks } = this.categorizeChunks(relevantChunks);
    if (diagnosticChunks.length === 0 || safetyChunks.length === 0) {
      return null;
    }

    const formatChunks = (chunks) => chunks
      .map((chunk) => chunk.content?.trim())
      .filter(Boolean)
      .map((content) => `- ${content}`)
      .join('\n');

    return `DIAGNOSTIC STEPS:\n${formatChunks(diagnosticChunks)}\n\n` +
      `SAFETY PREREQUISITES:\n${formatChunks(safetyChunks)}`;
  }

  /**
   * Build prompt for specific attempt
   * @param {string} basePrompt - Base prompt
   * @param {number} attempt - Attempt number
   * @returns {string} Enhanced prompt
   */
  buildAttemptPrompt(basePrompt, attempt) {
    if (attempt === 1) {
      return basePrompt;
    }

    // Add progressively stronger instructions
    const instructions = [
      '\n\nIMPORTANT: You MUST include a line that says exactly "SAFETY PREREQUISITES:" followed by one safety item per line. Do not skip this section.',
      '\n\nCRITICAL: Your response MUST contain both sections "DIAGNOSTIC STEPS:" and "SAFETY PREREQUISITES:". ' +
      'If you do not include BOTH sections, the system will reject your response.',
    ];

    return `${basePrompt}${instructions[attempt - 2] || instructions[0]}`;
  }

  /**
   * Call LLM with timeout
   * @param {string} prompt - Prompt to send
   * @returns {Promise<Object>} LLM response
   */
  async callLLMWithTimeout(prompt) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`LLM call timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
    });

    const llmPromise = this.llmProvider.complete(prompt);
    return Promise.race([llmPromise, timeoutPromise]);
  }

  /**
   * Extract lists from LLM response
   * @param {string} response - LLM response text
   * @param {Object} input - Input data
   * @returns {Object} Extracted diagnostic steps and safety prerequisites
   */
  extractListsFromResponse(response, input) {
    const diagnosticSteps = this.extractListSection(response, 'DIAGNOSTIC STEPS:');
    const safetyPrerequisites = this.extractListSection(response, 'SAFETY PREREQUISITES:');

    if (safetyPrerequisites.length === 0) {
      throw new Error(
        `Model did not produce any safety prerequisites for ${input.equipmentId} after ${this.maxFormatAttempts} attempts, ` +
        `even though a safety section was retrieved. Refusing to proceed.`
      );
    }

    return { diagnosticSteps, safetyPrerequisites };
  }

  /**
   * Extract list items from a labeled section
   * @param {string} text - Full response text
   * @param {string} label - Section label to extract
   * @returns {Array<string>} Extracted list items
   */
  extractListSection(text, label) {
    const labelText = label.replace(/:$/, '');
    const normalizeHeading = (line) => line
      .trim()
      .replace(/^#{1,3}\s*/, '')
      .replace(/^\*+|\*+$/g, '')
      .replace(/:\s*$/, '')
      .trim()
      .toLowerCase();
    const lines = text.split(/\r?\n/);
    const startIndex = lines.findIndex((line) => normalizeHeading(line) === labelText.toLowerCase());

    if (startIndex === -1) return [];

    const nextSectionIndex = lines.slice(startIndex + 1).findIndex((line) => {
      const heading = line.trim();
      return /^(?:#{1,3}\s*)?\*{0,2}[A-Z][A-Z\s/&-]*\*{0,2}\s*:?\s*$/.test(heading);
    });
    const endIndex = nextSectionIndex === -1
      ? lines.length
      : startIndex + 1 + nextSectionIndex;

    // Split by lines, clean up, and filter empty lines
    return lines
      .slice(startIndex + 1, endIndex)
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim()) // Remove bullets/numbers
      .filter((line) => line.length > 0);
  }

  /**
   * Clear embedding cache (useful for testing)
   */
  clearCache() {
    this.embeddingCache.clear();
  }
}

module.exports = DiagnosticSafetyPlannerAgent;