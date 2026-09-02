const GeminiProvider = require('../infrastructure/llm/GeminiProvider');
const OllamaProvider = require('../infrastructure/llm/OllamaProvider');

/**
 * Composition root for LLM provider selection.
 *
 * Strategy: try the configured primary provider (Gemini, online).
 * If it fails for any reason (no internet, API error, rate limit),
 * fall back automatically to the local Ollama provider.
 *
 * This is the ONLY file in the project that knows both providers exist.
 * Everything else in application/ talks to the LLMProvider interface only.
 */

let geminiProvider = null;
let ollamaProvider = null;

function getGeminiProvider() {
  if (!geminiProvider) {
    geminiProvider = new GeminiProvider(process.env.GEMINI_API_KEY);
  }
  return geminiProvider;
}

function getOllamaProvider() {
  if (!ollamaProvider) {
    ollamaProvider = new OllamaProvider(process.env.OLLAMA_MODEL || 'llama3.2:3b');
  }
  return ollamaProvider;
}

/**
 * Returns a provider-like object that tries Gemini first, and
 * transparently falls back to Ollama on failure. The caller never
 * knows which one actually served the request — but the mode is
 * returned alongside the result for observability/logging.
 */
function getLLMProvider() {
  return {
    async complete(prompt, options = {}) {
      try {
        const result = await getGeminiProvider().complete(prompt, options);
        return { ...result, providerUsed: 'gemini' };
      } catch (err) {
        console.warn('[providerConfig] Gemini failed, falling back to Ollama:', err.message);
        const result = await getOllamaProvider().complete(prompt, options);
        return { ...result, providerUsed: 'ollama' };
      }
    },

    async embed(text) {
      try {
        const result = await getGeminiProvider().embed(text);
        return { embedding: result, providerUsed: 'gemini' };
      } catch (err) {
        console.warn('[providerConfig] Gemini embed failed, falling back to Ollama:', err.message);
        const result = await getOllamaProvider().embed(text);
        return { embedding: result, providerUsed: 'ollama' };
      }
    },
  };
}

module.exports = { getLLMProvider };