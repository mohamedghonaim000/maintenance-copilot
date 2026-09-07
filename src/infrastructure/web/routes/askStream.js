const express = require('express');
const { reciprocalRankFusion } = require('../../../application/retrieval/hybridFusion');
const { buildPrompt } = require('../../../application/retrieval/buildPrompt');

function createAskStreamRouter({ vectorSearchRepository, llmProvider }) {
  const router = express.Router();

  router.get('/ask/stream', async (req, res) => {
    const { question } = req.query;
    if (!question) {
      return res.status(400).json({ error: 'question query param is required' });
    }

    // SSE headers — this is what makes the connection stay open and
    // lets the browser interpret each "data: ..." line as an event.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Client cancellation (FR-6): if the browser closes the connection,
    // stop treating this request as active. We can't literally abort an
    // in-flight LLM call with these SDKs, but we stop writing to a
    // closed socket and stop counting this as billable/completed work.
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    try {
      sendEvent('status', { message: 'Retrieving relevant sources...' });

      const { embedding } = await llmProvider.embed(question);
      const [vectorResults, keywordResults] = await Promise.all([
        vectorSearchRepository.searchByVector(embedding, { limit: 5 }),
        vectorSearchRepository.searchByKeyword(question, { limit: 5 }),
      ]);
      const fusedResults = reciprocalRankFusion(vectorResults, keywordResults).slice(0, 5);

      if (clientDisconnected) return;

      if (fusedResults.length === 0) {
        sendEvent('answer_chunk', { text: 'Not enough information in the corpus to answer this question.' });
        sendEvent('done', { citations: [] });
        return res.end();
      }

      sendEvent('status', { message: 'Generating answer...' });

      const prompt = buildPrompt(question, fusedResults);

      await llmProvider.completeStream(prompt, (tokenText) => {
        if (!clientDisconnected) {
          sendEvent('answer_chunk', { text: tokenText });
        }
      });

      if (clientDisconnected) return;

      const citations = fusedResults.map((chunk, i) => ({
        sourceIndex: i + 1,
        documentTitle: chunk.title,
        manualVersion: chunk.manual_version,
        section: chunk.section,
      }));

      sendEvent('done', { citations });
      res.end();
    } catch (err) {
      if (!clientDisconnected) {
        sendEvent('error', { message: err.message });
        res.end();
      }
    }
  });

  return router;
}

module.exports = createAskStreamRouter;