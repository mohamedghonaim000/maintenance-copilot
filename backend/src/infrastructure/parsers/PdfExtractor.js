const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function extractFromPdf(filePath) {
    const dataBuffer = fs.readFileSync(filePath);

    const parser = new PDFParse({
        data: dataBuffer
    });

    const result = await parser.getText();

    await parser.destroy();

    const text = result.text
        .replace(/\r\n/g, '\n')
        .trim();

    const versionRegex = /^=== VERSION (.+?) ===$/gm;

    const matches = [...text.matchAll(versionRegex)];

    // Single-version PDF
    if (matches.length === 0) {
        return [
            {
                versionLabel: null,
                rawText: text
            }
        ];
    }

    // Multi-version PDF
    const documents = [];

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];

        const start = match.index + match[0].length;

        const end =
            i + 1 < matches.length
                ? matches[i + 1].index
                : text.length;

        let rawText = text
            .slice(start, end)
            .trim();

        // Extract actual manual version
        const manualVersionMatch =
            rawText.match(/^Manual Version:\s*(.+)$/m);

        const versionLabel =
            manualVersionMatch
                ? manualVersionMatch[1].trim()
                : match[1].trim();

        documents.push({
            versionLabel,
            rawText
        });
    }

    return documents;
}

module.exports = { extractFromPdf };