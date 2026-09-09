const DiagnosticSafetyPlannerAgent = require('./DiagnosticSafetyPlannerAgent');

describe('DiagnosticSafetyPlannerAgent', () => {
  test('parses the object response returned by an LLM provider', async () => {
    const vectorSearchRepository = {
      searchByVector: jest.fn().mockResolvedValue([
        { id: 'vector-1', section: 'Safety', content: 'Wear PPE' },
      ]),
      searchByKeyword: jest.fn().mockResolvedValue([
        { id: 'keyword-1', section: 'Troubleshooting', content: 'Check power' },
      ]),
    };
    const llmProvider = {
      embed: jest.fn().mockResolvedValue({ embedding: [0.1] }),
      complete: jest.fn().mockResolvedValue({
        text: 'DIAGNOSTIC STEPS:\n- Check power\nSAFETY PREREQUISITES:\n- Wear PPE',
        tokensUsed: 12,
      }),
    };

    const agent = new DiagnosticSafetyPlannerAgent(vectorSearchRepository, llmProvider, {
      timeoutMs: 1000,
    });

    await expect(
      agent.run({
        equipmentId: 'AC-450',
        manualVersion: '1.0',
        symptomDescription: 'unit will not start',
      })
    ).resolves.toMatchObject({
      diagnosticSteps: ['Check power'],
      safetyPrerequisites: ['Wear PPE'],
      sourceChunkIds: ['vector-1', 'keyword-1'],
    });
  });

  test('accepts Markdown formatting around section labels', () => {
    const agent = new DiagnosticSafetyPlannerAgent({}, {});
    const response = '### DIAGNOSTIC STEPS\n1. Check power\n\n**SAFETY PREREQUISITES:**\n- Wear PPE';

    expect(agent.extractListSection(response, 'SAFETY PREREQUISITES:')).toEqual(['Wear PPE']);
  });

  test('falls back to retrieved evidence when the model omits safety formatting', async () => {
    const vectorSearchRepository = {
      searchByVector: jest.fn().mockResolvedValue([
        { id: 'vector-1', section: 'Safety', content: 'Wear PPE before servicing.' },
      ]),
      searchByKeyword: jest.fn().mockResolvedValue([
        { id: 'keyword-1', section: 'Troubleshooting', content: 'Check the power supply.' },
      ]),
    };
    const llmProvider = {
      embed: jest.fn().mockResolvedValue({ embedding: [0.1] }),
      complete: jest.fn().mockResolvedValue({ text: 'Not enough information.', tokensUsed: 4 }),
    };
    const agent = new DiagnosticSafetyPlannerAgent(vectorSearchRepository, llmProvider, {
      timeoutMs: 1000,
    });

    await expect(agent.run({
      equipmentId: 'AC-450',
      manualVersion: '1.0',
      symptomDescription: 'unit will not start',
    })).resolves.toMatchObject({
      diagnosticSteps: ['Check the power supply.'],
      safetyPrerequisites: ['Wear PPE before servicing.'],
    });
  });
});