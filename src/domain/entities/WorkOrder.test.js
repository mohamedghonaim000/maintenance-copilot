const WorkOrder = require('./WorkOrder');
const SafetyPrerequisiteSkippedError = require('../errors/SafetyPrerequisiteSkippedError');

describe('WorkOrder', () => {
  const validInput = {
    equipmentId: 'HP-200',
    manualVersion: 'v2.0',
    diagnosticSteps: ['Check pressure gauge'],
    safetyPrerequisites: ['Isolate power before inspection'],
  };

  test('constructs successfully with valid input', () => {
    const workOrder = new WorkOrder(validInput);
    expect(workOrder.status).toBe('draft');
    expect(workOrder.equipmentId).toBe('HP-200');
  });

  test('throws SafetyPrerequisiteSkippedError when safetyPrerequisites is empty', () => {
    expect(() => {
      new WorkOrder({ ...validInput, safetyPrerequisites: [] });
    }).toThrow(SafetyPrerequisiteSkippedError);
  });

  test('throws SafetyPrerequisiteSkippedError when safetyPrerequisites is missing', () => {
    const { safetyPrerequisites, ...withoutSafety } = validInput;
    expect(() => {
      new WorkOrder(withoutSafety);
    }).toThrow(SafetyPrerequisiteSkippedError);
  });

  test('throws when equipmentId is missing', () => {
    const { equipmentId, ...withoutEquipment } = validInput;
    expect(() => new WorkOrder(withoutEquipment)).toThrow('equipmentId');
  });

  test('markDispatched changes status from draft to dispatched', () => {
    const workOrder = new WorkOrder(validInput);
    workOrder.markDispatched();
    expect(workOrder.status).toBe('dispatched');
    expect(workOrder.dispatchedAt).toBeInstanceOf(Date);
  });

  test('markDispatched throws if called twice', () => {
    const workOrder = new WorkOrder(validInput);
    workOrder.markDispatched();
    expect(() => workOrder.markDispatched()).toThrow();
  });
});