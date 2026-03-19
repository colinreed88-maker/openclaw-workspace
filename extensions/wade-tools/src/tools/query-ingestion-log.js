import { getSupabase } from "../db.js";
import { textResult } from "../types.js";
export const definition = {
    name: "query_ingestion_log",
    description: "Check the status of Wade's knowledge ingestion pipelines. Shows recent sync runs, success/failure, items ingested, and timing. Use during heartbeats, daily digests, or when diagnosing stale knowledge.",
    parameters: {
        type: "object",
        properties: {
            source: {
                type: "string",
                description: "Filter by source (calendar, granola, rss). Omit to see all sources.",
            },
            limit: {
                type: "number",
                description: "Number of recent runs to return (default 10, max 50)",
            },
            status: {
                type: "string",
                enum: ["success", "partial", "failed"],
                description: "Filter by status. Omit to see all.",
            },
        },
    },
};
export async function execute(_id, params) {
    const source = params.source;
    const limit = Math.min(params.limit ?? 10, 50);
    const status = params.status;
    try {
        let query = getSupabase()
            .from("ingestion_log")
            .select("*")
            .order("run_at", { ascending: false })
            .limit(limit);
        if (source)
            query = query.eq("source", source);
        if (status)
            query = query.eq("status", status);
        const { data, error } = await query;
        if (error)
            return textResult({ error: error.message });
        const rows = data ?? [];
        if (rows.length === 0) {
            return textResult({
                results: [],
                message: source
                    ? `No ingestion runs found for source "${source}".`
                    : "No ingestion runs found.",
            });
        }
        const formatted = rows.map((r) => ({
            source: r.source,
            run_at: r.run_at,
            status: r.status,
            items: `${r.items_ingested} ingested / ${r.items_found} found / ${r.items_skipped} skipped`,
            elapsed: r.elapsed_ms ? `${(r.elapsed_ms / 1000).toFixed(1)}s` : null,
            error: r.error,
            watermark: r.watermark,
        }));
        // Summary by source
        const sources = new Map();
        for (const r of rows) {
            if (!sources.has(r.source)) {
                sources.set(r.source, {
                    last_run: r.run_at,
                    last_status: r.status,
                    total_ingested: r.items_ingested,
                });
            }
            else {
                sources.get(r.source).total_ingested += r.items_ingested;
            }
        }
        return textResult({
            result_count: formatted.length,
            summary: Object.fromEntries(sources),
            runs: formatted,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Ingestion log query failed: ${msg}` });
    }
}
//# sourceMappingURL=query-ingestion-log.js.map