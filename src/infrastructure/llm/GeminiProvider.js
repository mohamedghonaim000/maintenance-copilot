const { GoogleGenAI } = require('@google/genai');
const LLMProvider = require('../../ports/LLMProvider');

class GeminiProvider extends LLMProvider {
  constructor(apiKey) {
    super();
    this.ai = new GoogleGenAI({ apiKey });
  }

  async complete(prompt) {
    const result = await this.ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });
    const text = result.text;
    const tokensUsed = result.usageMetadata?.totalTokenCount ?? 0;
    return { text, tokensUsed };
  }

  async embed(text) {
    const result = await this.ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text,
      config: {
        outputDimensionality: 768,  
      },
    });
    return result.embeddings[0].values;
  }

  async completeStream(prompt, onToken) {
    const result = await this.ai.models.generateContentStream({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });
    let fullText = '';
    let tokensUsed = 0;
    for await (const chunk of result) {
      const chunkText = chunk.text;
      fullText += chunkText;
      tokensUsed = chunk.usageMetadata?.totalTokenCount ?? tokensUsed;
      onToken(chunkText);
    }
    return { text: fullText, tokensUsed };
  }
}

module.exports = GeminiProvider;