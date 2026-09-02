const { extractFromTxt } = require('../../infrastructure/parsers/TextExtractor');
const { cleanText } = require('../../infrastructure/parsers/TextCleaner');
const { chunkBySection } = require('../../infrastructure/parsers/TextChunker');

class IngestDocument {
  constructor(documentRepository, llmProvider) {
    this.documentRepository = documentRepository;
    this.llmProvider = llmProvider;
  }

  async run(filePath, sourceLabel) {
    const extractedDocs = extractFromTxt(filePath);
    const results = [];

    for (const extracted of extractedDocs) {
      const documentId = await this.documentRepository.saveDocument({
        title: extracted.versionLabel || filePath,
        source: sourceLabel,
        fileType: 'txt',
        manualVersion: extracted.versionLabel,
      });

      try {
        const cleaned = cleanText(extracted.rawText);
        const chunks = chunkBySection(cleaned);

        for (const chunk of chunks) {
          const { embedding } = await this.llmProvider.embed(chunk.content);
          await this.documentRepository.saveChunk({
            documentId,
            content: chunk.content,
            section: chunk.section,
            embedding,
          });
        }

        await this.documentRepository.markDocumentStatus(documentId, 'done');
        results.push({ documentId, status: 'done', chunkCount: chunks.length });
      } catch (err) {
        await this.documentRepository.markDocumentStatus(documentId, 'failed', err.message);
        results.push({ documentId, status: 'failed', error: err.message });
      }
    }

    return results;
  }
}

module.exports = IngestDocument;