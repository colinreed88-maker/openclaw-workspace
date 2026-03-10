import { createHash } from "crypto";
import { getSupabase } from "./db.js";
export function hashText(text) {
    return createHash("sha256").update(text).digest("hex");
}
export async function getWatermark(source) {
    const { data } = await getSupabase()
        .from("ingestion_log")
        .select("watermark")
        .eq("source", source)
        .eq("status", "success")
        .order("run_at", { ascending: false })
        .limit(1);
    return data?.[0]?.watermark ?? null;
}
export async function logIngestion(result) {
    const elapsed = Date.now() - result.startTime;
    await getSupabase().from("ingestion_log").insert({
        source: result.source,
        items_found: result.itemsFound,
        items_ingested: result.itemsIngested,
        items_skipped: result.itemsSkipped,
        watermark: result.watermark,
        status: result.status,
        error: result.error ?? null,
        elapsed_ms: elapsed,
        metadata: result.metadata ?? {},
    });
}
export async function docExistsBySourceId(sourceType, sourceId) {
    const { data } = await getSupabase()
        .from("knowledge_documents")
        .select("id")
        .eq("source_type", sourceType)
        .eq("source_id", sourceId)
        .limit(1);
    return (data?.length ?? 0) > 0;
}
//# sourceMappingURL=ingestion.js.map