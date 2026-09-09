class DecideApproval {
  constructor(runRepository, workOrderRepository) {
    this.runRepository = runRepository;
    this.workOrderRepository = workOrderRepository;
  }

  /**
   * decision: 'approved' | 'rejected' | 'edited_and_approved'
   * editedAction: required only when decision is 'edited_and_approved'
   */
  async run({ approvalId, decision, approvedBy, comment = null, editedAction = null }) {
    const validDecisions = ['approved', 'rejected', 'edited_and_approved'];
    if (!validDecisions.includes(decision)) {
      throw new Error(`Invalid decision: ${decision}`);
    }
    if (decision === 'edited_and_approved' && !editedAction) {
      throw new Error('editedAction is required when decision is "edited_and_approved"');
    }

    // Fetch the original proposal — this is the only source of truth
    // for what the agents actually produced. We never trust a caller-
    // supplied work order for the "approved" (unedited) path.
    const approval = await this.runRepository.getApprovalById(approvalId);
    const runId = approval.runId;

    const finalAction = decision === 'edited_and_approved' ? editedAction : null;

    await this.runRepository.decideApproval({
      approvalId,
      status: decision,
      approvedBy,
      comment,
      finalAction,
    });

    if (decision === 'rejected') {
      await this.runRepository.updateRunStatus(runId, 'failed');
      return { status: 'rejected' };
    }

    // approved OR edited_and_approved: NOW it's safe to persist the
    // actual work_order row and mark the run complete. This is the
    // one and only point where the proposed action becomes real —
    // everything before this was a draft awaiting a human decision.
    const workOrderToSave =
      decision === 'edited_and_approved' ? editedAction : approval.proposedAction;

    const workOrderId = await this.workOrderRepository.saveWorkOrder({
      runId,
      approvalId,
      workOrder: workOrderToSave,
    });

    await this.runRepository.updateRunStatus(runId, 'completed');

    return { status: decision, workOrderId };
  }
}

module.exports = DecideApproval;