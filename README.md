# OpenClaw Workspace — Wade Tools Extension

This repo contains the Wade financial analysis tools plugin for OpenClaw.

## What's Inside

`extensions/wade-tools/` — An OpenClaw plugin that registers 20 tools for querying Flow's financial data, sending emails, managing calendar, and more.

### Tools (20 total)

**Financial Queries:** query_ramp_spend, query_sage_gl, query_fpa_data, query_headcount, query_toast_data

**Utility:** query_supabase, query_financial_data, retrieve_knowledge_doc, retrieve_ramp_invoice

**Memory:** save_memory, search_memories, forget_memory

**External:** search_web, read_github_file

**Side-effect (optional):** send_email, create_calendar_event, get_calendar_availability, list_upcoming_events, manage_scheduled_tasks, approve_action, reject_action

### Reference Docs

`extensions/wade-tools/reference/` contains FINANCIAL.md and REFERENCE.md with Flow's financial accuracy rules, data landscape, tool routing table, and BU mappings. OpenClaw can read and integrate these into its own identity files.

## Deployment

On the Railway container:

```bash
cd /data/workspace/.openclaw/extensions
git clone https://github.com/colinreed88-maker/openclaw-workspace.git _repo
cp -r _repo/extensions/wade-tools .
cd wade-tools
npm install @supabase/supabase-js openai resend googleapis @tavily/core
```

Then restart the OpenClaw service.

## Updating

```bash
cd /data/workspace/.openclaw/extensions/_repo
git pull
cp -r extensions/wade-tools ../wade-tools
cd ../wade-tools
npm install
```

Then restart.

## Required Environment Variables

These should be set in Railway:

- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY
- TAVILY_API_KEY
- RESEND_API_KEY, RESEND_FROM_ADDRESS, ALLOWED_EMAIL_DOMAINS
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
- GITHUB_READ_TOKEN
- ASSISTANT_SERVICE_KEY, INTRANET_API_URL
