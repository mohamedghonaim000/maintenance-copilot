class SessionUseCases {
  constructor(sessionRepository) {
    this.sessionRepository = sessionRepository;
  }

  async createSession({ userId, title = null }) {
    if (!userId) {
      throw new Error("userId is required");
    }

    return await this.sessionRepository.createSession({
      userId,
      title,
    });
  }

  async getUserSessions(userId) {
    if (!userId) {
      throw new Error("userId is required");
    }

    return await this.sessionRepository.getSessionsByUser(userId);
  }

  async getSessionRuns({ sessionId, userId }) {
    if (!sessionId) {
      throw new Error("sessionId is required");
    }

    if (!userId) {
      throw new Error("userId is required");
    }

    return await this.sessionRepository.getRunsBySession(
      sessionId,
      userId
    );
  }
}

module.exports = SessionUseCases;