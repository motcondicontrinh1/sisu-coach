require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// ─── Config ───────────────────────────────────────────────────────────
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET,
  OPENCODE_API_KEY,
  MODEL_NAME = 'qwen3.6-plus',          // change to kimi-k2.6 or minimax-m2.7
  COMPOSIO_WEBHOOK_SECRET = crypto.randomUUID(),
  PORT = process.env.PORT || 3000,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TELEGRAM_BOT_TOKEN || !OPENCODE_API_KEY) {
  console.error('❌ Missing required env vars. Check .env against .env.example');
  process.exit(1);
}

// ─── Clients ──────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const openai = new OpenAI({
  apiKey: OPENCODE_API_KEY,
  baseURL: 'https://opencode.ai/zen/go/v1',
});

const TELEGRAM_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// ─── Express ──────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// ─── GET /health ──────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// ─── POST /webhook/strava  (Composio → your server) ──────────────────
app.post('/webhook/strava', async (req, res) => {
  try {
    // Optional: verify shared secret in URL path
    const secret = req.params.secret;
    if (COMPOSIO_WEBHOOK_SECRET && secret && secret !== COMPOSIO_WEBHOOK_SECRET) {
      console.warn('⚠️  Strava webhook secret mismatch');
      return res.status(401).json({ error: 'unauthorized' });
    }

    const payload = req.body;
    // Composio wraps the activity inside different possible shapes.
    // Try to extract the core activity object.
    const activity = payload.activity || payload.data?.activity || payload;

    if (!activity || !activity.id) {
      console.warn('⚠️  Strava webhook: no activity id found', JSON.stringify(payload).slice(0, 200));
      return res.status(400).json({ error: 'no activity id' });
    }

    const stravaId = Number(activity.id);
    const { data: existing } = await supabase
      .from('activities')
      .select('strava_id')
      .eq('strava_id', stravaId)
      .single();

    if (existing) {
      console.log(`🔄 Activity ${stravaId} already exists, skipping`);
      return res.json({ status: 'duplicate' });
    }

    const row = {
      strava_id: stravaId,
      type: activity.type || 'Unknown',
      distance_m: activity.distance,
      moving_time_s: activity.moving_time,
      elapsed_time_s: activity.elapsed_time,
      total_elevation_gain_m: activity.total_elevation_gain,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      average_speed_ms: activity.average_speed,
      max_speed_ms: activity.max_speed,
      started_at: activity.start_date || activity.start_date_local,
      name: activity.name,
      description: activity.description,
      raw: payload,
    };

    const { error } = await supabase.from('activities').insert(row);
    if (error) {
      console.error('❌ Supabase insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✅ Saved activity #${stravaId}: ${row.type} — ${formatDistance(row.distance_m)}`);
    res.json({ status: 'saved', strava_id: stravaId });
  } catch (err) {
    console.error('💥 Strava webhook error:', err.message);
    res.status(200).json({ error: 'internal' });  // 200 so Composio doesn't retry forever
  }
});

// ─── POST /webhook/telegram  (Telegram → your server) ────────────────
app.post('/webhook/telegram', async (req, res) => {
  try {
    // Verify Telegram secret token
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    if (TELEGRAM_WEBHOOK_SECRET && secretToken !== TELEGRAM_WEBHOOK_SECRET) {
      console.warn('⚠️  Telegram webhook secret mismatch');
      return res.status(401).json({ error: 'unauthorized' });
    }

    const update = req.body;
    const message = update.message;
    if (!message || !message.text) return res.status(200).json({ status: 'ignored' });

    const chatId = message.chat.id;
    const userText = message.text.trim();

    console.log(`💬 Telegram from ${chatId}: "${userText.slice(0, 80)}"`);

    const reply = await getCoachingResponse(userText);
    await telegramSend(chatId, reply);

    res.status(200).json({ status: 'replied' });
  } catch (err) {
    console.error('💥 Telegram webhook error:', err.message);
    res.status(200).json({ error: 'internal' });  // 200 so Telegram doesn't retry
  }
});

// ─── AI Coaching ──────────────────────────────────────────────────────
async function getCoachingResponse(userText) {
  // 1. Pull last 14 days of activities
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: activities, error } = await supabase
    .from('activities')
    .select('*')
    .gte('started_at', fourteenDaysAgo.toISOString())
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Supabase query error:', error.message);
    return "Sorry, I couldn't load your training data right now. Try again in a moment.";
  }

  // 2. Build plain-text summary
  let summary = 'Recent Training (last 14 days):\n\n';
  if (!activities || activities.length === 0) {
    summary += '(no activities found — go for a run!)\n\n';
  } else {
    summary += `Total activities: ${activities.length}\n`;
    summary += activities
      .map((a) => {
        const date = a.started_at ? new Date(a.started_at).toLocaleDateString() : 'unknown date';
        const dist = formatDistance(a.distance_m);
        const time = formatTime(a.moving_time_s);
        const pace = formatPace(a.distance_m, a.moving_time_s);
        const hr = a.average_heartrate ? `♥ avg ${a.average_heartrate} bpm` : '';
        const elev = a.total_elevation_gain_m ? `↑ ${a.total_elevation_gain_m.toFixed(0)}m` : '';
        return `  ${date}  ${a.type}  ${dist}  ${time}  ${pace}  ${hr}  ${elev}`.trim();
      })
      .join('\n');
  }

  // 3. Call OpenCode AI
  const systemPrompt = `You are Sisu, an expert endurance coach.
Give concrete, personalized advice based on the athlete's recent training data.
Be direct, specific, and motivating. Use imperial units (miles, minutes/mile).
Keep responses concise — 3-5 short paragraphs max.
If no recent training data is shown, encourage the athlete to get moving.`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${summary}\n\nAthlete says: ${userText}` },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    return completion.choices[0].message.content || '(no response from AI)';
  } catch (err) {
    console.error('AI API error:', err.message);
    return `I had trouble thinking right now (AI error: ${err.message}). But based on your recent data: ${activities?.length || 0} activities in 14 days. Keep going! 💪`;
  }
}

// ─── Telegram helpers ─────────────────────────────────────────────────
async function telegramSend(chatId, text) {
  try {
    // Telegram message limit is 4096 chars; split if needed
    const chunks = splitMessage(text, 4000);
    for (const chunk of chunks) {
      await fetch(`${TELEGRAM_BASE}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'Markdown' }),
      });
    }
  } catch (err) {
    console.error('Failed to send Telegram message:', err.message);
  }
}

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  while (text.length > maxLen) {
    let splitIdx = text.lastIndexOf('\n', maxLen);
    if (splitIdx === -1 || splitIdx < maxLen * 0.5) splitIdx = maxLen;
    chunks.push(text.slice(0, splitIdx).trim());
    text = text.slice(splitIdx).trim();
  }
  if (text) chunks.push(text);
  return chunks;
}

