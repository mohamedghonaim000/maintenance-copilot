const express = require('express');
const multer = require('multer');
const { validateBody } = require('../validation/validate');
const { IngestBodySchema, IngestUploadBodySchema } = require('../validation/schemas');

const upload = multer({ dest: 'sample-corpus/' });

function createIngestRouter({ ingestDocument }) {
  const router = express.Router();

  // Ingest document using a file path
  router.post('/ingest', validateBody(IngestBodySchema), async (req, res) => {
    const { filePath, source } = req.body;

    try {
      const results = await ingestDocument.run(
        filePath,
        source || 'api-upload'
      );

      return res.json({ results });
    } catch (err) {
      return res.status(500).json({
        error: err.message,
      });
    }
  });

  // Ingest document using multipart file upload
  router.post('/ingest/upload', upload.single('file'), validateBody(IngestUploadBodySchema), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'file is required',
      });
    }

    try {
      const { source } = req.body;

      const results = await ingestDocument.run(
        req.file.path,
        source || 'api-upload',
        req.file.originalname
      );

      return res.json({ results });
    } catch (err) {
      return res.status(500).json({
        error: err.message,
      });
    }
  });

  return router;
}

module.exports = createIngestRouter;