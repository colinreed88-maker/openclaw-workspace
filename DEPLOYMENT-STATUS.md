# Wade-Tools OpenClaw Plugin — Deployment Status

**Date:** March 10, 2026
**Status:** Live and working

---

## What This Is

Wade's financial analysis tools running on OpenClaw (Railway) as a plugin. Available to the full Flow team via Telegram and Flow Intranet.

## Architecture

- **Railway Project:** `f305b857-2af8-4472-9e64-852626e42dfc`
- **Environment:** `6fc8652d-aa26-4c68-a94e-154323cf581e` (production)
- **Service:** `8ee594e5-6592-4d0f-9f2a-48709774eddd` (OpenClaw Main)
- **Plugin Path:** `/data/workspace/.openclaw/extensions/wade-tools/`
- **GitHub Repo:** `colinreed88-maker/openclaw-workspace` (public)
- **Telegram Bot:** `@Colin_claw2026_bot`

## Registered Plugin Tools

| Category | Tools |
|----------|-------|
| Financial Queries | `query_ramp_spend`, `query_sage_gl`, `query_toast_data` |
| Knowledge & Memory | `search_knowledge`, `save_memory`, `search_memories`, `forget_memory` |
| Ingestion | `ingest_slack`, `ingest_calendar`, `ingest_rss`, `ingest_granola`, `query_ingestion_log` |
| Utility | `query_supabase`, `query_financial_data`, `retrieve_knowledge_doc`, `retrieve_ramp_invoice` |
| External | `search_web`, `read_github_file` |
| Communication | `read_slack` |
| Side-effect | `send_email`, `create_calendar_event`, `get_calendar_availability`, `list_upcoming_events`, `manage_scheduled_tasks`, `approve_action`, `reject_action` |

Wade also has access to OpenClaw's built-in core tools (cron, read, pdf, web_fetch, browser, subagents, sessions_spawn, agents_list, image, canvas, nodes, tts, web_search) via the `"full"` tools profile.

## Key Config (`/data/.openclaw/openclaw.json`)

```json
{
  "agents": {
    "defaults": {
      "model": { "primary": "anthropic/claude-sonnet-4-6" },
      "workspace": "/data/workspace",
      "contextPruning": { "mode": "cache-ttl", "ttl": "1h" },
      "compaction": { "mode": "safeguard" },
      "timeoutSeconds": 900,
      "heartbeat": {
        "every": "30m",
        "activeHours": { "start": "06:00", "end": "21:00" },
        "target": "last"
      },
      "maxConcurrent": 4,
      "subagents": {
        "maxConcurrent": 8,
        "maxSpawnDepth": 1,
        "maxChildrenPerAgent": 4,
        "runTimeoutSeconds": 600
      }
    }
  },
  "tools": {
    "profile": "full",
    "deny": ["exec", "process", "write", "edit", "apply_patch", "gateway"]
  },
  "messages": { "ackReactionScope": "group-mentions" },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto",
    "restart": true,
    "ownerDisplay": "raw"
  },
  "session": {
    "dmScope": "per-channel-peer",
    "resetTriggers": ["/new", "/reset"],
    "reset": { "mode": "daily", "atHour": 4, "idleMinutes": 240 }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "pairing",
      "groupPolicy": "allowlist",
      "chunkMode": "newline",
      "streaming": "partial"
    }
  },
  "plugins": {
    "load": {
      "paths": ["/data/workspace/.openclaw/extensions/wade-tools"]
    },
    "entries": { "wade-tools": { "enabled": true } }
  }
}
```

### Config Notes

