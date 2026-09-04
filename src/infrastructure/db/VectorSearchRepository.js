const pool = require('./postgresClient');

class VectorSearchRepository {

  /**
   * Dense semantic search using pgvector.
   *
   * options:
   * {
   *   limit: 10,
   *   documentId?: number,
   *   manualVersion?: string
   * }
   */
  async searchByVector(queryEmbedding, options = {}) {
    const {
      limit = 10,
      documentId,
      manualVersion
    } = options;

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('Invalid query embedding');
    }

    const vectorString = `[${queryEmbedding.join(',')}]`;

    const conditions = [];
    const params = [vectorString];

    if (documentId !== undefined) {
      params.push(documentId);
      conditions.push(`c.document_id = $${params.length}`);
    }

    if (manualVersion !== undefined) {
      params.push(manualVersion);
      conditions.push(`d.manual_version = $${params.length}`);
    }

    params.push(limit);

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const result = await pool.query(
      `
      SELECT
        c.id,
        c.content,
        c.section,
        c.page_number,
        c.document_id,
        d.title,
        d.manual_version,

        1 - (c.embedding <=> $1::vector) AS similarity

      FROM chunks c

      JOIN documents d
        ON d.id = c.document_id

      ${whereClause}

      ORDER BY
        c.embedding <=> $1::vector ASC,
        c.id ASC

      LIMIT $${params.length}
      `,
      params
    );

    return result.rows;
  }


  /**
   * Keyword search using PostgreSQL Full Text Search.
   */
  async searchByKeyword(queryText, options = {}) {
    const {
      limit = 10,
      documentId,
      manualVersion
    } = options;

    if (!queryText || !queryText.trim()) {
      return [];
    }

    const conditions = [];
    const params = [queryText];

    if (documentId !== undefined) {
      params.push(documentId);
      conditions.push(`c.document_id = $${params.length}`);
    }

    if (manualVersion !== undefined) {
      params.push(manualVersion);
      conditions.push(`d.manual_version = $${params.length}`);
    }

    params.push(limit);

    const whereClause =
      conditions.length > 0
        ? `
          AND ${conditions.join(' AND ')}
        `
        : '';

    const result = await pool.query(
      `
      SELECT
        c.id,
        c.content,
        c.section,
        c.page_number,
        c.document_id,
        d.title,
        d.manual_version,

        ts_rank_cd(
          c.search_vector,
          websearch_to_tsquery('english', $1)
        ) AS rank

      FROM chunks c

      JOIN documents d
        ON d.id = c.document_id

      WHERE
        c.search_vector
        @@ websearch_to_tsquery('english', $1)

      ${whereClause}

      ORDER BY
        rank DESC,
        c.id ASC

      LIMIT $${params.length}
      `,
      params
    );

    return result.rows;
  }
}

module.exports = VectorSearchRepository;