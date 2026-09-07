const LLMProvider = require('../../ports/LLMProvider');

class OllamaProvider extends LLMProvider {
  constructor(model = 'llama3.2:3b',embeddingModel = 'nomic-embed-text', baseUrl = 'http://localhost:11434') {
    super();
    this.model = model;
    this.embeddingModel = embeddingModel;
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

  async completeStream(prompt, onToken) {
  const response = await fetch(`${this.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: this.model, prompt, stream: true }),
  });

  if (!response.ok) {
    throw new Error(`Ollama stream request failed: ${response.status}`);
  }

  let fullText = '';
  const decoder = new TextDecoder();

  for await (const chunk of response.body) {
    const lines = decoder.decode(chunk).split('\n').filter(Boolean);
    for (const line of lines) {
      const data = JSON.parse(line);
      if (data.response) {
        fullText += data.response;
        onToken(data.response);
      }
    }
  }

  return { text: fullText };
}

  async embed(text) {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.embeddingModel, prompt: text }),
    });
    if (!response.ok) {
      throw new Error(`Ollama embedding request failed: ${response.status}`);
    }
    const data = await response.json();
    return data.embedding;
  }
}

module.exports = OllamaProvider;