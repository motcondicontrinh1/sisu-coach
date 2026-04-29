require('dotenv').config();
const OpenAI = require('openai');

const API_KEY = process.env.OPENCODE_API_KEY || '';
const MODEL = process.env.MODEL_NAME || 'qwen3.6-plus';

if (!API_KEY) {
  console.error('❌ Set OPENCODE_API_KEY in .env first');
  process.exit(1);
}

const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: 'https://opencode.ai/zen/go/v1',
});

async function test() {
  console.log(`🔗 Testing OpenCode API → https://opencode.ai/zen/go/v1`);
  console.log(`📦 Model: ${MODEL}\n`);

  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: 'Say hello in exactly 3 words.' }],
      max_tokens: 20,
    });

    const reply = res.choices[0].message.content;
    console.log(`✅ Success! Model replied: "${reply}"`);
  } catch (err) {
    console.error(`❌ Failed: ${err.message}`);
    if (err.status) console.error(`   HTTP status: ${err.status}`);
  }
}

test();
