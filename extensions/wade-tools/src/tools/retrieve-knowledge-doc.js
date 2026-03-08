import { getSupabase } from "../db.js";
import { textResult } from "../types.js";
export const definition = {
    name: "retrieve_knowledge_doc",
    description: "Search for a document in the Flow knowledge base by title. Returns metadata and a signed download URL. Use when the user asks for a specific document, SOP, report, or file from the knowledge base.",
    parameters: {
        type: "object",
        properties: {
            title_search: {
                type: "string",
                description: "Search term to match against document titles (case-insensitive substring match).",
            },
            limit: {
                type: "number",
                description: "Max documents to return (default 5).",
            },
        },
        required: ["title_search"],
    },
};
export async function execute(_id, params) {
    const supabase = getSupabase();
    const titleSearch = params.title_search;
    const limit = params.limit ?? 5;
    const { data: docs, error } = await supabase
        .from("knowledge_documents")
        .select("id, title, storage_path, required_page_key, chunk_count, created_at")
        .eq("status", "active")
        .ilike("title", `%${titleSearch}%`)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error)
        return textResult({ error: error.message });
    if (!docs?.length)
        return textResult({ results: [], message: `No documents found matching "${titleSearch}".` });
    const results = await Promise.all(docs.map(async (doc) => {
        let signedUrl = null;
        if (doc.storage_path) {
            const { data } = await supabase.storage
                .from("knowledge-docs")
                .createSignedUrl(doc.storage_path, 3600);
            signedUrl = data?.signedUrl ?? null;
        }
        return {
            id: doc.id,
            title: doc.title,
            page_key: doc.required_page_key,
            chunk_count: doc.chunk_count,
            created_at: doc.created_at,
            download_url: signedUrl,
        };
    }));
    return textResult({ results, count: results.length });
}
//# sourceMappingURL=retrieve-knowledge-doc.js.map