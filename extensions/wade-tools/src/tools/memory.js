import { getSupabase } from "../db.js";
import { generateEmbedding } from "../embeddings.js";
import { textResult } from "../types.js";
export const saveMemoryDef = {
    name: "save_memory",
    description: "Save a fact, preference, rule, or correction to persistent memory. Use when you learn something new about Colin's preferences, correct an error, or want to remember important context.",
    parameters: {
        type: "object",
        properties: {
            content: { type: "string", description: "The memory content to save" },
            type: {
                type: "string",
                enum: ["fact", "preference", "rule", "correction"],
                description: "Type of memory",
            },
            correction_detail: {
                type: "string",
                description: "For corrections: what the correct information is",
            },
        },
        required: ["content", "type"],
    },
};
export const searchMemoriesDef = {
    name: "search_memories",
    description: "Search persistent memories for relevant context, corrections, and past mistakes. ALWAYS search memories before answering financial questions to check for known corrections.",
    parameters: {
        type: "object",
        properties: {
            query: { type: "string", description: "What to search for in memories" },
        },
        required: ["query"],
    },
};
export const forgetMemoryDef = {
    name: "forget_memory",
    description: "Removes a previously saved memory. Use when the user says to forget something, stop doing something, or a previous fact/rule no longer applies. Searches by semantic similarity and deletes the best match.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Description of the memory to forget. Will be matched by semantic similarity.",
            },
        },
        required: ["query"],
    },
};
export async function saveMemory(_id, params) {
    const supabase = getSupabase();
    const content = params.content;
    const type = params.type;
    const correctionDetail = params.correction_detail;
    const embeddingText = correctionDetail ? `${content} ${correctionDetail}` : content;
    let embedding = null;
    try {
        embedding = await generateEmbedding(embeddingText);
    }
    catch (err) {
        console.warn("[wade-tools] Embedding generation failed for save_memory, saving without:", err);
    }
    const { error } = await supabase.from("agent_memories").insert({
        content,
        type,
        correction_detail: correctionDetail ?? null,
        relevance_score: 1.0,
        ...(embedding ? { embedding: JSON.stringify(embedding) } : {}),
    });
    if (error)
        return textResult({ error: error.message });
    return textResult({ saved: true, content, type });
}
export async function searchMemories(_id, params) {
    const supabase = getSupabase();
    const query = params.query;
    try {
        const embedding = await generateEmbedding(query);
        const { data, error } = await supabase.rpc("match_memories", {
            query_embedding: JSON.stringify(embedding),
            match_count: 10,
            similarity_threshold: 0.5,
        });
        if (!error && data?.length) {
            return textResult(data);
        }
    }
    catch (err) {
        console.warn("[wade-tools] Vector search failed, falling back to text:", err);
    }
    const { data, error } = await supabase
        .from("agent_memories")
        .select("id, type, content, correction_detail, relevance_score")
        .or(`content.ilike.%${query}%,correction_detail.ilike.%${query}%`)
        .order("relevance_score", { ascending: false })
        .limit(10);
    if (error)
        return textResult({ error: error.message });
    return textResult(data ?? []);
}
export async function forgetMemory(_id, params) {
    const supabase = getSupabase();
    const query = params.query;
    if (!query?.trim())
        return textResult({ error: "Query is required." });
    try {
        const embedding = await generateEmbedding(query);
        const { data: matches } = await supabase.rpc("match_memories", {
            query_embedding: JSON.stringify(embedding),
            match_count: 1,
            similarity_threshold: 0.6,
        });
        if (!matches || matches.length === 0) {
            return textResult({ found: false, message: "No matching memory found to forget." });
        }
        const match = matches[0];
        const { error: delErr } = await supabase
            .from("agent_memories")
            .delete()
            .eq("id", match.id);
        if (delErr) {
            return textResult({ error: "Found the memory but failed to delete it." });
        }
        return textResult({
            success: true,
            forgotten: { type: match.type, content: match.content },
            message: `Forgotten: "${match.content}"`,
        });
    }
    catch (err) {
        return textResult({ error: err instanceof Error ? err.message : String(err) });
    }
}
//# sourceMappingURL=memory.js.map