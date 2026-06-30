const https = require('https');
const fs = require('fs');

const envPath = require('path').resolve(__dirname, '../.env.local');
const envStr = fs.readFileSync(envPath, 'utf8');
const keyMatch = envStr.match(/GEMINI_API_KEY=(.+)/);
if (!keyMatch) {
  console.error("No API key found in .env.local");
  process.exit(1);
}
const apiKey = keyMatch[1].trim();

https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.models) {
        console.log("AVAILABLE MODELS:");
        json.models.forEach(m => console.log(m.name));
      } else {
        console.log("Response:", json);
      }
    } catch (e) {
      console.error("Error parsing response:", e);
    }
  });
}).on('error', e => console.error(e));
