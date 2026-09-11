const express = require('express');
const { buildDependencies } = require('./compositionRoot');
const createIngestRouter = require('./routes/ingest');
const createAskRouter = require('./routes/ask');
const createWorkflowRouter = require('./routes/workflow');
const createAskStreamRouter = require('./routes/askStream');
const createAuthRouter = require('./routes/auth');
const createSessionsRouter = require('./routes/sessions');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');


/**
 * Global rate limiter — applied to all routes.
 * 100 requests per 15 minutes per IP.
 * Mitigates general abuse / OWASP API4 (Unrestricted Resource Consumption).
 * SDD Part A — deferred: for production, back this with a Redis store
 * (e.g. rate-limit-redis) so limits survive server restarts and scale
 * horizontally; the in-memory store used here resets on restart.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Stricter limiter for the login endpoint.
 * 5 attempts per 15 minutes per IP.
 * Slows credential-stuffing attacks (OWASP API7 — Server Side Request Forgery
 * and OWASP Web Top 10 — A07 Identification and Authentication Failures).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

/**
 * Allowed origin for CORS. Read from ALLOWED_ORIGIN env var so staging/prod
 * can override without code changes. Defaults to the Vite dev server port.
 * Wildcard '*' is intentionally NOT used — OWASP A05 Security Misconfiguration.
 * SDD Part A — deferred: for multi-origin support, extend to an allowlist array.
 */
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

function createServer(deps = buildDependencies()) {
  const app = express();

  /**
   * Security headers via Helmet (OWASP A05 Security Misconfiguration).
   * Defaults set: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection,
   * Strict-Transport-Security, Content-Security-Policy, and more.
   * SDD Part A — deferred: tighten CSP directives for the production frontend.
   */
  app.use(helmet());

  // Apply global rate limiter before any routes
  app.use(globalLimiter);

  app.use(express.json());

  app.use(cors({
    origin: allowedOrigin,
    credentials: true,
  }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', (req, res) => {
    // Later: check DB connectivity here too (FR-9 readiness check)
    res.json({ status: 'ready' });
  });

  // Stricter rate limit on the login route (applied before the auth router)
  app.use('/auth/login', authLimiter);

  app.use(createIngestRouter(deps));
  app.use(createAskRouter(deps));
  app.use(createWorkflowRouter(deps));
  app.use(createAskStreamRouter(deps));
  app.use(createAuthRouter(deps));
  app.use(createSessionsRouter(deps));

  return app;
}

module.exports = createServer;
