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

function createServer(deps = buildDependencies()) {
  const app = express();

  // Apply global rate limiter first (before any routes)
  app.use(globalLimiter);

  app.use(express.json());

  app.use(cors({
    origin: 'http://localhost:5173',
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
