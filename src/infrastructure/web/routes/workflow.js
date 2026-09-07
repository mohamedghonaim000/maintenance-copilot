const express = require('express');

function createWorkflowRouter({ orchestrator, decideApproval, runRepository }) {
  const router = express.Router();

  // Start a maintenance workflow run
  router.post('/workflow/run', async (req, res) => {
    const { symptomDescription, sessionId } = req.body || {};
    if (!symptomDescription) {
      return res.status(400).json({ error: 'symptomDescription is required' });
    }

    try {
      const result = await orchestrator.runWorkflow({ symptomDescription, sessionId });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Decide on a pending approval
  router.post('/approvals/:approvalId/decide', async (req, res) => {
    const { approvalId } = req.params;
    const { decision, approvedBy, comment, editedAction } = req.body || {};

    try {
      const result = await decideApproval.run({
        approvalId,
        decision,
        approvedBy,
        comment,
        editedAction,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createWorkflowRouter;
