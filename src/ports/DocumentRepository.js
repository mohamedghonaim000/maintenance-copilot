/**
 * DocumentRepository Port (interface)
 *
 * Any concrete storage implementation (Postgres, etc.) must implement
 * these methods. The application layer depends on this shape only.
 */
class DocumentRepository {
  async saveDocument({ title, source, fileType, manualVersion }) {
    throw new Error('DocumentRepository.saveDocument() must be implemented');
  }

  async markDocumentStatus(documentId, status, failureReason) {
    throw new Error('DocumentRepository.markDocumentStatus() must be implemented');
  }

  async saveChunk({ documentId, content, section, embedding }) {
    throw new Error('DocumentRepository.saveChunk() must be implemented');
  }
}

module.exports = DocumentRepository;