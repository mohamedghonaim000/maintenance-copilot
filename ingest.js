require('dotenv').config();
const fs = require('fs');
const path = require('path');
const PostgresDocumentRepository = require('./backend/src/infrastructure/db/PostgresDocumentRepository');
const { getLLMProvider } = require('./backend/src/config/providerConfig');
const IngestDocument = require('./backend/src/application/use-cases/IngestDocument');

const CORPUS_DIR = './sample-corpus';

async function main() {
  const repo = new PostgresDocumentRepository();
  const provider = getLLMProvider();
  const ingest = new IngestDocument(repo, provider);

  const files = fs
    .readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith('.txt') || f.endsWith('.pdf'))
    .map((f) => path.join(CORPUS_DIR, f));

  console.log(`Found ${files.length} file(s) to ingest.\n`);

  const summary = { done: 0, skipped: 0, failed: 0 };

  for (const file of files) {
    console.log(`--- Ingesting: ${file} ---`);
    try {
      const results = await ingest.run(file, 'sample-corpus');
      results.forEach((r) => {
        console.log(`  [${r.status}] ${r.version || file}${r.chunkCount ? ` — ${r.chunkCount} chunks` : ''}${r.error ? ` — ${r.error}` : ''}`);
        if (r.status === 'done') summary.done++;
        else if (r.status === 'skipped_duplicate') summary.skipped++;
        else if (r.status === 'failed') summary.failed++;
      });
    } catch (err) {
      const errorMessage = err.message || err.code || err.name || "Unknown error";
      console.log(`  [ERROR] ${errorMessage}`);
      summary.failed++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Done: ${summary.done} | Skipped (duplicate): ${summary.skipped} | Failed: ${summary.failed}`);
}

main().catch(console.error);
