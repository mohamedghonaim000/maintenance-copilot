const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { validateBody, validateParams } = require('../validation/validate');
const {
  CreateSessionBodySchema,
  SessionIdParamsSchema,
  AddMessageBodySchema,
} = require('../validation/schemas');

function createSessionsRouter({ sessionRepository, sessionUseCases }) {
  const router = express.Router();
  const useCases = sessionUseCases || {
    createSession: (input) => sessionRepository.createSession(input),
    getUserSessions: (userId) => sessionRepository.getSessionsByUser(userId),
    deleteSession: (input) => sessionRepository.deleteSession(input),
    getSessionRuns: ({ sessionId, userId }) =>
      sessionRepository.getRunsBySession(sessionId, userId),
    addMessage: (input) => sessionRepository.addMessage(input),
    getSessionMessages: (input) => sessionRepository.getSessionMessages(input),
  };

  router.post('/sessions', requireAuth, validateBody(CreateSessionBodySchema), async (req, res) => {
    try {
      const session = await useCases.createSession({
        userId: req.user.userId,
        title: req.body?.title,
      });
      res.status(201).json(session);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/sessions', requireAuth, async (req, res) => {
    try {
      const sessions = await useCases.getUserSessions(req.user.userId);
      res.json(sessions);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete(
    '/sessions/:sessionId',
    requireAuth,
    validateParams(SessionIdParamsSchema),
    async (req, res) => {
      try {
        await useCases.deleteSession({
          sessionId: req.params.sessionId,
          userId: req.user.userId,
        });
        res.status(204).end();
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    }
  );

  router.get(
    '/sessions/:sessionId/runs',
    requireAuth,
    validateParams(SessionIdParamsSchema),
    async (req, res) => {
      try {
        const runs = await useCases.getSessionRuns({
          sessionId: req.params.sessionId,
          userId: req.user.userId,
        });
        res.json(runs);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );

  router.post(
    '/sessions/:sessionId/messages',
    requireAuth,
    validateParams(SessionIdParamsSchema),
    validateBody(AddMessageBodySchema),
    async (req, res) => {
      const { runId, role, content } = req.body;
      try {
        const message = await useCases.addMessage({
          sessionId: req.params.sessionId,
          userId: req.user.userId,
          runId,
          role,
          content,
        });
        res.status(201).json(message);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );

  router.get(
    '/sessions/:sessionId/messages',
    requireAuth,
    validateParams(SessionIdParamsSchema),
    async (req, res) => {
      try {
        const messages = await useCases.getSessionMessages({
          sessionId: req.params.sessionId,
          userId: req.user.userId,
        });
        res.json(messages);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );

  return router;
}

module.exports = createSessionsRouter;