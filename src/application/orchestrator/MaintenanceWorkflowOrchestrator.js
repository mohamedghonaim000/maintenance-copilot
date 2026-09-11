const crypto = require('crypto');
const { retryWithBackoff, withTimeout } = require('./resilience');

const MAX_ITERATIONS = 5;
const STEP_TIMEOUT_MS = 30000;

// Errors that indicate bad/insufficient input, not a transient failure —
// retrying them wastes time and tokens without changing the outcome.
function isTransientError(err) {
  const nonRetryableNames = ['LowConfidenceMatchError', 'ZodError'];
  if (nonRetryableNames.includes(err.name)) return false;
  if (err.message?.includes('Refusing to proceed')) return false;
  return true;
}

class MaintenanceWorkflowOrchestrator {
  constructor({
    symptomMatcher,
    diagnosticSafetyPlanner,
    workOrderGenerator,
    runRepository,
  }) {
    this.symptomMatcher = symptomMatcher;
    this.diagnosticSafetyPlanner = diagnosticSafetyPlanner;
    this.workOrderGenerator = workOrderGenerator;
    this.runRepository = runRepository;
  }

  async runWorkflow({ symptomDescription, initiatedBy = null, sessionId = null }) {
    const correlationId = crypto.randomUUID();
    const runId = await this.runRepository.createRun({
      correlationId,
      workflowType: 'maintenance_workflow',
      initiatedBy,
      sessionId,
    });

    let iterationCount = 0;
    // Accumulators for run-level cost observability (FR-9)
    let totalTokens = 0;
    let totalCost = 0;

    try {
      // ---- Step 1: Symptom Matcher ----
      iterationCount++;
      if (iterationCount > MAX_ITERATIONS) {
        throw new Error('Max iteration limit reached for this workflow run.');
      }

      const matchResult = await this._runStep({
        runId,
        agentName: 'SymptomMatcher',
        stepOrder: 1,
        input: { symptomDescription },
        fn: () => this.symptomMatcher.run({ symptomDescription }),
        onStepCost: (tokens, cost) => {
          totalTokens += tokens;
          totalCost += cost;
        },
      });

      // ---- Step 2: Diagnostic & Safety Planner ----
      iterationCount++;
      if (iterationCount > MAX_ITERATIONS) {
        throw new Error('Max iteration limit reached for this workflow run.');
      }

      const plannerInput = {
        equipmentId: matchResult.equipmentId,
        manualVersion: matchResult.manualVersion,
        symptomDescription,
      };

      const planResult = await this._runStep({
        runId,
        agentName: 'DiagnosticSafetyPlanner',
        stepOrder: 2,
        input: plannerInput,
        fn: () => this.diagnosticSafetyPlanner.run(plannerInput),
        onStepCost: (tokens, cost) => {
          totalTokens += tokens;
          totalCost += cost;
        },
      });

      // ---- Step 3: Work Order Generator ----
      iterationCount++;
      if (iterationCount > MAX_ITERATIONS) {
        throw new Error('Max iteration limit reached for this workflow run.');
      }

      const workOrderInput = {
        equipmentId: matchResult.equipmentId,
        manualVersion: matchResult.manualVersion,
        diagnosticSteps: planResult.diagnosticSteps,
        safetyPrerequisites: planResult.safetyPrerequisites,
      };

      const workOrderResult = await this._runStep({
        runId,
        agentName: 'WorkOrderGenerator',
        stepOrder: 3,
        input: workOrderInput,
        fn: () => this.workOrderGenerator.run(workOrderInput),
        onStepCost: (tokens, cost) => {
          totalTokens += tokens;
          totalCost += cost;
        },
      });

      // ---- Approval Gate: the work order is a DRAFT until a human approves it ----
      const approvalId = await this.runRepository.createApproval({
        runId,
        proposedAction: workOrderResult,
      });

      await this.runRepository.updateRunStatus(runId, 'awaiting_approval');

      // Persist run-level cost totals for FR-9 observability
      await this.runRepository.updateRunCost(runId, { totalTokens, totalCost });

      return {
        runId,
        correlationId,
        status: 'awaiting_approval',
        approvalId,
        proposedWorkOrder: workOrderResult,
      };
    } catch (err) {
      await this.runRepository.updateRunStatus(runId, 'failed');
      // Best-effort: persist whatever cost was accumulated before failure
      await this.runRepository.updateRunCost(runId, { totalTokens, totalCost }).catch(() => {});
      return {
        runId,
        correlationId,
        status: 'failed',
        error: err.message,
      };
    }
  }

  async _runStep({ runId, agentName, stepOrder, input, fn, onStepCost }) {
    try {
      const output = await withTimeout(
        retryWithBackoff(fn, { maxRetries: 2, isRetryable: isTransientError }),
        STEP_TIMEOUT_MS,
        agentName
      );

      // Read token/cost metadata attached by the agent after schema.parse()
      const tokensUsed = output.tokensUsed ?? 0;
      const cost = output.cost ?? 0;

      await this.runRepository.recordAgentStep({
        runId,
        agentName,
        stepOrder,
        input,
        output,
        status: 'completed',
        tokensUsed,
        cost,
      });

      // Notify the caller so run-level totals can be accumulated
      if (onStepCost) onStepCost(tokensUsed, cost);

      return output;
    } catch (err) {
      await this.runRepository.recordAgentStep({
        runId,
        agentName,
        stepOrder,
        input,
        status: 'failed',
        errorMessage: err.message,
        tokensUsed: 0,
        cost: 0,
      });
      throw err;
    }
  }
}

module.exports = MaintenanceWorkflowOrchestrator;