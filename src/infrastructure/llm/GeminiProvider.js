const { GoogleGenerativeAI } = require('@google/generative-ai');
const LLMProvider = require('../../ports/LLMProvider');

class GeminiProvider extends LLMProvider {
  constructor(apiKey) {
    super();
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  }

  async complete(prompt) {
    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    const tokensUsed = result.response.usageMetadata?.totalTokenCount ?? 0;
    return { text, tokensUsed };
  }

  async embed(text) {
  const embeddingModel = this.genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await embeddingModel.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: 768,
  });
  return result.embedding.values;
}
}

module.exports = GeminiProvider;