- **`tools.profile` must be `"full"`**, not `"messaging"`. The `messaging` profile filters out ALL plugin tools.
- **Do NOT set `tools.allow`** — it acts as a strict whitelist that blocks core tools (cron, browser, subagents, etc.). The plugin is loaded via `plugins.load.paths`; core tools come from the `"full"` profile.
- **`tools.deny`** blocks only destructive core tools (exec, process, write, edit, apply_patch, gateway). All other core tools (cron, read, pdf, browser, subagents, web_search, etc.) are available.
- **Do NOT set `plugins.allow`** — causes a circular validation error. Leave unset; empty = auto-allow.
- **`compaction.mode`** must be `"default"` or `"safeguard"`. Any other value silently breaks plugin tool registration.
- **`heartbeat`** — Wade proactively checks in every 30 minutes during active hours (6am-9pm).
- **`session.reset`** — Sessions reset daily at 4am or after 240 minutes idle.
- **`subagents`** — Max 8 concurrent, depth 1, 4 children per agent, 10-minute timeout.
- **Bot token and gateway auth token** are in the live config but omitted here. The gateway wrapper overwrites `gateway.auth.token` and `gateway.controlUi.allowedOrigins` on every boot.

## Known Issue: File Ownership After Redeploy

OpenClaw blocks plugins with non-root ownership. The Railway template's `entrypoint.sh` runs `chown -R openclaw:openclaw /data` on every boot, which resets the plugin directory to uid 1001. OpenClaw then blocks the plugin with `suspicious ownership (uid=1001, expected uid=0 or root)`.

**Automated fix:** A patched entrypoint at `/data/entrypoint-wade.sh` (on the persistent volume) adds a `chown -R 0:0` for the plugin directory after the blanket chown. After every redeploy, copy it over the image entrypoint:

```bash
railway ssh ... -- "cp /data/entrypoint-wade.sh /app/entrypoint.sh"
```

**Manual fix (if the patched entrypoint is missing):**

```bash
railway ssh ... -- "chown -R 0:0 /data/workspace/.openclaw/extensions/wade-tools"
```

After fixing ownership, send SIGUSR1 to the gateway to force plugin re-discovery:

```bash
# Find gateway PID and send SIGUSR1
railway ssh ... -- "kill -USR1 $(ps aux | grep openclaw-gateway | grep -v grep | head -1 | awk '{print $2}')"
```

**Do NOT use `kill 1`** — it terminates the container wrapper and often leaves the service in a 502 state for several minutes. SIGUSR1 to the gateway process is the safe restart method.

## How to Update the Plugin

1. Edit source files in `c:\Users\colin\CR Sandbox\wade-openclaw-plugin\`
2. Compile: `pnpm build` (generates JS in `dist/`)
3. Copy compiled files to `c:\Users\colin\CR Sandbox\openclaw-workspace\extensions\wade-tools\`
4. Push to GitHub: `git add -A && git commit -m "..." && git push`
5. On Railway, clone/pull and copy:
   ```bash
   railway ssh ... -- "cd /tmp && git clone https://github.com/colinreed88-maker/openclaw-workspace.git && cp -r /tmp/openclaw-workspace/extensions/wade-tools/* /data/workspace/.openclaw/extensions/wade-tools/ && chown -R 0:0 /data/workspace/.openclaw/extensions/wade-tools && rm -rf /tmp/openclaw-workspace"
   ```
6. Redeploy or wait for hot-reload

## Plugin Entry Point

- **File:** `index.js` (compiled from `index.ts`)
- **`package.json`:** `"openclaw": { "extensions": ["./index.js"] }`
- **`openclaw.plugin.json`:** `{ "id": "wade-tools" }`
- **`package.json` name** must match plugin id: `"name": "wade-tools"`

## Environment Variables Required

The plugin reads these from the Railway service environment:

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS for all queries
- `TAVILY_API_KEY` — for web search
- `RESEND_API_KEY` — for email
- `RESEND_FROM_ADDRESS` — sender address (`Wade AI <wade@flowfinance.life>`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` — for Calendar API
- `GITHUB_READ_TOKEN` — for reading GitHub files
- `ASSISTANT_SERVICE_KEY` — for Flow Intranet agent proxy
- `INTRANET_API_URL` — Flow Intranet URL (default: `https://flow-intranet.vercel.app`)

## Debugging Commands

