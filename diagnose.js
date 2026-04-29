require('dotenv').config();
const OpenAI = require('openai');
const https = require('https');

const API_KEY = process.env.OPENCODE_API_KEY || '';
console.log(`🔑 API key loaded: ${API_KEY ? API_KEY.slice(0, 8) + '...' + API_KEY.slice(-4) : '❌ EMPTY'}`);
console.log(`📦 Trying model: ${process.env.MODEL_NAME || 'qwen3.6plus'}\n`);

if (!API_KEY || API_KEY.startsWith('your-')) {
  console.error('❌ OPENCODE_API_KEY is not set or still has placeholder value in .env');
  process.exit(1);
}

// Test 1: List available models
async function testListModels() {
  console.log('📋 Test 1: Listing available models...');
  try {
    const client = new OpenAI({ apiKey: API_KEY, baseURL: 'https://opencode.ai/zen/go/v1' });
    const models = await client.models.list();
    console.log('✅ Available models:');
    models.data.forEach(m => console.log(`   • ${m.id}`));
    return models.data.map(m => m.id);
  } catch (err) {
    console.error(`❌ List models failed: ${err.message}`);
    if (err.status) console.error(`   Status: ${err.status}`);
    return [];
  }
}

// Test 2: Try chat with different model name formats
async function testChat(modelName) {
  console.log(`\n💬 Test 2: Chat with model "${modelName}"...`);
  try {
    const client = new OpenAI({ apiKey: API_KEY, baseURL: 'https://opencode.ai/zen/go/v1' });
    const res = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: 'Say hi.' }],
      max_tokens: 10,
    });
    console.log(`✅ Success: "${res.choices[0].message.content}"`);
    return true;
  } catch (err) {
    console.error(`❌ Failed: ${err.message}`);
    return false;
  }
}

// Test 3: Raw fetch to check what the API actually returns
async function testRaw() {
  console.log('\n🔍 Test 3: Raw API probe...');

  // Try models endpoint with raw fetch
  const url = 'https://opencode.ai/zen/go/v1/models';
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Body: ${data.slice(0, 500)}`);
        resolve();
      });
    }).on('error', err => {
      console.error(`   Error: ${err.message}`);
      resolve();
    });
  });
}

(async () => {
  const modelNames = await testListModels();
  await testRaw();

  if (modelNames.length > 0) {
    // Try the first 3 available models
    for (const name of modelNames.slice(0, 3)) {
      const ok = await testChat(name);
      if (ok) break;
    }
  } else {
    // Try common formats
    const attempts = [
      'qwen3.6plus', 'qwen-3.6-plus', 'qwen/qwen-3.6-plus',
      'kimi-2.6', 'kimi-2', 'moonshot/kimi-2.6',
      'qwen-plus', 'qwen-turbo', 'gpt-4o-mini',
    ];
    for (const name of attempts) {
      const ok = await testChat(name);
      if (ok) break;
    }
  }
})();
