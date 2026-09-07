const express = require('express');

function createIngestRouter({ ingestDocument }) {
  const router = express.Router();

  router.post('/ingest', async (req, res) => {
    const { filePath, source } = req.body || {};
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    try {
      const results = await ingestDocument.run(filePath, source || 'api-upload');
      res.json({ results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createIngestRouter;
