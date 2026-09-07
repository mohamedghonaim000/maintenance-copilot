const pool = require('./postgresClient');

class SessionRepository {
  async createSession({ userId, title = null }) {
    const result = await pool.query(
      `INSERT INTO sessions (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at`,
      [userId, title]
    );
    return result.rows[0];
  }

  async getSessionsByUser(userId) {
    const result = await pool.query(
      `SELECT id, title, created_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async getRunsBySession(sessionId) {
    const result = await pool.query(
      `SELECT id, workflow_type, status, created_at, completed_at FROM runs WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    return result.rows;
  }
}

module.exports = SessionRepository;