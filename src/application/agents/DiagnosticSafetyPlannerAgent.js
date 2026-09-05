const {
  DiagnosticSafetyPlannerInput,
  DiagnosticSafetyPlannerOutput,
} = require('../contracts/agentSchemas');
const { buildPrompt } = require('../retrieval/buildPrompt');

class DiagnosticSafetyPlannerAgent {
  constructor(vectorSearchRepository, llmProvider) {
    this.vectorSearchRepository = vectorSearchRepository;
    this.llmProvider = llmProvider;
  }

  async run(rawInput) {
    const input = DiagnosticSafetyPlannerInput.parse(rawInput);

    // Retrieval is scoped to the exact equipment + manual version
    // identified by SymptomMatcherAgent — using metadata filtering
    // (FR-2's retrieval enhancement) to avoid mixing in content from
    // a different manual version, which is D5's core risk.
    const { embedding } = await this.llmProvider.embed(input.symptomDescription);

    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearchRepository.searchByVector(embedding, {
        limit: 10,
        manualVersion: input.manualVersion,
      }),
      this.vectorSearchRepository.searchByKeyword(input.symptomDescription, {
        limit: 10,
        manualVersion: input.manualVersion,
      }),
    ]);

    // Merge without RRF here — we want ALL relevant sections (diagnostic +
    // safety), not just the top-K fused matches, since both section types
    // must be found for this agent's output to be valid.
    const allResults = [...vectorResults, ...keywordResults];
    const uniqueById = new Map(allResults.map((r) => [r.id, r]));

    const diagnosticChunks = [...uniqueById.values()].filter((r) =>
      /diagnostic/i.test(r.section)
    );
    const safetyChunks = [...uniqueById.values()].filter((r) =>
      /safety/i.test(r.section)
    );

    if (safetyChunks.length === 0) {
      // Structural enforcement, independent of what the LLM decides:
      // if no safety section was retrieved at all, we refuse to
      // proceed rather than let the model invent safety steps.
      throw new Error(
        `No safety prerequisites section found for ${input.equipmentId} (${input.manualVersion}). Refusing to proceed without documented safety evidence.`
      );
    }

    const relevantChunks = [...diagnosticChunks, ...safetyChunks];
    const prompt = buildPrompt(
      `List the diagnostic steps and safety prerequisites for ${input.equipmentId} given this symptom: "${input.symptomDescription}". Respond with two clearly labeled lists: "DIAGNOSTIC STEPS:" and "SAFETY PREREQUISITES:", one item per line, no extra commentary.`,
      relevantChunks
    );

    const { text: rawAnswer } = await this.llmProvider.complete(prompt);

    const diagnosticSteps = extractListSection(rawAnswer, 'DIAGNOSTIC STEPS:');
    const safetyPrerequisites = extractListSection(rawAnswer, 'SAFETY PREREQUISITES:');

    if (safetyPrerequisites.length === 0) {
      // Same structural rule enforced again at the output level, in case
      // the model failed to extract prerequisites even though a safety
      // chunk was retrieved (e.g. the AC-450 incomplete-safety-section case).
      throw new Error(
        `Model did not produce any safety prerequisites for ${input.equipmentId}, even though a safety section was retrieved. Refusing to proceed.`
      );
    }

    const output = {
      diagnosticSteps,
      safetyPrerequisites,
      sourceChunkIds: relevantChunks.map((c) => c.id),
    };

    return DiagnosticSafetyPlannerOutput.parse(output);
  }
}

function extractListSection(text, label) {
  const regex = new RegExp(`${label}\\s*([\\s\\S]*?)(?:\\n[A-Z ]+:|$)`, 'i');
  const match = text.match(regex);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((line) => line.length > 0);
}

module.exports = DiagnosticSafetyPlannerAgent;