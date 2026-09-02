const SafetyPrerequisiteSkippedError = require('../errors/SafetyPrerequisiteSkippedError');

class WorkOrder {
  constructor({ equipmentId, manualVersion, diagnosticSteps, safetyPrerequisites }) {
    if (!equipmentId) {
      throw new Error('WorkOrder requires an equipmentId');
    }
    if (!manualVersion) {
      throw new Error('WorkOrder requires a manualVersion');
    }
    if (!diagnosticSteps || diagnosticSteps.length === 0) {
      throw new Error('WorkOrder requires at least one diagnostic step');
    }
    if (!safetyPrerequisites || safetyPrerequisites.length === 0) {
      throw new SafetyPrerequisiteSkippedError();
    }

    this.equipmentId = equipmentId;
    this.manualVersion = manualVersion;
    this.diagnosticSteps = diagnosticSteps;
    this.safetyPrerequisites = safetyPrerequisites;
    this.status = 'draft';
  }

  markDispatched() {
    if (this.status !== 'draft') {
      throw new Error(`Cannot dispatch a work order with status "${this.status}"`);
    }
    this.status = 'dispatched';
    this.dispatchedAt = new Date();
  }
}

module.exports = WorkOrder;