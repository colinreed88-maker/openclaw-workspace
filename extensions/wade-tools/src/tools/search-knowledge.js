import { getSupabase } from "../db.js";
import { createEmbedding } from "../embeddings.js";
import { textResult } from "../types.js";
const ALL_PAGE_KEYS = [
    "all", "wade-private", "ask", "ramp", "hr", "fpa",
    "debt", "toast", "intacct", "admin",
];
export const definition = {
    name: "search_knowledge",
    description: "Semantic search over Wade's knowledge base — meeting notes, Slack history, calendar context, RSS articles, financial data, SOPs, and more. Use this as the primary tool for qualitative questions, document lookup, and business context. Returns the most relevant chunks ranked by similarity.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Natural language search query",
            },
            source_filter: {
                type: "string",
                description: "Optional: filter by source type (e.g. 'slack', 'granola', 'rss', 'calendar', 'supabase', 'upload'). Omit to search all sources.",
            },
            limit: {
                type: "number",
                description: "Max chunks to return (default 10, max 20)",
            },
            threshold: {
                type: "number",
                description: "Minimum similarity score 0-1 (default 0.7)",
            },
        },
        required: ["query"],
    },
};
export async function execute(_id, params) {
    const query = params.query;
    const sourceFilter = params.source_filter;
    const limit = Math.min(params.limit ?? 10, 20);
    const threshold = params.threshold ?? 0.7;
    try {
        const embedding = await createEmbedding(query);
        const { data, error } = await getSupabase().rpc("match_knowledge_chunks", {
            query_embedding: JSON.stringify(embedding),
            user_page_keys: ALL_PAGE_KEYS,
            match_count: sourceFilter ? limit * 3 : limit,
            similarity_threshold: threshold,
        });
        if (error)
            return textResult({ error: error.message });
        let results = data ?? [];
        if (sourceFilter) {
            results = results.filter((r) => {
                const meta = r.metadata;
                return meta?.source === sourceFilter;
            });
        }
        results = results.slice(0, limit);
        if (results.length === 0) {
            return textResult({
                query,
                results: [],
                message: "No matching knowledge found. Try broadening the query or lowering the threshold.",
            });
        }
        const formatted = results.map((r) => ({
            title: r.title,
            text: r.chunk_text,
            similarity: Math.round(r.similarity * 1000) / 1000,
            source: r.metadata?.source ?? "unknown",
            source_url: r.source_url,
            metadata: r.metadata,
        }));
        return textResult({
            query,
            result_count: formatted.length,
            results: formatted,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Knowledge search failed: ${msg}` });
    }
}
//# sourceMappingURL=search-knowledge.js.map