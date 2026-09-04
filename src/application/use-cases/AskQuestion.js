const { reciprocalRankFusion } = require('../retrieval/hybridFusion');
const { buildPrompt } = require('../retrieval/buildPrompt');

const REFUSAL_TEXT = 'Not enough information in the corpus to answer this question.';

class AskQuestion {
  constructor(vectorSearchRepository, llmProvider) {
    this.vectorSearchRepository = vectorSearchRepository;
    this.llmProvider = llmProvider;
  }

  async run(question, topK = 5) {
    const { embedding, providerUsed: embedProvider } = await this.llmProvider.embed(question);
    

    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearchRepository.searchByVector(embedding, topK),
      this.vectorSearchRepository.searchByKeyword(question, topK),
    ]);

    const fusedResults = reciprocalRankFusion(vectorResults, keywordResults).slice(0, topK);

    if (fusedResults.length === 0) {
      return {
        answer: REFUSAL_TEXT,
        citations: [],
        providerUsed: embedProvider,
      };
    }

    const prompt = buildPrompt(question, fusedResults);
    console.log('--- PROMPT SENT TO LLM ---\n', prompt, '\n--- END PROMPT ---');
    const { text: answer, providerUsed: completionProvider } = await this.llmProvider.complete(prompt);

    const citations = fusedResults.map((chunk, i) => ({
      sourceIndex: i + 1,
      documentTitle: chunk.title,
      manualVersion: chunk.manual_version,
      section: chunk.section,
      chunkId: chunk.id,
    }));

    return {
      answer,
      citations,
      isRefusal: answer.trim() === REFUSAL_TEXT,
      providerUsed: completionProvider,
    };
  }
}

module.exports = AskQuestion;