/**
 * Splits cleaned manual text into chunks by section boundary
 * ("Section N: Title"). This is a deliberate choice over fixed-size
 * chunking: the source manuals have a strict, consistent section
 * structure (Overview / Diagnostics / Safety / Maintenance), and
 * splitting mid-section risks returning a truncated safety section —
 * unacceptable for the D5 domain's core risk (skipped safety step).
 *
 * See docs/adrs/002-chunking-strategy.md for the full justification.
 */
function chunkBySection(cleanedText) {
  const sectionRegex = /(Section \d+: .+)/g;
  const parts = cleanedText.split(sectionRegex).filter((p) => p.trim().length > 0);

  const chunks = [];
  for (let i = 0; i < parts.length; i += 2) {
    const sectionTitle = parts[i]?.trim();
    const sectionBody = parts[i + 1]?.trim();
    if (sectionTitle && sectionBody) {
      chunks.push({
        section: sectionTitle,
        content: `${sectionTitle}\n${sectionBody}`,
      });
    }
  }
  return chunks;
}

module.exports = { chunkBySection };