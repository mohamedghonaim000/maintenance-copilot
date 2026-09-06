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
  }) {
    const result = await pool.query(
      `INSERT INTO agent_steps (run_id, agent_name, step_order, input, output, tools_called, chunks_used, status, error_message, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $8 IN ('completed','failed') THEN now() ELSE NULL END)
       RETURNING id`,
      [
        runId,
        agentName,
        stepOrder,
        JSON.stringify(input),
        output ? JSON.stringify(output) : null,
        JSON.stringify(toolsCalled),
        JSON.stringify(chunksUsed),
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
}

module.exports = RunRepository;