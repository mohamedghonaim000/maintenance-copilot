const pool = require('./postgresClient');
const DocumentRepository = require('../../ports/DocumentRepository');

class PostgresDocumentRepository extends DocumentRepository {
  async saveDocument({ title, source, fileType, manualVersion, contentHash }) {
  const result = await pool.query(
    `INSERT INTO documents (title, source, file_type, manual_version, content_hash, status)
     VALUES ($1, $2, $3, $4, $5, 'processing')
     RETURNING id`,
    [title, source, fileType, manualVersion, contentHash]
  );
  return result.rows[0].id;
}

  async markDocumentStatus(documentId, status, failureReason = null) {
    await pool.query(
      `UPDATE documents SET status = $1, failure_reason = $2 WHERE id = $3`,
      [status, failureReason, documentId]
    );
  }

  async saveChunk({ documentId, content, section, embedding }) {
    const vectorString = `[${embedding.join(',')}]`;
    await pool.query(
      `INSERT INTO chunks (document_id, content, section, embedding)
       VALUES ($1, $2, $3, $4)`,
      [documentId, content, section, vectorString]
    );
  }

  async findByContentHash(contentHash) {
  const result = await pool.query(
    `SELECT id, status FROM documents WHERE content_hash = $1 LIMIT 1`,
    [contentHash]
  );
  return result.rows[0] || null;
}
}

module.exports = PostgresDocumentRepository;