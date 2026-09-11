/**
 * Zod validation middleware factory.
 *
 * Provides validateBody(schema) and validateParams(schema) Express middlewares.
 * On failure, returns HTTP 400 with structured Zod error details so the client
 * knows exactly which fields failed and why — no 500s for bad input.
 *
 * OWASP Web Top 10 — A03 Injection / A04 Insecure Design:
 * All request bodies and params are schema-validated before reaching
 * any use-case or agent handler.
 */

const { z } = require('zod');

/**
 * Format a ZodError into a client-friendly shape.
 * Each issue is reported with its path and message.
 */
function formatZodError(zodError) {
  return zodError.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Validates req.body against the given Zod schema.
 * Replaces req.body with the parsed (and potentially stripped) result
 * so downstream handlers can trust the shape is correct.
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatZodError(result.error),
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validates req.params against the given Zod schema.
 */
function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatZodError(result.error),
      });
    }
    req.params = result.data;
    next();
  };
}

/**
 * Validates req.query against the given Zod schema.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatZodError(result.error),
      });
    }
    req.query = result.data;
    next();
  };
}

module.exports = { validateBody, validateParams, validateQuery };
