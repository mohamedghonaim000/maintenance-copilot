const {
  SymptomMatcherOutput,
  DiagnosticSafetyPlannerOutput,
  WorkOrderGeneratorInput,
  WorkOrderGeneratorOutput,
} = require('./agentSchemas');

describe('agentSchemas — structural safety enforcement', () => {
  test('SymptomMatcherOutput rejects confidence outside 0-1 range', () => {
    const invalid = {
      equipmentId: 'HP-200',
      manualVersion: 'v2.0',
      confidence: 1.5,
      matchedChunkIds: ['abc'],
    };
    expect(() => SymptomMatcherOutput.parse(invalid)).toThrow();
  });

  test('SymptomMatcherOutput accepts valid confidence', () => {
    const valid = {
      equipmentId: 'HP-200',
      manualVersion: 'v2.0',
      confidence: 0.75,
      matchedChunkIds: ['abc'],
    };
    expect(() => SymptomMatcherOutput.parse(valid)).not.toThrow();
  });

  test('DiagnosticSafetyPlannerOutput rejects empty safetyPrerequisites', () => {
    const invalid = {
      diagnosticSteps: ['Check pressure'],
      safetyPrerequisites: [],
      sourceChunkIds: ['abc'],
    };
    expect(() => DiagnosticSafetyPlannerOutput.parse(invalid)).toThrow();
  });

  test('WorkOrderGeneratorInput rejects empty safetyPrerequisites', () => {
    const invalid = {
      equipmentId: 'HP-200',
      manualVersion: 'v2.0',
      diagnosticSteps: ['Check pressure'],
      safetyPrerequisites: [],
    };
    expect(() => WorkOrderGeneratorInput.parse(invalid)).toThrow();
  });

  test('WorkOrderGeneratorOutput rejects a status other than "draft"', () => {
    const invalid = {
      equipmentId: 'HP-200',
      manualVersion: 'v2.0',
      diagnosticSteps: ['Check pressure'],
      safetyPrerequisites: ['Isolate power'],
      status: 'dispatched', // مسموح فقط 'draft' في هذا العقد
    };
    expect(() => WorkOrderGeneratorOutput.parse(invalid)).toThrow();
  });

  test('WorkOrderGeneratorOutput accepts valid draft output', () => {
    const valid = {
      equipmentId: 'HP-200',
      manualVersion: 'v2.0',
      diagnosticSteps: ['Check pressure'],
      safetyPrerequisites: ['Isolate power'],
      status: 'draft',
    };
    expect(() => WorkOrderGeneratorOutput.parse(valid)).not.toThrow();
  });
});