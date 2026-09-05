const { z } = require('zod');

// ============ Symptom Matcher ============
const SymptomMatcherInput = z.object({
  symptomDescription: z.string().min(10),
});

const SymptomMatcherOutput = z.object({
  equipmentId: z.string(),
  manualVersion: z.string(),
  confidence: z.number().min(0).max(1),
  matchedChunkIds: z.array(z.string()),
});

// ============ Diagnostic & Safety Planner ============
const DiagnosticSafetyPlannerInput = z.object({
  equipmentId: z.string(),
  manualVersion: z.string(),
  symptomDescription: z.string(),
});

const DiagnosticSafetyPlannerOutput = z.object({
  diagnosticSteps: z.array(z.string()).min(1),
  safetyPrerequisites: z.array(z.string()).min(1),
  sourceChunkIds: z.array(z.string()),
});

// ============ Work Order Generator ============
const WorkOrderGeneratorInput = z.object({
  equipmentId: z.string(),
  manualVersion: z.string(),
  diagnosticSteps: z.array(z.string()),
  safetyPrerequisites: z.array(z.string()).min(1),
});

const WorkOrderGeneratorOutput = z.object({
  equipmentId: z.string(),
  manualVersion: z.string(),
  diagnosticSteps: z.array(z.string()),
  safetyPrerequisites: z.array(z.string()).min(1),
  status: z.literal('draft'),
});

module.exports = {
  SymptomMatcherInput,
  SymptomMatcherOutput,
  DiagnosticSafetyPlannerInput,
  DiagnosticSafetyPlannerOutput,
  WorkOrderGeneratorInput,
  WorkOrderGeneratorOutput,
};