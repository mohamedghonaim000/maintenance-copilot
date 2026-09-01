require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const result = await model.generateContent('say any thing toprove that the model worke well');
  console.log(result.response.text());
}

testGemini().catch((err) => console.error('Error:', err.message));