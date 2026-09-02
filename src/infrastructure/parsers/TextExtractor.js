const fs = require('fs');

/**
 * Extracts raw text from a .txt file, and splits it into separate
 * "documents" if the file contains multiple manual versions
 * (marked with "=== VERSION X ===" headers).
 *
 * Returns an array because one physical file can represent
 * multiple logical documents (e.g. HP-200 v1.0 and v2.0).
 */
function extractFromTxt(filePath) {
  const rawText = fs.readFileSync(filePath, 'utf-8');

  const versionMarkerRegex = /=== VERSION [A-Z] — (.+?) ===/g;
  const matches = [...rawText.matchAll(versionMarkerRegex)];

  if (matches.length === 0) {
    // Single-version document — the whole file is one document.
    return [{ versionLabel: null, rawText: rawText.trim() }];
  }

  // Multi-version file — split into separate chunks per version marker.
  const documents = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
    const sectionText = rawText.slice(start, end).trim();
    documents.push({
      versionLabel: matches[i][1].trim(), // e.g. "HP-200 / v1.0"
      rawText: sectionText,
    });
  }
  return documents;
}

module.exports = { extractFromTxt };