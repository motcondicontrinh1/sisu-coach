require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENCODE_API_KEY,
  baseURL: 'https://opencode.ai/zen/go/v1',
});

(async () => {
  const res = await client.chat.completions.create({
    model: 'qwen3.6-plus',
    messages: [{ role: 'user', content: 'Say hi.' }],
    max_tokens: 20,
  });

  // Dump full response structure
  console.log(JSON.stringify(res, null, 2));
})();
