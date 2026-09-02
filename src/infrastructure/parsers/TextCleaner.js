/**
 * Cleans raw extracted text before chunking:
 * - Removes the "=== VERSION X — ... ===" marker line (already captured
 *   as versionLabel by the extractor, no longer needed in the body).
 * - Collapses multiple blank lines into one.
 * - Trims leading/trailing whitespace.
 */
function cleanText(rawText) {
  return rawText
    .replace(/=== VERSION [A-Z] — .+? ===\n?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { cleanText };