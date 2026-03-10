import { WebClient } from "@slack/web-api";
import { getSupabase } from "../db.js";
import { createEmbeddingBatch } from "../embeddings.js";
import { chunkText } from "../chunking.js";
import { hashText, getWatermark, logIngestion } from "../ingestion.js";
import { textResult } from "../types.js";
const PAGE_KEY = "wade-private";
const SOURCE_TYPE = "slack";
const EMBED_BATCH = 50;
const RATE_LIMIT_DELAY = 300;
export const definition = {
    name: "ingest_slack",
    description: "Ingest recent Slack messages into Wade's knowledge base. Polls channels for new messages since last sync, chunks them by channel+day, embeds, and stores in the vector DB. Run by cron every 4 hours or manually.",
    parameters: {
        type: "object",
        properties: {
            channels: {
                type: "array",
                items: { type: "string" },
                description: "Optional list of channel names or IDs to sync. Default: all non-archived channels Colin is in.",
            },
            lookback_hours: {
                type: "number",
                description: "How many hours to look back on first run (no watermark). Default 24. Ignored if a watermark exists.",
            },
        },
    },
};
let _client = null;
function getClient() {
    if (_client)
        return _client;
    const token = process.env.SLACK_USER_TOKEN;
    if (!token)
        throw new Error("SLACK_USER_TOKEN not configured.");
    _client = new WebClient(token);
    return _client;
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
const userCache = new Map();
async function resolveUser(client, userId) {
    if (userCache.has(userId))
        return userCache.get(userId);
    try {
        const info = await client.users.info({ user: userId });
        const u = info.user;
        const name = u?.real_name || u?.display_name || u?.name || userId;
        userCache.set(userId, name);
        return name;
    }
    catch {
        return userId;
    }
}
async function getChannels(client, filter) {
    const all = [];
    let cursor;
    do {
        const result = await client.conversations.list({
            types: "public_channel,private_channel",
            limit: 200,
            exclude_archived: true,
            cursor,
        });
        const channels = result.channels ?? [];
        all.push(...channels);
        cursor = result.response_metadata?.next_cursor || undefined;
        if (cursor)
            await sleep(RATE_LIMIT_DELAY);
    } while (cursor);
    if (!filter?.length)
        return all.filter((c) => !c.is_archived);
    const filterLower = new Set(filter.map((f) => f.toLowerCase().replace(/^#/, "")));
    return all.filter((c) => {
        const name = c.name?.toLowerCase();
        return (name && filterLower.has(name)) || (c.id && filterLower.has(c.id.toLowerCase()));
    });
}
async function getMessages(client, channelId, oldest) {
    const all = [];
    let cursor;
    do {
        const result = await client.conversations.history({
            channel: channelId,
            oldest,
            limit: 200,
            cursor,
        });
        const messages = result.messages ?? [];
        all.push(...messages);
        cursor = result.response_metadata?.next_cursor || undefined;
        if (cursor)
            await sleep(RATE_LIMIT_DELAY);
    } while (cursor);
    return all
        .filter((m) => m.type === "message" && !m.subtype)
        .sort((a, b) => parseFloat(a.ts ?? "0") - parseFloat(b.ts ?? "0"));
}
function groupByDate(messages) {
    const groups = new Map();
    for (const m of messages) {
        const date = m.ts
            ? new Date(parseFloat(m.ts) * 1000).toISOString().slice(0, 10)
            : "unknown";
        if (!groups.has(date))
            groups.set(date, []);
        groups.get(date).push(m);
    }
    return groups;
}
export async function execute(_id, params) {
    const channelFilter = params.channels;
    const lookbackHours = params.lookback_hours ?? 24;
    const startTime = Date.now();
    let client;
    try {
        client = getClient();
    }
    catch (err) {
        return textResult({ error: err instanceof Error ? err.message : String(err) });
    }
    const supabase = getSupabase();
    let itemsFound = 0;
    let itemsIngested = 0;
    let itemsSkipped = 0;
    let latestTs = null;
    try {
        const watermark = await getWatermark(SOURCE_TYPE);
        const oldest = watermark ?? String(Date.now() / 1000 - lookbackHours * 3600);
        const channels = await getChannels(client, channelFilter);
        const channelSummaries = [];
        for (const channel of channels) {
            if (!channel.id || !channel.name)
                continue;
            let messages;
            try {
                messages = await getMessages(client, channel.id, oldest);
            }
            catch {
                continue;
            }
            if (messages.length === 0)
                continue;
            const byDate = groupByDate(messages);
            for (const [date, dayMessages] of byDate) {
                itemsFound += dayMessages.length;
                const sourceId = `slack:${channel.id}:${date}`;
                const existing = await supabase
                    .from("knowledge_documents")
                    .select("id")
                    .eq("source_type", SOURCE_TYPE)
                    .eq("source_id", sourceId)
                    .limit(1);
                if (existing.data?.length) {
                    await supabase
                        .from("knowledge_chunks")
                        .delete()
                        .eq("document_id", existing.data[0].id);
                    await supabase
                        .from("knowledge_documents")
                        .delete()
                        .eq("id", existing.data[0].id);
                }
                const lines = [];
                for (const m of dayMessages) {
                    const author = m.user ? await resolveUser(client, m.user) : "unknown";
                    lines.push(`${author}: ${m.text ?? ""}`);
                }
                const header = `#${channel.name} — ${date}`;
                const fullText = `${header}\n\n${lines.join("\n")}`;
                const contentHash = hashText(fullText);
                const { data: doc, error: docErr } = await supabase
                    .from("knowledge_documents")
                    .insert({
                    source_type: SOURCE_TYPE,
                    source_id: sourceId,
                    title: `Slack: #${channel.name} — ${date}`,
                    file_hash: contentHash,
                    required_page_key: PAGE_KEY,
                    status: "processing",
                })
                    .select("id")
                    .single();
                if (docErr || !doc) {
                    itemsSkipped += dayMessages.length;
                    continue;
                }
                const chunks = chunkText(fullText);
                let insertedChunks = 0;
                for (let ci = 0; ci < chunks.length; ci += EMBED_BATCH) {
                    const batch = chunks.slice(ci, ci + EMBED_BATCH);
                    const embeddings = await createEmbeddingBatch(batch);
                    const rows = batch.map((text, bi) => ({
                        document_id: doc.id,
                        chunk_text: text,
                        chunk_index: ci + bi,
                        embedding: JSON.stringify(embeddings[bi]),
                        metadata: {
                            source: SOURCE_TYPE,
                            channel: channel.name,
                            channel_id: channel.id,
                            date,
                            message_count: dayMessages.length,
                        },
                    }));
                    const { error: insertErr } = await supabase.from("knowledge_chunks").insert(rows);
                    if (!insertErr)
                        insertedChunks += rows.length;
                }
                await supabase
                    .from("knowledge_documents")
                    .update({ status: "active", chunk_count: insertedChunks })
                    .eq("id", doc.id);
                itemsIngested += dayMessages.length;
                channelSummaries.push(`#${channel.name}: ${dayMessages.length} messages (${date})`);
                const maxTs = dayMessages.reduce((max, m) => (m.ts && m.ts > max ? m.ts : max), "0");
                if (!latestTs || maxTs > latestTs)
                    latestTs = maxTs;
            }
            await sleep(RATE_LIMIT_DELAY);
        }
        await logIngestion({
            source: SOURCE_TYPE,
            itemsFound,
            itemsIngested,
            itemsSkipped,
            watermark: latestTs,
            status: itemsIngested > 0 ? "success" : "success",
            startTime,
            metadata: {
                channels_synced: channelSummaries.length,
                channel_details: channelSummaries,
            },
        });
        return textResult({
            success: true,
            channels_synced: channelSummaries.length,
            messages_found: itemsFound,
            messages_ingested: itemsIngested,
            messages_skipped: itemsSkipped,
            channels: channelSummaries,
            elapsed_seconds: ((Date.now() - startTime) / 1000).toFixed(1),
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logIngestion({
            source: SOURCE_TYPE,
            itemsFound,
            itemsIngested,
            itemsSkipped,
            watermark: latestTs,
            status: "failed",
            error: msg,
            startTime,
        });
        return textResult({ error: `Slack ingestion failed: ${msg}` });
    }
}
//# sourceMappingURL=ingest-slack.js.map