const { reciprocalRankFusion } = require('../retrieval/hybridFusion');
const {
  SymptomMatcherInput,
  SymptomMatcherOutput,
} = require('../contracts/agentSchemas');
const LowConfidenceMatchError = require('../../domain/errors/LowConfidenceMatchError');

// Below this fusion-derived confidence, we refuse to guess the equipment —
// consistent with "grounded, never guessing" applied to D5's core risk
// (misidentifying equipment leads to wrong manual, wrong safety steps).
const MIN_CONFIDENCE_THRESHOLD = 0.3;

class SymptomMatcherAgent {
  constructor(vectorSearchRepository, llmProvider) {
    this.vectorSearchRepository = vectorSearchRepository;
    this.llmProvider = llmProvider;
  }

  async run(rawInput) {
    const input = SymptomMatcherInput.parse(rawInput);

    const { embedding } = await this.llmProvider.embed(input.symptomDescription);

    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearchRepository.searchByVector(embedding, { limit: 5 }),
      this.vectorSearchRepository.searchByKeyword(input.symptomDescription, { limit: 5 }),
    ]);

    const fused = reciprocalRankFusion(vectorResults, keywordResults);

    if (fused.length === 0) {
      throw new LowConfidenceMatchError('No matching equipment found for the given symptom.');
    }

    const topMatch = fused[0];

    if (!topMatch.equipment_id) {
      throw new LowConfidenceMatchError(
        `Matched document "${topMatch.title}" has no recorded equipment_id.`
      );
    }

    // Normalize the RRF score (unbounded but small, e.g. ~0.03) into a
    // 0–1 confidence value the schema expects. Simple linear scaling,
    // not a calibrated probability — documented as an MVP simplification.
    const confidence = Math.min(topMatch.score * 20, 1);

    if (confidence < MIN_CONFIDENCE_THRESHOLD) {
      throw new LowConfidenceMatchError(
        `Match confidence (${confidence.toFixed(2)}) is below the acceptable threshold (${MIN_CONFIDENCE_THRESHOLD}).`
      );
    }

    const output = {
      equipmentId: topMatch.equipment_id,
      manualVersion: topMatch.manual_version || 'unknown',
      confidence,
      matchedChunkIds: fused.slice(0, 5).map((r) => r.id),
    };

    // SymptomMatcher uses only embed (no LLM completion), so no token cost.
    // Attach zeros via Object.assign so the orchestrator receives a consistent
    // { tokensUsed, cost } shape without touching agentSchemas.js.
    const parsed = SymptomMatcherOutput.parse(output);
    return Object.assign(parsed, { tokensUsed: 0, cost: 0 });
  }
}

module.exports = SymptomMatcherAgent;