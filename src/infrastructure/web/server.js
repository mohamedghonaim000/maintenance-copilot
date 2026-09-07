const express = require('express');
const { buildDependencies } = require('./compositionRoot');
const createIngestRouter = require('./routes/ingest');
const createAskRouter = require('./routes/ask');
const createWorkflowRouter = require('./routes/workflow');
const createAskStreamRouter = require('./routes/askStream');
const createAuthRouter = require('./routes/auth');

function createServer(deps = buildDependencies()) {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', (req, res) => {
    // Later: check DB connectivity here too (FR-9 readiness check)
    res.json({ status: 'ready' });
  });

  app.use(createIngestRouter(deps));
  app.use(createAskRouter(deps));
  app.use(createWorkflowRouter(deps));
  app.use(createAskStreamRouter(deps));
  app.use(createAuthRouter(deps));

  return app;
}

module.exports = createServer;
