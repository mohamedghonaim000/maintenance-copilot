class DiagnosticRun {
  constructor({ equipmentId, symptomDescription, matchConfidence }) {
    this.equipmentId = equipmentId;
    this.symptomDescription = symptomDescription;
    this.matchConfidence = matchConfidence;
    this.diagnosticSteps = [];
  }

  addDiagnosticStep(step) {
    this.diagnosticSteps.push(step);
  }
}

module.exports = DiagnosticRun;