// ─── Format helpers ───────────────────────────────────────────────────
function formatDistance(meters) {
  if (!meters) return '—';
  return `${(meters * 0.000621371).toFixed(2)} mi`;
}

function formatTime(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatPace(meters, seconds) {
  if (!meters || !seconds || meters === 0) return '';
  const pacePerMile = seconds / (meters * 0.000621371);
  const m = Math.floor(pacePerMile / 60);
  const s = Math.floor(pacePerMile % 60);
  return `${m}:${s.toString().padStart(2, '0')}/mi`;
}

// ─── Set Telegram webhook on startup ──────────────────────────────────
async function setupTelegramWebhook(baseUrl) {
  const webhookUrl = `${baseUrl}/webhook/telegram`;
  try {
    const resp = await fetch(`${TELEGRAM_BASE}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: TELEGRAM_WEBHOOK_SECRET,
      }),
    });
    const data = await resp.json();
    if (data.ok) {
      console.log(`✅ Telegram webhook → ${webhookUrl}`);
    } else {
      console.error('❌ Telegram setWebhook failed:', data.description);
    }
  } catch (err) {
    console.error('❌ Could not set Telegram webhook:', err.message);
  }
}

// ─── Start ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏋️  Sisu Coach running on port ${PORT}`);

  // If we have a PUBLIC_URL (set by Railway or manually), wire up Telegram
  const publicUrl = process.env.PUBLIC_URL;
  if (publicUrl) {
    setupTelegramWebhook(publicUrl);
  } else {
    console.log('⚠️  No PUBLIC_URL set. Telegram webhook not configured yet.');
    console.log('   Set PUBLIC_URL=https://your-domain.com in .env and restart.');
  }
});
