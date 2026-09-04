function reciprocalRankFusion(
  vectorResults,
  keywordResults,
  k = 60
) {
  const scores = new Map();

  const addScores = (results, source) => {
    results.forEach((item, index) => {
      const rank = index + 1;

      const rrfScore = 1 / (k + rank);

      if (!scores.has(item.id)) {
        scores.set(item.id, {
          ...item,

          score: 0,

          vectorRank: null,
          keywordRank: null,

          vectorSimilarity: null,
          keywordRankScore: null
        });
      }

      const entry = scores.get(item.id);

      entry.score += rrfScore;

      if (source === 'vector') {
        entry.vectorRank = rank;
        entry.vectorSimilarity = item.similarity;
      }

      if (source === 'keyword') {
        entry.keywordRank = rank;
        entry.keywordRankScore = item.rank;
      }
    });
  };

  addScores(vectorResults, 'vector');
  addScores(keywordResults, 'keyword');

  return [...scores.values()]
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.id - b.id;
    });
}

module.exports = {
  reciprocalRankFusion
};