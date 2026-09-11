const GeminiProvider = require("../infrastructure/llm/GeminiProvider");
const OllamaProvider = require("../infrastructure/llm/OllamaProvider");

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

/**
 * Approximate cost per 1 000 tokens by provider.
 * Gemini Flash pricing (2024 public list); Ollama is free/local = $0.
 * These are hardcoded MVP estimates — SDD Part A deferred: replace with
 * a live pricing API or a more granular per-model table for production.
 */
const TOKEN_COST_PER_1K = {
  gemini: 0.001,
  ollama: 0,
};

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
    ollamaProvider = new OllamaProvider(
      process.env.OLLAMA_MODEL || "llama3.2:3b",
    );
  }
  return ollamaProvider;
}

/**
 * Compute approximate cost from token count and provider name.
 * @param {number} tokensUsed
 * @param {string} providerUsed - 'gemini' | 'ollama'
 * @returns {number} cost in USD
 */
function computeCost(tokensUsed, providerUsed) {
  const ratePerK = TOKEN_COST_PER_1K[providerUsed] ?? 0;
  return (tokensUsed / 1000) * ratePerK;
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
        const providerUsed = "gemini";
        return {
          ...result,
          providerUsed,
          cost: computeCost(result.tokensUsed ?? 0, providerUsed),
        };
      } catch (err) {
        console.warn(
          "[providerConfig] Gemini failed, falling back to Ollama:",
          err.message,
        );
        const result = await getOllamaProvider().complete(prompt, options);
        const providerUsed = "ollama";
        return {
          ...result,
          providerUsed,
          cost: computeCost(result.tokensUsed ?? 0, providerUsed),
        };
      }
    },

    async completeStream(prompt, onToken, options = {}) {
      if (process.env.FORCE_OFFLINE_MODE === "true") {
        return getOllamaProvider().completeStream(prompt, onToken, options);
      }
      try {
        return await getGeminiProvider().completeStream(
          prompt,
          onToken,
          options,
        );
      } catch (err) {
        console.warn(
          "[providerConfig] Gemini stream failed, falling back to Ollama:",
          err.message,
        );
        return getOllamaProvider().completeStream(prompt, onToken, options);
      }
    },

    async embed(text) {
      try {
        const result = await getGeminiProvider().embed(text);
        return { embedding: result, providerUsed: "gemini" };
      } catch (err) {
        console.warn(
          "[providerConfig] Gemini embed failed, falling back to Ollama:",
          err.message,
        );
        const result = await getOllamaProvider().embed(text);
        return { embedding: result, providerUsed: "ollama" };
      }
    },
  };
}

module.exports = { getLLMProvider };
