const pool = require('./postgresClient');

class VectorSearchRepository {
  /**
   * Dense (semantic) search: finds chunks whose embedding is closest
   * to the query embedding, using cosine distance (pgvector's <=> operator).
   */
  async searchByVector(queryEmbedding, limit = 5) {
    const vectorString = `[${queryEmbedding.join(',')}]`;
    const result = await pool.query(
      `SELECT c.id, c.content, c.section, c.document_id,
              d.title, d.manual_version,
              1 - (c.embedding <=> $1) AS similarity
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       ORDER BY c.embedding <=> $1
       LIMIT $2`,
      [vectorString, limit]
    );
    return result.rows;
  }

  /**
   * Keyword (lexical) search using Postgres full-text search,
   * ranked by relevance (ts_rank).
   */
  async searchByKeyword(queryText, limit = 5) {
    const result = await pool.query(
      `SELECT c.id, c.content, c.section, c.document_id,
              d.title, d.manual_version,
              ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', $1)) AS rank
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      [queryText, limit]
    );
    return result.rows;
  }
}

module.exports = VectorSearchRepository;