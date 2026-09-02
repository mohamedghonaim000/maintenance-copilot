const LLMProvider = require('../../ports/LLMProvider');

class OllamaProvider extends LLMProvider {
  constructor(model = 'llama3.2:3b', baseUrl = 'http://localhost:11434') {
    super();
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async complete(prompt) {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt, stream: false }),
    });
    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }
    const data = await response.json();
    return { text: data.response, tokensUsed: data.eval_count ?? 0 };
  }

  async embed(text) {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });
    if (!response.ok) {
      throw new Error(`Ollama embedding request failed: ${response.status}`);
    }
    const data = await response.json();
    return data.embedding;
  }
}

module.exports = OllamaProvider;