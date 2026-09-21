class SessionUseCases {
  constructor(sessionRepository) {
    this.sessionRepository = sessionRepository;
  }

  async createSession({ userId, title = null }) {
    this.requireValue(userId, 'userId');
    if (title !== null && typeof title !== 'string') {
      throw new Error('title must be a string');
    }

    return this.sessionRepository.createSession({ userId, title });
  }

  async getUserSessions(userId) {
    this.requireValue(userId, 'userId');
    return this.sessionRepository.getSessionsByUser(userId);
  }

  async deleteSession({ sessionId, userId }) {
    this.requireValue(sessionId, 'sessionId');
    this.requireValue(userId, 'userId');
    return this.sessionRepository.deleteSession({ sessionId, userId });
  }

  async addMessage({ sessionId, userId, runId = null, role, content }) {
    this.requireValue(sessionId, 'sessionId');
    this.requireValue(userId, 'userId');
    this.requireValue(role, 'role');
    this.requireValue(content, 'content');

    if (!['user', 'assistant', 'system', 'tool'].includes(role)) {
      throw new Error('role must be user, assistant, system, or tool');
    }

    return this.sessionRepository.addMessage({
      sessionId,
      userId,
      runId,
      role,
      content,
    });
  }

  async getSessionMessages({ sessionId, userId }) {
    this.requireValue(sessionId, 'sessionId');
    this.requireValue(userId, 'userId');
    return this.sessionRepository.getSessionMessages({ sessionId, userId });
  }

  async getSessionRuns({ sessionId, userId }) {
    this.requireValue(sessionId, 'sessionId');
    this.requireValue(userId, 'userId');
    return this.sessionRepository.getRunsBySession({ sessionId, userId });
  }

  requireValue(value, name) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${name} is required`);
    }
  }
}

module.exports = SessionUseCases;
