const pool = require('./postgresClient');

class RunRepository {
  async createRun({ correlationId, workflowType, initiatedBy = null, sessionId = null }) {
    const result = await pool.query(
      `INSERT INTO runs (correlation_id, workflow_type, initiated_by, session_id, status)
       VALUES ($1, $2, $3, $4, 'running')
       RETURNING id`,
      [correlationId, workflowType, initiatedBy, sessionId]
    );
    return result.rows[0].id;
  }

  async updateRunStatus(runId, status) {
    await pool.query(
      `UPDATE runs SET status = $1, completed_at = CASE WHEN $1 IN ('completed','failed') THEN now() ELSE completed_at END WHERE id = $2`,
      [status, runId]
    );
  }

  /**
   * Persist aggregate token/cost totals on the run row (FR-9).
   * Called by the orchestrator once per run (success or best-effort on failure).
   */
  async updateRunCost(runId, { totalTokens, totalCost }) {
    await pool.query(
      `UPDATE runs SET total_tokens = $1, total_cost = $2 WHERE id = $3`,
      [totalTokens, totalCost, runId]
    );
  }

  /**
   * Return cost/token summary for a run — used by GET /runs/:runId/cost.
   */
  async getRunCost(runId) {
    const result = await pool.query(
      `SELECT id, status, workflow_type, total_tokens, total_cost, created_at, completed_at
       FROM runs WHERE id = $1`,
      [runId]
    );
    if (result.rows.length === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
    const row = result.rows[0];
    return {
      runId: row.id,
      status: row.status,
      workflowType: row.workflow_type,
      totalTokens: row.total_tokens,
      totalCost: row.total_cost,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }

  async recordAgentStep({
    runId,
    agentName,
    stepOrder,
    input,
    output = null,
    status,
    errorMessage = null,
    toolsCalled = [],
    chunksUsed = [],
    tokensUsed = 0,
    cost = 0,
  }) {
    const result = await pool.query(
      `INSERT INTO agent_steps
         (run_id, agent_name, step_order, input, output, tools_called, chunks_used,
          tokens_used, cost, status, error_message, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               CASE WHEN $10 IN ('completed','failed') THEN now() ELSE NULL END)
       RETURNING id`,
      [
        runId,
        agentName,
        stepOrder,
        JSON.stringify(input),
        output ? JSON.stringify(output) : null,
        JSON.stringify(toolsCalled),
        JSON.stringify(chunksUsed),
        tokensUsed,
        cost,
        status,
        errorMessage,
      ]
    );
    return result.rows[0].id;
  }

  async createApproval({ runId, proposedAction }) {
    const result = await pool.query(
      `INSERT INTO approvals (run_id, proposed_action, status)
       VALUES ($1, $2, 'pending')
       RETURNING id`,
      [runId, JSON.stringify(proposedAction)]
    );
    return result.rows[0].id;
  }

  async decideApproval({ approvalId, status, approvedBy, comment, finalAction }) {
  await pool.query(
    `UPDATE approvals SET status = $1, approved_by = $2, comment = $3, final_action = $4, decided_at = now() WHERE id = $5`,
    [status, approvedBy, comment, finalAction ? JSON.stringify(finalAction) : null, approvalId]
  );
}

async getApprovalById(approvalId) {
  const result = await pool.query(
    `SELECT id, run_id, status, proposed_action FROM approvals WHERE id = $1`,
    [approvalId]
  );
  if (result.rows.length === 0) {
    throw new Error(`Approval not found: ${approvalId}`);
  }
  const row = result.rows[0];
  return {
    id: row.id,
    runId: row.run_id,
    status: row.status,
    proposedAction: row.proposed_action,
  };
}
}

module.exports = RunRepository;