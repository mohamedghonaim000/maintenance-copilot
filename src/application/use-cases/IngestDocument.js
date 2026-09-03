const path = require("path");
const crypto = require("crypto");

const {
  extractFromTxt,
} = require("../../infrastructure/parsers/TextExtractor");

const { extractFromPdf } = require("../../infrastructure/parsers/PdfExtractor");

const { cleanText } = require("../../infrastructure/parsers/TextCleaner");

const { chunkBySection } = require("../../infrastructure/parsers/TextChunker");

class IngestDocument {
  constructor(documentRepository, llmProvider) {
    this.documentRepository = documentRepository;
    this.llmProvider = llmProvider;
  }

  async run(filePath, sourceLabel) {
    const ext = path.extname(filePath).toLowerCase();

    let extractedDocs;

    if (ext === ".txt") {
      extractedDocs = extractFromTxt(filePath);
    } else if (ext === ".pdf") {
      extractedDocs = await extractFromPdf(filePath);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    const results = [];

    for (const extracted of extractedDocs) {
      let documentId;

      // Idempotent re-ingestion: skip if this exact content was already ingested
      const contentHash = crypto
        .createHash("sha256")
        .update(extracted.rawText)
        .digest("hex");

      const existing = await this.documentRepository.findByContentHash(contentHash);
      if (existing) {
        console.log(`Skipping duplicate: ${extracted.versionLabel || filePath}`);
        results.push({
          documentId: existing.id,
          status: "skipped_duplicate",
          version: extracted.versionLabel,
        });
        continue;
      }

      try {
        documentId = await this.documentRepository.saveDocument({
          title: extracted.versionLabel || filePath,
          source: sourceLabel,
          fileType: ext.slice(1),
          manualVersion: extracted.versionLabel,
          contentHash,
        });

        const cleaned = cleanText(extracted.rawText);

        const chunks = chunkBySection(cleaned);

        if (chunks.length === 0) {
          throw new Error(
            `No chunks generated for document version: ${
              extracted.versionLabel || "unknown"
            }`,
          );
        }

        for (const chunk of chunks) {
          console.log(`Embedding section: ${chunk.section}`);

          const { embedding } = await this.llmProvider.embed(chunk.content);

          await this.documentRepository.saveChunk({
            documentId,
            content: chunk.content,
            section: chunk.section,
            embedding,
          });
        }
        await this.documentRepository.markDocumentStatus(documentId, "done");

        results.push({
          documentId,
          status: "done",
          version: extracted.versionLabel,
          chunkCount: chunks.length,
        });
      } catch (err) {
        if (documentId) {
          await this.documentRepository.markDocumentStatus(
            documentId,
            "failed",
            err.message,
          );
        }

        results.push({
          documentId,
          status: "failed",
          version: extracted.versionLabel,
          error: err.message,
        });
      }
    }

    return results;
  }
}

module.exports = IngestDocument;