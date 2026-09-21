const { reciprocalRankFusion } = require('./hybridFusion');

describe('reciprocalRankFusion', () => {
  test('ranks a chunk appearing in both lists higher than one appearing in only one', () => {
    const vectorResults = [
      { id: 'chunk-A', title: 'Doc A' },
      { id: 'chunk-B', title: 'Doc B' },
    ];
    const keywordResults = [
      { id: 'chunk-A', title: 'Doc A' },
      { id: 'chunk-C', title: 'Doc C' },
    ];

    const fused = reciprocalRankFusion(vectorResults, keywordResults);

    // chunk-A appears in both lists, so it must rank first.
    expect(fused[0].id).toBe('chunk-A');
  });

  test('returns an empty array when both input lists are empty', () => {
    const fused = reciprocalRankFusion([], []);
    expect(fused).toEqual([]);
  });

  test('includes results that appear in only one list', () => {
    const vectorResults = [{ id: 'chunk-X', title: 'Doc X' }];
    const keywordResults = [];

    const fused = reciprocalRankFusion(vectorResults, keywordResults);

    expect(fused).toHaveLength(1);
    expect(fused[0].id).toBe('chunk-X');
  });

  test('does not duplicate a chunk that appears in both lists', () => {
    const vectorResults = [{ id: 'chunk-A', title: 'Doc A' }];
    const keywordResults = [{ id: 'chunk-A', title: 'Doc A' }];

    const fused = reciprocalRankFusion(vectorResults, keywordResults);

    expect(fused).toHaveLength(1);
  });
});