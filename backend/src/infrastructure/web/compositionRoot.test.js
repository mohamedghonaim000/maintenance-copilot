// test/compositionRoot.test.js
const { buildDependencies } = require('./compositionRoot');

test('buildDependencies returns all required dependencies', () => {
  const deps = buildDependencies();
  
  expect(deps.ingestDocument).toBeDefined();
  expect(deps.askQuestion).toBeDefined();
  expect(deps.decideApproval).toBeDefined();
  expect(deps.orchestrator).toBeDefined();
  expect(deps.runRepository).toBeDefined();
});

test('orchestrator has all 3 agents', () => {
  const deps = buildDependencies();
  const orch = deps.orchestrator;
  
  expect(orch.symptomMatcher).toBeDefined();
  expect(orch.diagnosticSafetyPlanner).toBeDefined();
  expect(orch.workOrderGenerator).toBeDefined();
});