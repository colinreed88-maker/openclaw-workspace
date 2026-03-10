import { google } from "googleapis";
import { getSupabase } from "../db.js";
import { createEmbeddingBatch } from "../embeddings.js";
import { hashText, logIngestion } from "../ingestion.js";
import { textResult } from "../types.js";
const PAGE_KEY = "wade-private";
const SOURCE_TYPE = "calendar";
export const definition = {
    name: "ingest_calendar",
    description: "Sync Google Calendar events into Wade's knowledge base. Fetches the past 7 days and next 7 days of events, groups by day, embeds, and stores as searchable context. Run daily by cron or manually.",
    parameters: {
        type: "object",
        properties: {
            days_back: {
                type: "number",
                description: "Days in the past to sync (default 7)",
            },
            days_ahead: {
                type: "number",
                description: "Days in the future to sync (default 7)",
            },
            calendar_id: {
                type: "string",
                description: "Google Calendar ID (default: primary)",
            },
        },
    },
};
function getCalendar() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Google Calendar requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN");
    }
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return google.calendar({ version: "v3", auth: oauth2 });
}
function formatEvent(e) {
    const parts = [];
    const title = e.summary || "Untitled";
    parts.push(`Meeting: ${title}`);
    const startStr = e.start?.dateTime ?? e.start?.date ?? "";
    const endStr = e.end?.dateTime ?? e.end?.date ?? "";
    if (startStr) {
        const start = new Date(startStr);
        const timeStr = e.start?.dateTime
            ? start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })
            : "All day";
        parts.push(`Time: ${timeStr}`);
        if (endStr && e.end?.dateTime) {
            const end = new Date(endStr);
            const endTime = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
            parts[parts.length - 1] += ` - ${endTime}`;
        }
    }
    if (e.attendees?.length) {
        const names = e.attendees
            .map((a) => a.displayName || a.email || "unknown")
            .join(", ");
        parts.push(`Attendees: ${names}`);
    }
    if (e.location)
        parts.push(`Location: ${e.location}`);
    if (e.description) {
        const desc = e.description.slice(0, 500);
        parts.push(`Notes: ${desc}`);
    }
    return parts.join("\n");
}
export async function execute(_id, params) {
    const daysBack = params.days_back ?? 7;
    const daysAhead = params.days_ahead ?? 7;
    const calendarId = params.calendar_id ?? "primary";
    const startTime = Date.now();
    const supabase = getSupabase();
    let itemsFound = 0;
    let itemsIngested = 0;
    try {
        const calendar = getCalendar();
        const now = new Date();
        const timeMin = new Date(now);
        timeMin.setDate(timeMin.getDate() - daysBack);
        const timeMax = new Date(now);
        timeMax.setDate(timeMax.getDate() + daysAhead);
        const res = await calendar.events.list({
            calendarId,
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 250,
        });
        const events = (res.data.items ?? []);
        itemsFound = events.length;
        if (events.length === 0) {
            await logIngestion({
                source: SOURCE_TYPE,
                itemsFound: 0,
                itemsIngested: 0,
                itemsSkipped: 0,
                watermark: now.toISOString(),
                status: "success",
                startTime,
            });
            return textResult({ success: true, events_found: 0, message: "No calendar events in range." });
        }
        // Group events by date
        const byDate = new Map();
        for (const e of events) {
            const dateStr = e.start?.dateTime
                ? new Date(e.start.dateTime).toISOString().slice(0, 10)
                : e.start?.date ?? "unknown";
            if (!byDate.has(dateStr))
                byDate.set(dateStr, []);
            byDate.get(dateStr).push(e);
        }
        // Delete old calendar chunks (full refresh approach — calendar data is small)
        const { data: oldDocs } = await supabase
            .from("knowledge_documents")
            .select("id")
            .eq("source_type", SOURCE_TYPE);
        if (oldDocs?.length) {
            const ids = oldDocs.map((d) => d.id);
            await supabase.from("knowledge_chunks").delete().in("document_id", ids);
            await supabase.from("knowledge_documents").delete().in("id", ids);
        }
        const daySummaries = [];
        for (const [date, dayEvents] of byDate) {
            const formattedEvents = dayEvents.map(formatEvent);
            const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            });
            const fullText = `Calendar — ${dayLabel}\n\n${formattedEvents.join("\n\n")}`;
            const contentHash = hashText(fullText);
            const { data: doc, error: docErr } = await supabase
                .from("knowledge_documents")
                .insert({
                source_type: SOURCE_TYPE,
                source_id: `calendar:${date}`,
                title: `Calendar: ${dayLabel}`,
                file_hash: contentHash,
                required_page_key: PAGE_KEY,
                status: "processing",
            })
                .select("id")
                .single();
            if (docErr || !doc)
                continue;
            // Calendar day chunks are typically small enough for a single chunk,
            // but chunk anyway for consistency
            const chunks = fullText.length > 2000
                ? [fullText.slice(0, Math.ceil(fullText.length / 2)), fullText.slice(Math.ceil(fullText.length / 2))]
                : [fullText];
            const embeddings = await createEmbeddingBatch(chunks);
            const rows = chunks.map((text, i) => ({
                document_id: doc.id,
                chunk_text: text,
                chunk_index: i,
                embedding: JSON.stringify(embeddings[i]),
                metadata: {
                    source: SOURCE_TYPE,
                    date,
                    event_count: dayEvents.length,
                    event_titles: dayEvents.map((e) => e.summary || "Untitled"),
                },
            }));
            const { error: insertErr } = await supabase.from("knowledge_chunks").insert(rows);
            if (!insertErr) {
                await supabase
                    .from("knowledge_documents")
                    .update({ status: "active", chunk_count: rows.length })
                    .eq("id", doc.id);
                itemsIngested += dayEvents.length;
                daySummaries.push(`${date}: ${dayEvents.length} events`);
            }
        }
        await logIngestion({
            source: SOURCE_TYPE,
            itemsFound,
            itemsIngested,
            itemsSkipped: itemsFound - itemsIngested,
            watermark: now.toISOString(),
            status: "success",
            startTime,
            metadata: { days: daySummaries },
        });
        return textResult({
            success: true,
            events_found: itemsFound,
            events_ingested: itemsIngested,
            days_covered: daySummaries.length,
            days: daySummaries,
            elapsed_seconds: ((Date.now() - startTime) / 1000).toFixed(1),
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logIngestion({
            source: SOURCE_TYPE,
            itemsFound,
            itemsIngested,
            itemsSkipped: 0,
            watermark: null,
            status: "failed",
            error: msg,
            startTime,
        });
        return textResult({ error: `Calendar ingestion failed: ${msg}` });
    }
}
//# sourceMappingURL=ingest-calendar.js.map