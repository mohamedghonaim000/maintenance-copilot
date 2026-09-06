/**
 * DocumentRepository Port (interface)
 *
 * Any concrete storage implementation (Postgres, etc.) must implement
 * these methods. The application layer depends on this shape only.
 */
class DocumentRepository {
  async saveDocument({ title, source, fileType, manualVersion, contentHash, equipmentId }) {
    throw new Error('DocumentRepository.saveDocument() must be implemented');
  }

  async markDocumentStatus(documentId, status, failureReason) {
    throw new Error('DocumentRepository.markDocumentStatus() must be implemented');
  }

  async saveChunk({ documentId, content, section, embedding }) {
    throw new Error('DocumentRepository.saveChunk() must be implemented');
  }

  async findByContentHash(contentHash) {
    throw new Error('DocumentRepository.findByContentHash() must be implemented');
  }

  async updateEquipmentId(documentId, equipmentId) {
    throw new Error('DocumentRepository.updateEquipmentId() must be implemented');
  }
}

module.exports = DocumentRepository;
