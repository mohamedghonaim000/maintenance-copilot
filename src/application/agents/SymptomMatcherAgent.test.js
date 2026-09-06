const SymptomMatcherAgent = require('./SymptomMatcherAgent');
const LowConfidenceMatchError = require('../../domain/errors/LowConfidenceMatchError');

// A fake LLM provider — no network calls, no API keys, fully deterministic.
function createMockLlmProvider(fakeEmbedding = [0.1, 0.2, 0.3]) {
  return {
    embed: jest.fn().mockResolvedValue({ embedding: fakeEmbedding }),
  };
}

describe('SymptomMatcherAgent', () => {
  test('throws LowConfidenceMatchError when no results are retrieved', async () => {
    const mockSearchRepo = {
      searchByVector: jest.fn().mockResolvedValue([]),
      searchByKeyword: jest.fn().mockResolvedValue([]),
    };
    const mockLlm = createMockLlmProvider();

    const agent = new SymptomMatcherAgent(mockSearchRepo, mockLlm);

    await expect(
      agent.run({ symptomDescription: 'something is wrong with the machine' })
    ).rejects.toThrow(LowConfidenceMatchError);
  });

  test('throws LowConfidenceMatchError when the matched document has no equipment_id', async () => {
    const mockSearchRepo = {
      searchByVector: jest.fn().mockResolvedValue([
        { id: 'chunk-1', title: 'Unlabeled Manual', score: 0.5, equipment_id: null },
      ]),
      searchByKeyword: jest.fn().mockResolvedValue([]),
    };
    const mockLlm = createMockLlmProvider();

    const agent = new SymptomMatcherAgent(mockSearchRepo, mockLlm);

    await expect(
      agent.run({ symptomDescription: 'something is wrong with the machine' })
    ).rejects.toThrow(LowConfidenceMatchError);
  });

  test('returns a valid match when confidence is above threshold', async () => {
    const mockSearchRepo = {
      searchByVector: jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          title: 'HP-200 Manual',
          equipment_id: 'HP-200',
          manual_version: 'v2.0',
          score: 0.5,
        },
      ]),
      searchByKeyword: jest.fn().mockResolvedValue([]),
    };
    const mockLlm = createMockLlmProvider();

    const agent = new SymptomMatcherAgent(mockSearchRepo, mockLlm);
    const result = await agent.run({ symptomDescription: 'pump is vibrating abnormally' });

    expect(result.equipmentId).toBe('HP-200');
    expect(result.manualVersion).toBe('v2.0');
    expect(mockLlm.embed).toHaveBeenCalledTimes(1);
  });
});