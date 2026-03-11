import { readFileSync, writeFileSync } from "fs";
import { getSupabase } from "../db.js";
import { createEmbeddingBatch } from "../embeddings.js";
import { chunkText } from "../chunking.js";
import { hashText, getWatermark, logIngestion, docExistsBySourceId } from "../ingestion.js";
import { textResult } from "../types.js";
const PAGE_KEY = "wade-private";
const SOURCE_TYPE = "rss";
const EMBED_BATCH = 50;
const RSS_CONFIG_PATH = "/data/.openclaw/rss-feeds.json";
const DEFAULT_FEEDS = [
    // Hospitality
    { name: "Skift", url: "https://skift.com/feed/", category: "hospitality" },
    { name: "Hotel News Now", url: "https://www.hotelnewsnow.com/rss", category: "hospitality" },
    // AI / Tech
    { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/", category: "ai" },
    { name: "Ars Technica AI", url: "https://feeds.arstechnica.com/arstechnica/technology-lab", category: "tech" },
    { name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", category: "ai" },
    // Finance
    { name: "Calculated Risk", url: "https://www.calculatedriskblog.com/feeds/posts/default?alt=rss", category: "finance" },
];
function loadPersistedFeeds() {
    try {
        return JSON.parse(readFileSync(RSS_CONFIG_PATH, "utf8"));
    }
    catch {
        return DEFAULT_FEEDS;
    }
}
function savePersistedFeeds(feeds) {
    writeFileSync(RSS_CONFIG_PATH, JSON.stringify(feeds, null, 2));
}
export const definition = {
    name: "ingest_rss",
    description: "Fetch and ingest new articles from RSS feeds into Wade's knowledge base. Each article is summarized, chunked, embedded, and stored. Run by cron every 6 hours or manually.",
    parameters: {
        type: "object",
        properties: {
            feeds: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        url: { type: "string" },
                        category: { type: "string" },
                    },
                },
                description: "Optional: override the feed list for this run. Each item needs name, url, category. Use with save_feeds: true to persist permanently.",
            },
            save_feeds: {
                type: "boolean",
                description: "If true, save the provided feeds list as the new default for all future runs. Stored at /data/.openclaw/rss-feeds.json on the persistent volume (survives redeploys). Requires feeds to be provided.",
            },
            max_articles_per_feed: {
                type: "number",
                description: "Max new articles to ingest per feed (default 5)",
            },
        },
    },
};
function extractCDATA(text) {
    return text.replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1");
}
function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}
function parseXmlFeed(xml) {
    const items = [];
    // RSS 2.0: <item>...</item>
    const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
    // Atom: <entry>...</entry>
    const entryMatches = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
    for (const block of [...itemMatches, ...entryMatches]) {
        const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i)
            ?? block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
        const pubMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
            ?? block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)
            ?? block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
        const contentMatch = block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)
            ?? block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)
            ?? block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)
            ?? block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
        const title = titleMatch ? stripHtml(extractCDATA(titleMatch[1])).trim() : "";
        const link = linkMatch ? extractCDATA(linkMatch[1]).trim() : "";
        const pubDate = pubMatch ? extractCDATA(pubMatch[1]).trim() : "";
        const rawContent = contentMatch ? extractCDATA(contentMatch[1]) : "";
        const content = stripHtml(rawContent);
        if (title && (content || link)) {
            items.push({ title, link, pubDate, content });
        }
    }
    return items;
}
export async function execute(_id, params) {
    const feeds = params.feeds ?? loadPersistedFeeds();
    if (params.save_feeds && params.feeds) {
        savePersistedFeeds(params.feeds);
    }
    const maxPerFeed = params.max_articles_per_feed ?? 5;
    const startTime = Date.now();
    const supabase = getSupabase();
    let itemsFound = 0;
    let itemsIngested = 0;
    let itemsSkipped = 0;
    const feedSummaries = [];
    try {
        const watermark = await getWatermark(SOURCE_TYPE);
        const watermarkDate = watermark ? new Date(watermark) : new Date(Date.now() - 24 * 3600 * 1000);
        let latestDate = watermarkDate;
        for (const feed of feeds) {
            let feedIngested = 0;
            try {
                const res = await fetch(feed.url, {
                    headers: { "User-Agent": "Wade-AI-Assistant/1.0" },
                    signal: AbortSignal.timeout(15000),
                });
                if (!res.ok) {
                    feedSummaries.push(`${feed.name}: HTTP ${res.status}`);
                    continue;
                }
                const xml = await res.text();
                const items = parseXmlFeed(xml);
                const newItems = items
                    .filter((item) => {
                    if (!item.pubDate)
                        return true;
                    try {
                        return new Date(item.pubDate) > watermarkDate;
                    }
                    catch {
                        return true;
                    }
                })
                    .slice(0, maxPerFeed);
                itemsFound += newItems.length;
                for (const item of newItems) {
                    const sourceId = `rss:${hashText(item.link || item.title).slice(0, 16)}`;
                    const exists = await docExistsBySourceId(SOURCE_TYPE, sourceId);
                    if (exists) {
                        itemsSkipped++;
                        continue;
                    }
                    const articleText = [
                        `${item.title}`,
                        `Source: ${feed.name} (${feed.category})`,
                        item.link ? `URL: ${item.link}` : "",
                        item.pubDate ? `Published: ${item.pubDate}` : "",
                        "",
                        item.content.slice(0, 3000),
                    ]
                        .filter(Boolean)
                        .join("\n");
                    const contentHash = hashText(articleText);
                    const { data: doc, error: docErr } = await supabase
                        .from("knowledge_documents")
                        .insert({
                        source_type: SOURCE_TYPE,
                        source_id: sourceId,
                        source_url: item.link || null,
                        title: `RSS: ${item.title}`,
                        file_hash: contentHash,
                        required_page_key: PAGE_KEY,
                        status: "processing",
                    })
                        .select("id")
                        .single();
                    if (docErr || !doc) {
                        itemsSkipped++;
                        continue;
                    }
                    const chunks = chunkText(articleText);
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
                                feed_name: feed.name,
                                feed_category: feed.category,
                                article_title: item.title,
                                article_url: item.link,
                                published: item.pubDate || null,
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
                    feedIngested++;
                    itemsIngested++;
                    if (item.pubDate) {
                        try {
                            const d = new Date(item.pubDate);
                            if (d > latestDate)
                                latestDate = d;
                        }
                        catch { /* skip */ }
                    }
                }
                feedSummaries.push(`${feed.name}: ${feedIngested} new articles`);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                feedSummaries.push(`${feed.name}: error — ${msg}`);
            }
        }
        await logIngestion({
            source: SOURCE_TYPE,
            itemsFound,
            itemsIngested,
            itemsSkipped,
            watermark: latestDate.toISOString(),
            status: itemsIngested > 0 || itemsFound === 0 ? "success" : "partial",
            startTime,
            metadata: { feeds: feedSummaries },
        });
        return textResult({
            success: true,
            feeds_checked: feeds.length,
            articles_found: itemsFound,
            articles_ingested: itemsIngested,
            articles_skipped: itemsSkipped,
            feeds: feedSummaries,
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
        return textResult({ error: `RSS ingestion failed: ${msg}` });
    }
}
//# sourceMappingURL=ingest-rss.js.map