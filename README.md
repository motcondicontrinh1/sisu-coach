# Sisu — AI Endurance Coach via Telegram

A personal AI coach that knows your Strava training data and talks to you over Telegram. Powered by open models (Qwen, Kimi, etc.) via **OpenCode Go Plan**.

```
Strava → Composio webhook → Your Server → Supabase (stores activities)
                                          → OpenCode AI (coaching brain)
                                          → Telegram (chat interface)
```

## Setup (15 minutes)

### 1. Supabase (free database)
1. Go to [supabase.com](https://supabase.com) → Sign up → New Project
2. Wait ~60 seconds for it to provision
3. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **service_role key** (under "Project API keys", click 👁 to reveal)

### 2. Run the database migration
1. In Supabase Dashboard → **SQL Editor**, paste the contents of `migrations.sql`
2. Hit **Run**. This creates the `activities` table.

### 3. Telegram Bot (free)
1. Open Telegram → search **@BotFather** → start chat
2. Send `/newbot` → follow prompts (name + username ending in `bot`)
3. BotFather replies with a **token** (looks like `123456:ABC-DEF...`)
4. Copy it

### 4. OpenCode Go Plan
1. Sign up at [opencode.ai](https://opencode.ai) and get your API key
2. Note which model IDs you can use (e.g. `qwen3.6plus`, `kimi-2.6`)

### 5. Composio (Strava → webhook bridge)
1. Sign up at [composio.dev](https://composio.dev)
2. Go to **Toolkits** → search **Strava** → **Add to project** → **Create Auth Config**
3. **Connect Account** → log in to Strava → authorize
4. Go to **Settings → API Keys** → **Generate New API Key** → copy it

### 6. Create your .env file
```bash
cp .env.example .env
```

Fill in the 6 values:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_WEBHOOK_SECRET=any-random-string-you-make-up
OPENCODE_API_KEY=your-opencode-key
MODEL_NAME=qwen3.6plus
COMPOSIO_API_KEY=your-composio-key
COMPOSIO_WEBHOOK_SECRET=another-random-string
```

### 7. Install & run locally
```bash
npm install
npm start
```

### 8. Deploy (Railway / Render / Fly.io)

**Railway (easiest):**
1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. In your project settings → **Variables**, add all the `.env` values
4. Railway gives you a **public URL** (e.g. `https://sisu-coach-production.up.railway.app`)

**Then wire up the webhooks:**

#### Telegram webhook
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR-RAILWAY-URL/webhook/telegram", "secret_token": "YOUR_TELEGRAM_WEBHOOK_SECRET"}'
```

#### Strava webhook (via Composio)
1. Go to Composio → your Strava toolkit → **Triggers**
2. Configure it to POST to: `https://YOUR-RAILWAY-URL/webhook/strava/YOUR_COMPOSIO_WEBHOOK_SECRET`
3. Select the `activity.created` trigger (fires when you finish an activity)

### 9. Test it
1. Go for a run 🏃
2. When Strava syncs, Composio sends the data to your server → saved in Supabase
3. Message your Telegram bot: `how should I structure tomorrow?`
4. The AI replies with coaching based on your actual training data

## Total monthly cost
| Service | Cost |
|---------|------|
| Supabase | Free |
| Telegram | Free |
| Strava | Free |
| Composio | Free tier |
| Railway | ~$5/mo |
| OpenCode Go Plan | depends on usage |

**Total: ~$5-15/mo**

## Make it yours — add more data

Drop these into the same project:

- **Oura / Whoop** → sleep, HRV, readiness
- **Garmin** → lap splits, HR zones
- **Weather API** → Claude should know if tomorrow's run is forecast 95°F
- **Nutrition logging** → `/ate chicken + rice` → saved to Supabase

Each one is: _"Add [service] to the existing project. Pull [data type]. Include it in getCoachingResponse()."_
