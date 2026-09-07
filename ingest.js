require('dotenv').config();
const PostgresDocumentRepository = require('./src/infrastructure/db/PostgresDocumentRepository');
const { getLLMProvider } = require('./src/config/providerConfig');
const IngestDocument = require('./src/application/use-cases/IngestDocument');

async function main() {
  const repo = new PostgresDocumentRepository();
  const provider = getLLMProvider();
  const ingest = new IngestDocument(repo, provider);

  const files = [
    './sample-corpus/pump_manual_variants.txt',
    './sample-corpus/pump_manual_variants.txt',
    './sample-corpus/compressor_manual_incomplete.txt',
  ];

  for (const file of files) {
    const results = await ingest.run(file, 'sample-corpus');
    console.log(file, '→', JSON.stringify(results, null, 2));
  }
}

main().catch(console.error);