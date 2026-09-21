class LowConfidenceMatchError extends Error {
  constructor(message = 'Equipment match confidence is below the acceptable threshold') {
    super(message);
    this.name = 'LowConfidenceMatchError';
  }
}

module.exports = LowConfidenceMatchError;