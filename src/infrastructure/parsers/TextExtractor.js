const fs = require('fs');

function extractFromTxt(filePath) {
  const rawText = fs.readFileSync(filePath, 'utf-8');

  // Extract EQUIPMENT: header before splitting — it lives in the
  // document-level preamble, before any "=== VERSION X ===" marker,
  // so it must be captured once and attached to every version split.
  const equipmentMatch = rawText.match(/^EQUIPMENT:\s*(.+)$/m);
  const equipmentHeaderLine = equipmentMatch ? equipmentMatch[0] : null;

  const versionMarkerRegex = /=== VERSION [A-Z] — (.+?) ===/g;
  const matches = [...rawText.matchAll(versionMarkerRegex)];

  if (matches.length === 0) {
    return [{ versionLabel: null, rawText: rawText.trim() }];
  }

  const documents = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
    let sectionText = rawText.slice(start, end).trim();

    // Re-attach the equipment header so downstream extraction
    // (extractEquipmentId in IngestDocument) can find it in every split.
    if (equipmentHeaderLine && !sectionText.includes('EQUIPMENT:')) {
      sectionText = `${equipmentHeaderLine}\n${sectionText}`;
    }

    documents.push({
      versionLabel: matches[i][1].trim(),
      rawText: sectionText,
    });
  }
  return documents;
}

module.exports = { extractFromTxt };