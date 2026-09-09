
function chunkBySection(cleanedText) {
  const sectionRegex = /^(?:Section \d+:\s*.+|(\d+)\.\s+[A-Z][A-Za-z ]{2,40})$/gm;

  const matches = [...cleanedText.matchAll(sectionRegex)];

  const chunks = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : cleanedText.length;

    const sectionTitle = match[0].trim();
    const content = cleanedText.slice(start, end).trim();

    chunks.push({
      section: sectionTitle,
      content,
    });
  }

  return chunks;
}

module.exports = { chunkBySection };