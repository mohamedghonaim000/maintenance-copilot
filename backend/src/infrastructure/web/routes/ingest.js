const express = require('express');
const multer = require('multer');
const upload = multer({ dest: 'sample-corpus/' });

function createIngestRouter({ ingestDocument }) {
  const router = express.Router();

  router.post('/ingest/path', async (req, res) => {
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

  router.post('/ingest/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    try {
      const { source } = req.body || {};
      const results = await ingestDocument.run(
        req.file.path,
        source || 'api-upload',
        req.file?.originalname
      );
      res.json({ results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createIngestRouter;