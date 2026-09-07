const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');

function createWorkflowRouter({ orchestrator, decideApproval, runRepository }) {
  const router = express.Router();

  // Start a maintenance workflow run — any authenticated user (technician) can trigger this
  router.post('/workflow/run', requireAuth, async (req, res) => {
    const { symptomDescription, sessionId } = req.body || {};
    if (!symptomDescription) {
      return res.status(400).json({ error: 'symptomDescription is required' });
    }

    const result = await orchestrator.runWorkflow({
      symptomDescription,
      sessionId,
      initiatedBy: req.user.userId,
    });
    res.json(result);
  });

  // Decide on a pending approval — ONLY supervisors can approve/reject work orders
  router.post(
    '/approvals/:approvalId/decide',
    requireAuth,
    requireRole('supervisor'),
    async (req, res) => {
      const { approvalId } = req.params;
      const { decision, comment, editedAction } = req.body;

      try {
        const result = await decideApproval.run({
          approvalId,
          decision,
          approvedBy: req.user.userId, 
          comment,
          editedAction,
        });
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );

  return router;
}

module.exports = createWorkflowRouter;
