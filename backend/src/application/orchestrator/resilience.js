/**
 * Retries an async function with exponential backoff, but ONLY for
 * transient errors (network/provider failures). Domain validation
 * errors (LowConfidenceMatchError, missing safety prerequisites, Zod
 * errors) are NOT retried — retrying won't fix bad input, it'll just
 * waste time and tokens repeating the same failure.
 */
async function retryWithBackoff(fn, { maxRetries = 2, baseDelayMs = 500, isRetryable } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = isRetryable ? isRetryable(err) : true;
      if (!retryable || attempt === maxRetries) throw err;
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/**
 * Wraps a promise with a hard timeout. Used per-step so one slow agent
 * call (e.g. a hung LLM request) can't stall the entire workflow run.
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Step "${label}" timed out after ${ms}ms`)), ms)
    ),
  ]);
}

module.exports = { retryWithBackoff, withTimeout };