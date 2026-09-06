const express = require('express');

function createServer() {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', (req, res) => {
    // Later: check DB connectivity here too (FR-9 readiness check)
    res.json({ status: 'ready' });
  });

  return app;
}

module.exports = createServer;