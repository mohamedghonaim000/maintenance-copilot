const crypto = require('crypto');
const express = require('express');
const { reciprocalRankFusion } = require('../../../application/retrieval/hybridFusion');
const { buildPrompt } = require('../../../application/retrieval/buildPrompt');
const { requireAuth } = require('../middlewares/auth');

const REFUSAL_TEXT = 'Not enough information in the corpus to answer this question.';
const GREETING_TEXT = 'Hello! How can I help you with your maintenance question today?';

function createAskStreamRouter({
  vectorSearchRepository,
  llmProvider,
  sessionUseCases,
  runRepository,
}) {
  const router = express.Router();

  router.post('/ask/stream', requireAuth, async (req, res) => {
    const { question, sessionId } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'question (string) is required' });
    }
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    let runId;
    let clientDisconnected = false;
    res.on('close', () => {
      // The request can close normally after its POST body is consumed.
      // Only treat the response connection closing before completion as abort.
      if (!res.writableEnded) {
        clientDisconnected = true;
      }
    });

    try {
      const historyMessages = await sessionUseCases.getSessionMessages({
        sessionId,
        userId: req.user.userId,
      });
      const history = historyMessages
        .slice(-8)
        .map((message) => `${message.role.toUpperCase()}: ${message.content.slice(0, 800)}`)
        .join('\n');

      runId = await runRepository.createRun({
        correlationId: crypto.randomUUID(),
        workflowType: 'qa',
        initiatedBy: req.user.userId,
        sessionId,
      });

      await sessionUseCases.addMessage({
        sessionId,
        userId: req.user.userId,
        runId,
        role: 'user',
        content: question.trim(),
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const sendEvent = (event, data) => {
        if (!clientDisconnected) {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      };

      const greetingPattern = /^(hi|hello|hey|good morning|good afternoon|good evening|how are you)[.!?\s]*$/i;
      if (greetingPattern.test(question.trim())) {
        sendEvent('answer_chunk', { text: GREETING_TEXT });
        await sessionUseCases.addMessage({
          sessionId,
          userId: req.user.userId,
          runId,
          role: 'assistant',
          content: GREETING_TEXT,
        });
        await runRepository.updateRunStatus(runId, 'completed');
        sendEvent('done', { runId, citations: [] });
        return res.end();
      }

      sendEvent('status', { message: 'Retrieving relevant sources...' });
      const retrievalQuestion = history
        ? `${history}\nCURRENT QUESTION: ${question.trim()}`
        : question.trim();
      const { embedding } = await llmProvider.embed(retrievalQuestion);
      const [vectorResults, keywordResults] = await Promise.all([
        vectorSearchRepository.searchByVector(embedding, { limit: 5 }),
        vectorSearchRepository.searchByKeyword(retrievalQuestion, { limit: 5 }),
      ]);
      const fusedResults = reciprocalRankFusion(vectorResults, keywordResults).slice(0, 5);

      if (clientDisconnected) return;

      if (fusedResults.length === 0) {
        sendEvent('answer_chunk', { text: REFUSAL_TEXT });
        await sessionUseCases.addMessage({
          sessionId,
          userId: req.user.userId,
          runId,
          role: 'assistant',
          content: REFUSAL_TEXT,
        });
        await runRepository.updateRunStatus(runId, 'completed');
        sendEvent('done', { runId, citations: [] });
        return res.end();
      }

      sendEvent('status', { message: 'Generating answer...' });
      const prompt = buildPrompt(question.trim(), fusedResults, history);
      let answer = '';
      await llmProvider.completeStream(prompt, (tokenText) => {
        answer += tokenText;
        sendEvent('answer_chunk', { text: tokenText });
      });

      if (clientDisconnected) return;

      await sessionUseCases.addMessage({
        sessionId,
        userId: req.user.userId,
        runId,
        role: 'assistant',
        content: answer,
      });
      await runRepository.updateRunStatus(runId, 'completed');

      const citations = fusedResults.map((chunk, i) => ({
        sourceIndex: i + 1,
        documentTitle: chunk.title,
        manualVersion: chunk.manual_version,
        section: chunk.section,
      }));
      sendEvent('done', { runId, citations });
      res.end();
    } catch (error) {
      if (runId) {
        await runRepository.updateRunStatus(runId, 'failed').catch(() => {});
      }
      if (!res.headersSent) {
        return res.status(error.message === 'Session not found' ? 404 : 400).json({ error: error.message });
      }
      if (!clientDisconnected) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
        res.end();
      }
    }
  });

  return router;
}

module.exports = createAskStreamRouter;
