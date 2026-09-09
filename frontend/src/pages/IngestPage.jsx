import { useState } from 'react';
import { ingestDocument, ingestDocumentUpload } from '../api/ingestApi';

export default function IngestPage() {
  const [filePath, setFilePath] = useState('');
  const [file, setFile] = useState(null);
  const [source, setSource] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadMode, setUploadMode] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      let response;
      if (uploadMode) {
        if (!file) {
          throw new Error('Please select a file');
        }
        response = await ingestDocumentUpload(file, source);
      } else {
        if (!filePath.trim()) {
          throw new Error('File path is required');
        }
        response = await ingestDocument(filePath, source);
      }
      setResult(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function getStatusMessage(item) {
    switch (item.status) {
      case 'done':
        return { text: 'Ingested successfully', color: 'text-green-500' };
      case 'skipped_duplicate':
        return { text: 'Already exists (skipped)', color: 'text-yellow-500' };
      case 'failed':
        return { text: `Failed: ${item.error || 'Unknown error'}`, color: 'text-red-500' };
      default:
        return { text: item.status, color: 'text-text-muted' };
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold">Ingest document</h1>
      
      <div className="mt-4 flex gap-4">
        <button
          type="button"
          onClick={() => setUploadMode(false)}
          className={`px-4 py-2 text-sm font-medium rounded-lg ${
            !uploadMode ? 'bg-accent text-white' : 'bg-surface text-text-muted'
          }`}
        >
          Server path
        </button>
        <button
          type="button"
          onClick={() => setUploadMode(true)}
          className={`px-4 py-2 text-sm font-medium rounded-lg ${
            uploadMode ? 'bg-accent text-white' : 'bg-surface text-text-muted'
          }`}
        >
          Upload file
        </button>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5">
        {!uploadMode ? (
          <label className="block text-sm font-medium">
            Server file path
            <input
              required
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-accent"
            />
          </label>
        ) : (
          <label className="block text-sm font-medium">
            Document file
            <input
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-2 w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-accent"
            />
          </label>
        )}

        <label className="block text-sm font-medium">
          Source <span className="font-normal text-text-muted">(optional)</span>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-accent"
          />
        </label>

        <button
          disabled={submitting || (uploadMode ? !file : !filePath.trim())}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Ingesting…' : 'Ingest document'}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5 rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-medium mb-3">Ingestion Results:</h3>
          {result.results?.map((item, index) => {
            const status = getStatusMessage(item);
            return (
              <div key={index} className="mb-2 p-3 rounded-lg bg-bg border border-border">
                <div className={`text-sm font-medium ${status.color}`}>
                  {status.text}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  <div>Document ID: {item.documentId}</div>
                  {item.version && <div>Version: {item.version}</div>}
                  {item.chunkCount && <div>Chunks: {item.chunkCount}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}