```bash
# Check plugin status
railway ssh ... -- "node /openclaw/dist/entry.js plugins info wade-tools 2>&1 | tail -15"

# Check logs for plugin errors
railway ssh ... -- "cat /tmp/openclaw/openclaw-2026-03-08.log | grep -i 'plugin\|wade\|error' | tail -20"

# Read current config
railway ssh ... -- "cat /data/.openclaw/openclaw.json"

# Test plugin loads in Node
railway ssh ... -- "node -e 'import(\"/data/workspace/.openclaw/extensions/wade-tools/index.js\").then(m=>console.log(typeof m.default,Object.keys(m)))'"

# Fix ownership (run after every redeploy)
railway ssh ... -- "chown -R 0:0 /data/workspace/.openclaw/extensions/wade-tools"
```

## Lessons Learned

1. `tools.allow` (agent tool access) and `plugins.allow` (plugin trust) are separate settings
2. `plugins.allow` validates against known plugins — setting it before the plugin loads breaks config validation
3. OpenClaw has a security check that blocks plugins owned by non-root users
4. Railway SSH commands need base64 encoding for complex Node scripts (PowerShell mangles quotes)
5. The gateway wrapper does config overwrites on startup (token sync, allowed origins) but preserves custom fields
6. `railway redeploy -y` is the reliable way to restart; `railway restart` often hangs
7. **CRITICAL: No .ts files in deployed plugin directory.** The `openclaw-workspace` copy must only contain compiled `.js` files — no `.ts`, `.d.ts`, or `.js.map` files. OpenClaw discovers `.ts` files and tries to load them instead of `.js`, which silently fails (tools never register, agent can describe queries but never executes them). The `package.json` in openclaw-workspace MUST have `"openclaw": { "extensions": ["./index.js"] }` — NOT `./index.ts`.
8. **`tools.profile` must be `"full"` for plugin tools to work.** Valid values: `minimal`, `coding`, `messaging`, `full`. The `messaging` profile filters out ALL plugin tools even when they're in `tools.allow`. Use `"full"` with a `tools.deny` list to block dangerous core tools while keeping plugin tools available.
9. **`agents.defaults.thinking` is NOT a valid config key.** OpenClaw rejects it at startup. Extended thinking may be set per-model or via a different path — do not add `thinking` to `agents.defaults`.
10. **`railway redeploy` does hot-reload, not full restart.** Plugin discovery only happens at gateway boot. To force plugin re-discovery, send SIGUSR1 to the `openclaw-gateway` process (not PID 1). **Do NOT use `kill 1`** — it terminates the container wrapper and often leaves the service in a 502 state. Use `kill -USR1 <gateway-pid>` instead.
11. **Config changes survive redeploy but get overwritten on boot.** The gateway wrapper overwrites `gateway.auth.token` and `gateway.controlUi.allowedOrigins` on every startup. Custom agent/plugin settings are preserved.
12. **`compaction.mode` valid values are `"default"` and `"safeguard"` only.** Any other value (e.g., `"auto"`, `"rolling"`) makes the entire config invalid, which blocks all plugin tool registration silently. Use `"default"` — it compacts old history and collapses thinking blocks so sessions don't blow up to 281 messages.
13. **CRITICAL: `index.js` imports from `./src/` — the compiled `src/` directory MUST be deployed.** The TypeScript build outputs `dist/index.js` + `dist/src/**/*.js`. The `index.js` entrypoint imports from `./src/tools/*.js` and `./src/integrations/*.js`. If you delete `src/` from the deploy, the plugin discovers `index.js` but fails to load with `Cannot find module './src/tools/query-ramp-spend.js'`. Deploy the full `dist/` structure: `index.js` + `src/**/*.js`. Only remove `.ts`, `.d.ts`, and `.js.map` files — never remove the `src/` directory itself.
14. **CRITICAL: The Railway entrypoint runs `chown -R openclaw:openclaw /data` on every boot.** This resets plugin directory ownership to uid=1001, which OpenClaw blocks. A patched entrypoint at `/data/entrypoint-wade.sh` (persistent volume) adds a `chown -R 0:0` for the plugin directory after the blanket chown. After every redeploy, copy it: `cp /data/entrypoint-wade.sh /app/entrypoint.sh`.
15. **SIGUSR1 is the safe gateway restart.** Send `kill -USR1 <gateway-pid>` to trigger an in-process restart that re-discovers plugins. Do NOT use `kill 1` — it terminates the container wrapper and often leaves the service in a 502 state for 2-5 minutes.
16. **Plugin discovery vs. tool injection are separate.** `openclaw plugins info wade-tools` can report "loaded" even when the gateway's running process hasn't injected the tools into agent prompts. Always verify with an actual `agent --json` test and check `systemPromptReport.tools.entries`.
17. **Do NOT set `tools.allow` at all.** Setting `tools.allow: ["wade-tools"]` acts as a strict whitelist that blocks ALL core tools (cron, read, browser, subagents, web_fetch, etc.) — only plugin tools and a couple of built-in memory tools get through. The plugin is already loaded via `plugins.load.paths` and `plugins.entries`. Use only `tools.profile: "full"` with `tools.deny` to block dangerous tools. This gives Wade access to all 43+ tools (23 plugin + 20 core).
18. **`tools.allow` with individual tool names is also fragile.** If the plugin fails to load (e.g., ownership issue), individual tool names in `tools.allow` become unresolvable references. OpenClaw's `stripPluginOnlyAllowlist()` misidentifies them as core tools, keeping the allowlist active and blocking everything.

