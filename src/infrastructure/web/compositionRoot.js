const { getLLMProvider } = require('../../config/providerConfig');

const VectorSearchRepository = require('../db/VectorSearchRepository');
const PostgresDocumentRepository = require('../db/PostgresDocumentRepository');
const RunRepository = require('../db/RunRepository');
const WorkOrderRepository = require('../db/WorkOrderRepository');

const IngestDocument = require('../../application/use-cases/IngestDocument');
const AskQuestion = require('../../application/use-cases/AskQuestion');
const DecideApproval = require('../../application/use-cases/DecideApproval');

const SymptomMatcherAgent = require('../../application/agents/SymptomMatcherAgent');
const DiagnosticSafetyPlannerAgent = require('../../application/agents/DiagnosticSafetyPlannerAgent');
const WorkOrderGeneratorAgent = require('../../application/agents/WorkOrderGeneratorAgent');
const MaintenanceWorkflowOrchestrator = require('../../application/orchestrator/MaintenanceWorkflowOrchestrator');

/**
 * The composition root: the ONLY place in the entire codebase that
 * wires concrete infrastructure (Postgres, Gemini/Ollama) into the
 * application layer's use cases and agents.
 *
 * Routes never construct their own dependencies — they receive
 * fully-wired use cases from here. This is what makes the acceptance
 * test in the architecture requirements possible: swap an adapter
 * here, and nothing in application/ or domain/ changes.
 */
function buildDependencies() {
  const llmProvider = getLLMProvider();
  const vectorSearchRepository = new VectorSearchRepository();
  const documentRepository = new PostgresDocumentRepository();
  const runRepository = new RunRepository();
  const workOrderRepository = new WorkOrderRepository();

  const ingestDocument = new IngestDocument(documentRepository, llmProvider);
  const askQuestion = new AskQuestion(vectorSearchRepository, llmProvider);
  const decideApproval = new DecideApproval(runRepository, workOrderRepository);

  const orchestrator = new MaintenanceWorkflowOrchestrator({
    symptomMatcher: new SymptomMatcherAgent(vectorSearchRepository, llmProvider),
    diagnosticSafetyPlanner: new DiagnosticSafetyPlannerAgent(vectorSearchRepository, llmProvider),
    workOrderGenerator: new WorkOrderGeneratorAgent(),
    runRepository,
  });

  return {
    ingestDocument,
    askQuestion,
    decideApproval,
    orchestrator,
    runRepository,
    vectorSearchRepository,
    llmProvider,
  };
}

module.exports = { buildDependencies };