const pool = require("./postgresClient");

class SessionRepository {
  async createSession({ userId, title = null }) {
    const result = await pool.query(
      `
      INSERT INTO sessions (user_id, title)
      VALUES ($1, $2)
      RETURNING id, user_id, title, created_at
      `,
      [userId, title]
    );

    return result.rows[0];
  }

  async getSessionsByUser(userId) {
    const result = await pool.query(
      `
      SELECT id, title, created_at
      FROM sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    return result.rows;
  }

  async deleteSession({ sessionId, userId }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Runs reference sessions without ON DELETE CASCADE. Delete the run
      // tree first; child agent steps, approvals, and work orders cascade.
      await client.query(
        `DELETE FROM runs r
         USING sessions s
         WHERE r.session_id = s.id
           AND r.session_id = $1
           AND s.user_id = $2`,
        [sessionId, userId]
      );

      const result = await client.query(
        `DELETE FROM sessions
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [sessionId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Session not found');
      }

      await client.query('COMMIT');
      return { id: result.rows[0].id };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async addMessage({ sessionId, userId, runId = null, role, content }) {
    const result = await pool.query(
      `
      INSERT INTO messages (session_id, run_id, role, content)
      SELECT s.id, $3, $4, $5
      FROM sessions s
      WHERE s.id = $1 AND s.user_id = $2
      RETURNING id, session_id, run_id, role, content, created_at
      `,
      [sessionId, userId, runId, role, content]
    );

    if (result.rows.length === 0) {
      throw new Error('Session not found');
    }

    return result.rows[0];
  }

  async getSessionMessages({ sessionId, userId }) {
    const result = await pool.query(
      `
      SELECT m.id, m.session_id, m.run_id, m.role, m.content, m.created_at
      FROM messages m
      INNER JOIN sessions s
        ON s.id = m.session_id
      WHERE m.session_id = $1
        AND s.user_id = $2
      ORDER BY m.created_at ASC, m.id ASC
      `,
      [sessionId, userId]
    );

    return result.rows;
  }

  async getRunsBySession({ sessionId, userId }) {
    const result = await pool.query(
      `
      SELECT
        r.id,
        r.workflow_type,
        r.status,
        r.created_at,
        r.completed_at
      FROM runs r
      INNER JOIN sessions s
        ON s.id = r.session_id
      WHERE r.session_id = $1
        AND s.user_id = $2
      ORDER BY r.created_at ASC
      `,
      [sessionId, userId]
    );

    return result.rows;
  }
}

module.exports = SessionRepository;