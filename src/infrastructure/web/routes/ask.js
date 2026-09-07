const express = require('express');

function createAskRouter({ askQuestion }) {
  const router = express.Router();

  router.post('/ask', async (req, res) => {
    const { question } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question (string) is required' });
    }

    try {
      const result = await askQuestion.run(question);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createAskRouter;
