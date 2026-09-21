const express = require('express');
const { validateBody } = require('../validation/validate');
const { AskBodySchema } = require('../validation/schemas');

function createAskRouter({ askQuestion }) {
  const router = express.Router();

  router.post('/ask', validateBody(AskBodySchema), async (req, res) => {
    const { question } = req.body;

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
