/**
 * LLMProvider Port (interface)
 *
 * Any concrete provider (Gemini, Ollama, ...) must implement these methods.
 * This is the ONLY shape the application layer is allowed to depend on —
 * it must never import a concrete provider directly.
 */
class LLMProvider {
  /**
   * @param {string} prompt
   * @param {object} options
   * @returns {Promise<{ text: string, tokensUsed: number }>}
   */
  async complete(prompt, options = {}) {
    throw new Error('LLMProvider.complete() must be implemented');
  }

  /**
   * @param {string} text
   * @returns {Promise<number[]>} embedding vector
   */
  async embed(text) {
    throw new Error('LLMProvider.embed() must be implemented');
  }
}

module.exports = LLMProvider;