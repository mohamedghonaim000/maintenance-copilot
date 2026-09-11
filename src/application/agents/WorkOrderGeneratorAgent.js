const {
  WorkOrderGeneratorInput,
  WorkOrderGeneratorOutput,
} = require('../contracts/agentSchemas');
const WorkOrder = require('../../domain/entities/WorkOrder');

class WorkOrderGeneratorAgent {
  /**
   * Unlike the previous two agents, this one has no external
   * dependencies (no LLM call, no retrieval) — its job is purely to
   * assemble validated inputs into a domain entity. It is deliberately
   * "dumb": no interpretation, no generation, just structured assembly.
   * This is itself a safety property: nothing here can hallucinate.
   */
  async run(rawInput) {
    const input = WorkOrderGeneratorInput.parse(rawInput);

    // Constructing the domain entity re-enforces the safety rule at the
    // deepest layer: even if this agent were called directly with bad
    // data bypassing the Zod schema somehow, WorkOrder itself refuses
    // to exist without safetyPrerequisites (see Phase 2).
    const workOrder = new WorkOrder({
      equipmentId: input.equipmentId,
      manualVersion: input.manualVersion,
      diagnosticSteps: input.diagnosticSteps,
      safetyPrerequisites: input.safetyPrerequisites,
    });

    const output = {
      equipmentId: workOrder.equipmentId,
      manualVersion: workOrder.manualVersion,
      diagnosticSteps: workOrder.diagnosticSteps,
      safetyPrerequisites: workOrder.safetyPrerequisites,
      status: workOrder.status, // 'draft' — always, per the WorkOrder entity
    };

    // WorkOrderGenerator makes no LLM calls — pure deterministic assembly.
    // Attach zeros so the orchestrator receives a consistent { tokensUsed, cost } shape.
    const parsed = WorkOrderGeneratorOutput.parse(output);
    return Object.assign(parsed, { tokensUsed: 0, cost: 0 });
  }
}

module.exports = WorkOrderGeneratorAgent;