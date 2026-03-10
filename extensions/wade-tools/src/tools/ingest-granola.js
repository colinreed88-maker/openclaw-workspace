import { getSupabase } from "../db.js";
import { createEmbeddingBatch } from "../embeddings.js";
import { chunkText } from "../chunking.js";
import { hashText, logIngestion } from "../ingestion.js";
import { textResult } from "../types.js";
const PAGE_KEY = "wade-private";
const SOURCE_TYPE = "granola";
const GRANOLA_BASE = "https://public-api.granola.ai";
const WADE_FOLDER_NAME = "Wade";
const EMBED_BATCH = 50;
const RATE_LIMIT_DELAY = 250;
export const definition = {
    name: "ingest_granola",
    description: "Sync meeting notes from Granola into Wade's knowledge base. Fetches notes from the Wade folder, chunks them, embeds, and stores with full document backup. Run daily by cron or manually.",
    parameters: {
        type: "object",
        properties: {
            days_back: {
                type: "number",
                description: "How many days back to look for new notes (default: since last sync, or 30 days on first run)",
            },
        },
    },
};
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
async function granolaGet(path, apiKey) {
    const res = await fetch(`${GRANOLA_BASE}${path}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 429) {
        await sleep(5000);
        const retry = await fetch(`${GRANOLA_BASE}${path}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!retry.ok)
            throw new Error(`Granola GET ${path} failed after retry (${retry.status})`);
        return retry.json();
    }
    if (!res.ok)
        throw new Error(`Granola GET ${path} failed (${res.status})`);
    return res.json();
}
async function listNotes(apiKey, createdAfter) {
    const all = [];
    let cursor = null;
    while (true) {
        const params = new URLSearchParams({ created_after: createdAfter, page_size: "30" });
        if (cursor)
            params.set("cursor", cursor);
        const data = await granolaGet(`/v1/notes?${params}`, apiKey);
        all.push(...data.notes);
        if (!data.hasMore || !data.cursor)
            break;
        cursor = data.cursor;
        await sleep(RATE_LIMIT_DELAY);
    }
    return all;
}
function formatNote(note) {
    const parts = [];
    parts.push(`Meeting: ${note.title || "Untitled Meeting"}`);
    if (note.calendar_event?.scheduled_start_time) {
        const d = new Date(note.calendar_event.scheduled_start_time);
        parts.push(`Date: ${d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`);
    }
    else {
        parts.push(`Date: ${note.created_at.slice(0, 10)}`);
    }
    if (note.attendees?.length) {
        parts.push(`Attendees: ${note.attendees.map((a) => a.name || a.email).join(", ")}`);
    }
    if (note.folder_membership?.length) {
        parts.push(`Folders: ${note.folder_membership.map((f) => f.name).join(", ")}`);
    }
    parts.push("");
    if (note.summary_markdown) {
        parts.push(note.summary_markdown);
    }
    else if (note.summary_text) {
        parts.push(note.summary_text);
    }
    return parts.join("\n").trim();
}
export async function execute(_id, params) {
    const daysBackOverride = params.days_back;
    const startTime = Date.now();
    const apiKey = process.env.GRANOLA_API_KEY;
    if (!apiKey)
        return textResult({ error: "GRANOLA_API_KEY not configured" });
    const supabase = getSupabase();
    let itemsFound = 0;
    let itemsIngested = 0;
    let itemsSkipped = 0;
    let skippedNoFolder = 0;
    try {
        let createdAfter;
        if (daysBackOverride) {
            const d = new Date();
            d.setDate(d.getDate() - daysBackOverride);
            createdAfter = d.toISOString().slice(0, 10);
        }
        else {
            const { data: lastDoc } = await supabase
                .from("knowledge_documents")
                .select("created_at")
                .eq("source_type", SOURCE_TYPE)
                .order("created_at", { ascending: false })
                .limit(1);
            if (lastDoc?.length) {
                const lastDate = new Date(lastDoc[0].created_at);
                lastDate.setDate(lastDate.getDate() - 1);
                createdAfter = lastDate.toISOString().slice(0, 10);
            }
            else {
                const d = new Date();
                d.setDate(d.getDate() - 30);
                createdAfter = d.toISOString().slice(0, 10);
            }
        }
        const summaries = await listNotes(apiKey, createdAfter);
        itemsFound = summaries.length;
        if (!summaries.length) {
            await logIngestion({
                source: SOURCE_TYPE,
                itemsFound: 0,
                itemsIngested: 0,
                itemsSkipped: 0,
                watermark: new Date().toISOString(),
                status: "success",
                startTime,
            });
            return textResult({ success: true, notes_found: 0, notes_ingested: 0 });
        }
        const noteIds = summaries.map((n) => n.id);
        const { data: existingDocs } = await supabase
            .from("knowledge_documents")
            .select("source_id")
            .eq("source_type", SOURCE_TYPE)
            .in("source_id", noteIds);
        const existingIds = new Set((existingDocs ?? []).map((d) => d.source_id));
        for (const summary of summaries) {
            if (existingIds.has(summary.id)) {
                itemsSkipped++;
                continue;
            }
            try {
                const note = await granolaGet(`/v1/notes/${summary.id}`, apiKey);
                await sleep(RATE_LIMIT_DELAY);
                const inWadeFolder = note.folder_membership?.some((f) => f.name.toLowerCase() === WADE_FOLDER_NAME.toLowerCase());
                if (!inWadeFolder) {
                    skippedNoFolder++;
                    continue;
                }
                const text = formatNote(note);
                if (!text || text.length < 50)
                    continue;
                const contentHash = hashText(text);
                const docTitle = note.title
                    ? `Meeting: ${note.title}`
                    : `Meeting Notes — ${note.created_at.slice(0, 10)}`;
                const safeTitle = (note.title || "meeting-notes")
                    .replace(/[^a-zA-Z0-9\-_ ]/g, "")
                    .replace(/\s+/g, "-")
                    .slice(0, 80);
                const storagePath = `${contentHash}/${safeTitle}.md`;
                const { error: storageErr } = await supabase.storage
                    .from("knowledge-docs")
                    .upload(storagePath, Buffer.from(text, "utf-8"), {
                    contentType: "text/markdown",
                    upsert: true,
                });
                const { data: doc, error: docErr } = await supabase
                    .from("knowledge_documents")
                    .insert({
                    source_type: SOURCE_TYPE,
                    source_id: note.id,
                    title: docTitle,
                    file_hash: contentHash,
                    required_page_key: PAGE_KEY,
                    status: "processing",
                    storage_path: storageErr ? null : storagePath,
                })
                    .select("id")
                    .single();
                if (docErr || !doc) {
                    itemsSkipped++;
                    continue;
                }
                const chunks = chunkText(text, 500, 50);
                let insertedChunks = 0;
                for (let ci = 0; ci < chunks.length; ci += EMBED_BATCH) {
                    const batch = chunks.slice(ci, ci + EMBED_BATCH);
                    const embeddings = await createEmbeddingBatch(batch);
                    const rows = batch.map((chunkStr, bi) => ({
                        document_id: doc.id,
                        chunk_text: chunkStr,
                        chunk_index: ci + bi,
                        embedding: JSON.stringify(embeddings[bi]),
                        metadata: {
                            source: SOURCE_TYPE,
                            meeting_title: note.title || null,
                            meeting_date: note.calendar_event?.scheduled_start_time || note.created_at,
                            attendees: note.attendees?.map((a) => a.name || a.email) || [],
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
                itemsIngested++;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[ingest-granola] Failed on note ${summary.id}: ${msg}`);
                itemsSkipped++;
            }
        }
        await logIngestion({
            source: SOURCE_TYPE,
            itemsFound,
            itemsIngested,
            itemsSkipped,
            watermark: new Date().toISOString(),
            status: "success",
            startTime,
            metadata: {
                skipped_duplicate: existingIds.size,
                skipped_no_wade_folder: skippedNoFolder,
            },
        });
        return textResult({
            success: true,
            notes_found: itemsFound,
            notes_ingested: itemsIngested,
            skipped_duplicate: itemsSkipped,
            skipped_no_wade_folder: skippedNoFolder,
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
            watermark: null,
            status: "failed",
            error: msg,
            startTime,
        });
        return textResult({ error: `Granola ingestion failed: ${msg}` });
    }
}
//# sourceMappingURL=ingest-granola.js.map