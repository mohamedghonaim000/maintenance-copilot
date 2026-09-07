const express = require('express');
const { requireAuth } = require('../middlewares/auth');

function createSessionsRouter({ sessionRepository }) {
  const router = express.Router();

  router.post('/sessions', requireAuth, async (req, res) => {
    const { title } = req.body;
    const session = await sessionRepository.createSession({
      userId: req.user.userId,
      title,
    });
    res.status(201).json(session);
  });

  router.get('/sessions', requireAuth, async (req, res) => {
    const sessions = await sessionRepository.getSessionsByUser(req.user.userId);
    res.json(sessions);
  });

  router.get('/sessions/:sessionId/runs', requireAuth, async (req, res) => {
    const runs = await sessionRepository.getRunsBySession(req.params.sessionId);
    res.json(runs);
  });

  return router;
}

module.exports = createSessionsRouter;