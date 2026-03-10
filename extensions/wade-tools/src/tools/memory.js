import { getSupabase } from "../db.js";
import { createEmbedding } from "../embeddings.js";
import { textResult } from "../types.js";
export const saveMemoryDef = {
    name: "save_memory",
    description: "Save a fact, preference, rule, or correction to persistent memory with semantic embedding. Use when you learn something new about a user's preferences, correct an error, or want to remember important context across conversations.",
    parameters: {
        type: "object",
        properties: {
            content: {
                type: "string",
                description: "The memory content to save (will be embedded for semantic retrieval)",
            },
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
    description: "Semantic search over persistent memories — corrections, facts, preferences, and rules. Search memories before answering questions to check for known corrections and user preferences.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Natural language search query",
            },
            types: {
                type: "array",
                items: { type: "string", enum: ["fact", "preference", "rule", "correction"] },
                description: "Optional: filter by memory type(s)",
            },
            limit: {
                type: "number",
                description: "Max memories to return (default 5, max 15)",
            },
        },
        required: ["query"],
    },
};
export const forgetMemoryDef = {
    name: "forget_memory",
    description: "Remove a previously saved memory. Searches semantically and deletes the closest match. Use when a user says to forget something or a previous fact no longer applies.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Description of the memory to forget",
            },
        },
        required: ["query"],
    },
};
export async function saveMemory(_id, params) {
    const content = params.content;
    const type = params.type;
    const correctionDetail = params.correction_detail;
    try {
        const embedding = await createEmbedding(content);
        const { error } = await getSupabase().from("agent_memories").insert({
            content,
            type,
            correction_detail: correctionDetail ?? null,
            embedding: JSON.stringify(embedding),
        });
        if (error)
            return textResult({ error: error.message });
        return textResult({ saved: true, content, type });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Failed to save memory: ${msg}` });
    }
}
export async function searchMemories(_id, params) {
    const query = params.query;
    const types = params.types;
    const limit = Math.min(params.limit ?? 5, 15);
    try {
        const embedding = await createEmbedding(query);
        const { data, error } = await getSupabase().rpc("match_memories", {
            query_embedding: JSON.stringify(embedding),
            match_count: limit,
            similarity_threshold: 0.7,
            memory_types: types?.length ? types : null,
        });
        if (error)
            return textResult({ error: error.message });
        const results = data ?? [];
        if (results.length === 0) {
            return textResult({ query, results: [], message: "No matching memories found." });
        }
        const formatted = results.map((r) => ({
            id: r.id,
            type: r.type,
            content: r.content,
            correction_detail: r.correction_detail,
            similarity: Math.round(r.similarity * 1000) / 1000,
        }));
        return textResult({ query, result_count: formatted.length, results: formatted });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Memory search failed: ${msg}` });
    }
}
export async function forgetMemory(_id, params) {
    const query = params.query;
    if (!query?.trim())
        return textResult({ error: "Query is required." });
    try {
        const embedding = await createEmbedding(query);
        const { data, error } = await getSupabase().rpc("match_memories", {
            query_embedding: JSON.stringify(embedding),
            match_count: 1,
            similarity_threshold: 0.5,
            memory_types: null,
        });
        if (error)
            return textResult({ error: error.message });
        const matches = data ?? [];
        if (!matches.length) {
            return textResult({ found: false, message: "No matching memory found to forget." });
        }
        const match = matches[0];
        const { error: delErr } = await getSupabase()
            .from("agent_memories")
            .delete()
            .eq("id", match.id);
        if (delErr)
            return textResult({ error: "Found the memory but failed to delete it." });
        return textResult({
            success: true,
            forgotten: { type: match.type, content: match.content },
            message: `Forgotten: "${match.content}"`,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Forget failed: ${msg}` });
    }
}
//# sourceMappingURL=memory.js.map