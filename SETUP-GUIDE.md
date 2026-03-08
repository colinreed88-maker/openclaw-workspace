# OpenClaw — Setup Guide

How to set up your own OpenClaw agent on Railway with a Telegram bot and custom tools.

---

## What the Claw Can Do

This is not a chatbot. It is an autonomous agent with real tool access:

- **Full SQL access** — Supabase Service Role Key gives unrestricted read access to your entire database. Structured queries with filters, aggregations, date ranges. Raw SQL when needed.
- **Web search** — Real-time internet search via Tavily. Market research, public data, current rates.
- **GitHub access** — Read files directly from your repos without leaving Telegram.
- **Email** — Draft and send via Resend. Approval-gated (agent presents the draft, only sends after you say "send it").
- **Google Calendar** — Check availability, list events, create events. Also approval-gated.
- **Scheduled tasks** — Recurring cron jobs (daily briefings, weekly reports).
- **RAG / Knowledge base** — Search internal docs, SOPs, policies for qualitative answers.
- **Built-in memory** — OpenClaw persists context across conversations natively.

---

## Architecture

```
Telegram  →  OpenClaw (Railway container)  →  Claude Sonnet 4
                       ↓
                 your-tools plugin
                       ↓
            Supabase · Resend · Google Calendar
            Tavily · GitHub · any API you add
```

- **OpenClaw** — Open-source agent framework. Handles the agent loop, memory, prompt assembly, and Telegram.
- **Railway** — Hosts the container.
- **Plugin** — Your custom TypeScript that registers tools with the OpenClaw API.

---

## Setup Steps

### 1. Create a Telegram Bot

- Message `@BotFather` on Telegram, run `/newbot`, follow prompts. Save the bot token.

### 2. Deploy OpenClaw on Railway

