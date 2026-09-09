const { buildPrompt } = require('./buildPrompt');

describe('buildPrompt', () => {
  test('keeps conversation history separate from the current question', () => {
    const prompt = buildPrompt(
      'What happens if it exceeds that?',
      [{
        title: 'HP-200 manual',
        manual_version: 'v2.0',
        section: 'Operating Parameters',
        content: 'Maximum allowable pressure: 210 bar.',
      }],
      'USER: What is the maximum allowable pressure?\nASSISTANT: It is 210 bar (Source 1).'
    );

    expect(prompt).toContain('CONVERSATION HISTORY');
    expect(prompt).toContain('CURRENT QUESTION: What happens if it exceeds that?');
    expect(prompt).toContain('Treat the conversation history as context for continuity, not as evidence.');
    expect(prompt).toContain('I need a little more information: [specific detail needed].');
  });
});