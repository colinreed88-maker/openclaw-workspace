## Heartbeat Checklist

Do something useful FIRST, then check urgent items. If nothing needs attention after all checks, reply HEARTBEAT_OK.

MAX 3 consecutive HEARTBEAT_OKs — then you MUST do real work from the proactive backlog on the next heartbeat. Do not reach out unless you did something useful. No "just checking in" messages.

### Proactive Backlog (pick ONE per heartbeat)

Quick wins (2-5 min):
- Check ingestion_log via query_ingestion_log for any failed syncs in the last 24h. If a sync failed, retry it by calling the appropriate ingest tool.
- Check if any knowledge source hasn't synced in 24h+. Run the stale ingestion tool.
- Review recent memories (search_memories with a broad query). Any obvious duplicates or contradictions? Clean up with forget_memory.

Medium tasks (5-10 min, if no quick wins needed):
- Search Slack (read_slack with search_messages) for mentions of Colin or @channel in the last 4 hours. Summarize anything important Wade hasn't already flagged.
- Review recent Toast/F&B data for anomalies — big drop in daily sales vs prior week, location showing zero, etc. Flag if unusual.
- Check Ramp spend trends — compare last 7 days to prior 7 days. Flag if total spend is notably higher.

### Urgent Checks (always, after proactive work)

1. Has a new month closed in Sage? Check app_config for mbr_last_closed_month. If it advanced since last check, notify Colin.
2. Any Ramp bills over $25K posted today? Check ramp_bills for today's posting_date.
3. Any calendar events in the next 2 hours that Colin should prep for? If yes, search the knowledge base (search_knowledge) for relevant context — past meeting notes with these attendees, recent Slack threads on the topic — and send a brief prep note.

### Rules

- Keep heartbeat actions under 10 minutes total.
- If you find something worth reporting, send ONE concise Telegram message with findings.
- Do not repeat the same proactive task on consecutive heartbeats — rotate through the backlog.
- During the morning brief window (6:30-7:30am), skip the proactive backlog — the morning brief cron handles that.