## Deploy Checklist (copy-paste for every deploy)

1. `pnpm build` in `wade-openclaw-plugin/`
2. Copy FULL `dist/` structure to `openclaw-workspace/extensions/wade-tools/`: `dist/index.js` + `dist/src/**/*.js` (preserving directory structure). Do NOT delete `src/` — `index.js` imports from it. Remove only `.ts`, `.d.ts`, `.js.map` files.
3. Copy `reference/` and `agent/` dirs to openclaw-workspace
4. Verify `package.json` in openclaw-workspace has `"extensions": ["./index.js"]`
5. `git add && git commit && git push` in openclaw-workspace
6. SSH to Railway: `cd /tmp && rm -rf openclaw-workspace && git clone --depth 1 https://github.com/colinreed88-maker/openclaw-workspace.git && cp -r /tmp/openclaw-workspace/extensions/wade-tools/* /data/workspace/.openclaw/extensions/wade-tools/ && cp /tmp/openclaw-workspace/HEARTBEAT.md /data/workspace/HEARTBEAT.md && chown -R 0:0 /data/workspace/.openclaw/extensions/wade-tools && rm -rf /tmp/openclaw-workspace`
7. SSH: `find /data/workspace/.openclaw/extensions/wade-tools -name '*.ts' -delete` (remove any .ts that snuck in)
8. SSH: Fix ownership: `chown -R 0:0 /data/workspace/.openclaw/extensions/wade-tools`
9. SSH: Restart gateway via SIGUSR1: `kill -USR1 $(ps aux | grep openclaw-gateway | grep -v grep | head -1 | awk '{print $2}')`
10. Wait ~20s for gateway to restart
11. Verify: `node /openclaw/dist/entry.js plugins info wade-tools` — should show all 23+ tools
12. Verify: run `node /openclaw/dist/entry.js agent --json --session-id test -m 'List your tools'` and check the `systemPromptReport.tools.entries` includes Wade tools
13. Test via Telegram: "What is the current MBR last closed month?"

## After Every Railway Redeploy

1. SSH in and apply the patched entrypoint: `cp /data/entrypoint-wade.sh /app/entrypoint.sh`
2. Fix ownership: `chown -R 0:0 /data/workspace/.openclaw/extensions/wade-tools`
3. Restart gateway: `kill -USR1 $(ps aux | grep openclaw-gateway | grep -v grep | head -1 | awk '{print $2}')`
4. Verify tools appear in agent prompt (step 12 above)
