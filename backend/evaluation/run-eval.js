require('dotenv').config();
const fs = require('fs');
const path = require('path');
const VectorSearchRepository = require('../src/infrastructure/db/VectorSearchRepository');
const AskQuestion = require('../src/application/use-cases/AskQuestion');
const { getLLMProvider } = require('../src/config/providerConfig');

const REFUSAL_TEXT = 'Not enough information in the corpus to answer this question.';

async function main() {
  const goldenSet = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'golden-set.json'), 'utf-8')
  );

  const searchRepo = new VectorSearchRepository();
  const provider = getLLMProvider();
  const askQuestion = new AskQuestion(searchRepo, provider);

  const results = [];

  for (const testCase of goldenSet) {
    const response = await askQuestion.run(testCase.question);
    const answerLower = response.answer.toLowerCase();

    // 1) Refusal correctness
    const actualRefusal = response.answer.trim() === REFUSAL_TEXT;
    const refusalCorrect = actualRefusal === testCase.expectedRefusal;

    // 2) Retrieval hit-rate: did we retrieve at least one expected document?
    let retrievalHit = testCase.expectedDocumentTitles.length === 0
      ? true // adversarial cases with no expected doc: hit if refused correctly
      : response.citations.some((c) =>
          testCase.expectedDocumentTitles.some((title) =>
            c.documentTitle.toLowerCase().includes(title.toLowerCase())
          )
        );

    // 3) Groundedness: does the answer mention the expected keywords?
    const mustMention = testCase.mustMentionKeywords || [];
    const keywordsFound = mustMention.filter((kw) => answerLower.includes(kw.toLowerCase()));
    const groundednessScore = mustMention.length === 0 ? 1 : keywordsFound.length / mustMention.length;

    // 4) Security check: does the answer avoid forbidden keywords (injection test)?
    const mustNotMention = testCase.mustNotMentionKeywords || [];
    const forbiddenFound = mustNotMention.filter((kw) => answerLower.includes(kw.toLowerCase()));
    const securityPass = forbiddenFound.length === 0;

    results.push({
      id: testCase.id,
      category: testCase.category,
      question: testCase.question,
      refusalCorrect,
      retrievalHit,
      groundednessScore,
      securityPass,
      actualAnswer: response.answer,
    });
  }

  // --- Summary ---
  console.log('\n=== EVALUATION SUMMARY ===\n');
  const total = results.length;
  const refusalAccuracy = results.filter((r) => r.refusalCorrect).length / total;
  const retrievalHitRate = results.filter((r) => r.retrievalHit).length / total;
  const avgGroundedness = results.reduce((sum, r) => sum + r.groundednessScore, 0) / total;
  const securityPassRate = results.filter((r) => r.securityPass).length / total;

  console.log(`Total questions: ${total}`);
  console.log(`Refusal correctness: ${(refusalAccuracy * 100).toFixed(1)}%`);
  console.log(`Retrieval hit-rate: ${(retrievalHitRate * 100).toFixed(1)}%`);
  console.log(`Avg groundedness score: ${(avgGroundedness * 100).toFixed(1)}%`);
  console.log(`Security pass rate: ${(securityPassRate * 100).toFixed(1)}%`);

  console.log('\n=== PER-QUESTION RESULTS ===\n');
  results.forEach((r) => {
    const status = r.refusalCorrect && r.retrievalHit && r.securityPass ? 'true' : 'false';
    console.log(`${status} [${r.id}] (${r.category}) refusalCorrect:${r.refusalCorrect} retrieval:${r.retrievalHit} grounded:${(r.groundednessScore * 100).toFixed(0)}% security:${r.securityPass}`);
  });

  // Save full results for docs/EVALUATION.md later
  fs.writeFileSync(
    path.join(__dirname, 'last-run-results.json'),
    JSON.stringify(results, null, 2)
  );

  console.log(`\nFull results saved to evaluation/last-run-results.json`);
}

main().catch(console.error);