- Go to [railway.com](https://railway.com), create a new project, deploy the OpenClaw template (or Docker image from the OpenClaw repo). Set your env vars in the Railway service settings.

### 3. Set Environment Variables

| Variable | What It Is |
|----------|-----------|
| `TELEGRAM_BOT_TOKEN` | From BotFather |
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENCLAW_MODEL` | e.g., `anthropic/claude-sonnet-4-20250514` |
| `OPENAI_API_KEY` | For OpenClaw memory embeddings |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role key (bypasses RLS) |
| `TAVILY_API_KEY` | For web search (optional) |
| `RESEND_API_KEY` | For email (optional) |
| `RESEND_FROM_ADDRESS` | Sender email address (optional) |
| `ALLOWED_EMAIL_DOMAINS` | Domain allowlist for outbound email (optional) |
| `GOOGLE_CLIENT_ID` | Google Calendar OAuth (optional) |
| `GOOGLE_CLIENT_SECRET` | Google Calendar OAuth (optional) |
| `GOOGLE_REFRESH_TOKEN` | Google Calendar OAuth (optional) |
| `GITHUB_READ_TOKEN` | For reading GitHub repos (optional) |

### 4. Write Your Identity Files

These go in `agent/` inside your plugin. OpenClaw loads them as system context.

| File | Purpose |
|------|---------|
| **SOUL.md** | Personality and voice — how the agent talks |
| **IDENTITY.md** | Role, who the user is, safety guardrails, formatting rules |
| **FINANCIAL.md** | Domain-specific accuracy rules (ours is finance — yours could be anything) |
| **REFERENCE.md** | Data catalog — what tables exist, what tools to use for what, entity/mapping reference |

### 5. Build Your Plugin

Create a plugin directory with this structure:

```
extensions/your-tools/
├── index.ts                    Entry point — registers tools with OpenClaw
├── openclaw.plugin.json        { "id": "your-tools" }
├── package.json                name must match plugin id
├── agent/                      Identity files
├── src/
│   ├── types.ts                OpenClawApi interface
│   ├── db.ts                   Your database client
│   └── tools/                  One file per tool
└── dist/                       Compiled JS
```

Each tool is a file that exports a `definition` (name, description, input schema) and an `execute` function. The entry point (`index.ts`) imports them all and calls `api.registerTool()` for each.

### 6. Deploy the Plugin

- Build locally: `pnpm build`
- Push compiled output to a GitHub repo
- SSH into Railway, clone/pull the repo, copy files to `/data/workspace/.openclaw/extensions/your-tools/`
- Fix ownership: `chown -R 0:0 /data/workspace/.openclaw/extensions/your-tools/`
- Redeploy: `railway redeploy -y`

### 7. Configure OpenClaw

Edit `/data/.openclaw/openclaw.json` on the Railway container:

```json
{
  "tools": {
    "profile": "messaging",
    "allow": ["your-tools"]
  },
  "plugins": {
    "load": {
      "paths": ["/data/workspace/.openclaw/extensions/your-tools"]
    },
    "entries": {
      "your-tools": { "enabled": true }
    }
  }
}
```

---

## Our Tools (for reference)

| Category | Tool | What It Does |
|----------|------|-------------|
| SQL | `query_supabase` | Generic table/RPC query with filters, or raw SQL |
| SQL | `query_ramp_spend` | Ramp card + bill spend, aggregated by vendor/dept/BU/month |
| SQL | `query_sage_gl` | Sage GL detail or monthly dept balances with P&L grouping |
| SQL | `query_toast_data` | Toast POS metrics (sales, labor, menu items) |
| RAG | `query_financial_data` | Qualitative questions routed to intranet RAG endpoint |
| RAG | `retrieve_knowledge_doc` | Knowledge base document search |
| Utility | `retrieve_ramp_invoice` | Fetch a Ramp invoice PDF |
| Web | `search_web` | Tavily web search |
| GitHub | `read_github_file` | Read a file from our GitHub repos |
| Email | `send_email` | Send email via Resend (approval-gated) |
| Calendar | `create_calendar_event` | Create a calendar event (approval-gated) |
| Calendar | `get_calendar_availability` | Check free/busy times |
| Calendar | `list_upcoming_events` | List upcoming calendar events |
| Tasks | `manage_scheduled_tasks` | Create/update/delete cron tasks |
| Approval | `approve_action` | Approve a queued side-effect |
| Approval | `reject_action` | Reject a queued side-effect |

---

## Plugin Source Structure (our implementation)

```
extensions/wade-tools/
├── index.ts                    Registers all 16 tools
├── openclaw.plugin.json        { "id": "wade-tools" }
├── package.json
├── agent/
│   ├── SOUL.md                 Personality — calm, grounded, Southern-influenced
│   ├── IDENTITY.md             Role — CFO assistant, safety rules
│   ├── FINANCIAL.md            Data accuracy rules, query workflows
│   └── REFERENCE.md            50+ Supabase tables, BU/dept/entity mappings
├── src/
│   ├── types.ts                OpenClawApi interface
│   ├── db.ts                   Supabase client (Service Role auth)
│   ├── cache.ts                In-memory TTL cache (1hr default)
│   ├── bu-mapping.ts           Budget dept → Sage dept resolution
│   ├── comp-guard.ts           Compensation data guardrails
│   ├── integrations/
│   │   ├── resend.ts           Email client
│   │   └── google-calendar.ts  Calendar client
│   └── tools/                  One file per tool
└── dist/                       Compiled JS
```

---

## Gotchas

- **File ownership resets on every Railway redeploy.** OpenClaw blocks non-root-owned plugins. SSH in and `chown -R 0:0` after every redeploy.
- **Do NOT set `plugins.allow`** in openclaw.json. Causes circular validation. Leave it unset — empty means auto-allow.
- **`railway redeploy -y`** is reliable. `railway restart` often hangs.
- **PowerShell + Railway SSH** mangles quotes. Use base64 encoding for complex commands.
