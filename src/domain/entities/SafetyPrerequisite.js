 class SafetyPrerequisite {
  constructor({ description, mandatory = true }) {
    if (!description || description.trim().length === 0) {
      throw new Error('SafetyPrerequisite must have a description');
    }
    this.description = description;
    this.mandatory = mandatory;
  }
}

module.exports = SafetyPrerequisite;