/**
 * Cleans raw extracted text before chunking.
 */
function cleanText(rawText) {
    return rawText
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

module.exports = { cleanText };