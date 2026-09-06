const pool = require('./postgresClient');

class WorkOrderRepository {
  async saveWorkOrder({ runId, approvalId, workOrder }) {
    const result = await pool.query(
      `INSERT INTO work_orders (run_id, approval_id, equipment_id, manual_version, diagnostic_steps, safety_prerequisites, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft')
       RETURNING id`,
      [
        runId,
        approvalId,
        workOrder.equipmentId,
        workOrder.manualVersion,
        JSON.stringify(workOrder.diagnosticSteps),
        JSON.stringify(workOrder.safetyPrerequisites),
      ]
    );
    return result.rows[0].id;
  }
}

module.exports = WorkOrderRepository;