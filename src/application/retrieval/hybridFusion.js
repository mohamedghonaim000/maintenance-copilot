/**
 * Combines dense (vector) and keyword search results using
 * Reciprocal Rank Fusion (RRF) — a simple, well-documented method
 * that doesn't require normalizing scores from two different scales
 * (cosine similarity vs. ts_rank aren't directly comparable).
 *
 * RRF score for a chunk = sum over each ranked list it appears in of
 * 1 / (k + rank_in_that_list), where k=60 is a standard damping constant.
 */
function reciprocalRankFusion(vectorResults, keywordResults, k = 60) {
  const scores = new Map();

  const addScores = (results) => {
    results.forEach((item, index) => {
      const rank = index + 1;
      const rrfScore = 1 / (k + rank);
      const existing = scores.get(item.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(item.id, { ...item, score: rrfScore });
      }
    });
  };

  addScores(vectorResults);
  addScores(keywordResults);

  return [...scores.values()].sort((a, b) => b.score - a.score);
}

module.exports = { reciprocalRankFusion };