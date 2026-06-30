const { GoogleGenerativeAI } = require("@google/generative-ai");

require("dotenv").config({ path: ".env.local" });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  try {
    // The SDK doesn't natively expose listModels easily in some versions, but let's try a direct API call
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await res.json();
    console.log("Available Models:", data.models.map(m => m.name));
  } catch (e) {
    console.error(e);
  }
}
run();
