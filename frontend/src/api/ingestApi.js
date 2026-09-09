import { getApiErrorMessage, httpClient } from './httpClient';

export async function ingestDocument(filePath, source) {
  try {
    const response = await httpClient.post(
      '/ingest/path',
      { filePath, ...(source ? { source } : {}) },
      undefined
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to ingest the document.'), { cause: error });
  }
}

export async function ingestDocumentUpload(file, source) {
  try {
    const formData = new FormData();
    const fileWithType = new File(
      [file],
      file.name,
      { type: getMimeType(file.name) }
    );
    formData.append('file', fileWithType);
    if (source) {
      formData.append('source', source);
    }

    const response = await httpClient.post(
      '/ingest/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to ingest the document.'), { cause: error });
  }
}

function getMimeType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const mimeTypes = {
    'txt': 'text/plain',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'csv': 'text/csv',
    'json': 'application/json',
    'md': 'text/markdown',
    'xml': 'application/xml',
    'zip': 'application/zip',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}