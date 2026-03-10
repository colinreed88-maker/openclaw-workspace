import OpenAI from "openai";
let _openai = null;
function getClient() {
    if (!_openai) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey)
            throw new Error("OPENAI_API_KEY not configured");
        _openai = new OpenAI({ apiKey });
    }
    return _openai;
}
export async function createEmbedding(text) {
    const response = await getClient().embeddings.create({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
}
export async function createEmbeddingBatch(texts) {
    const truncated = texts.map((t) => t.slice(0, 8000));
    const response = await getClient().embeddings.create({
        model: "text-embedding-3-small",
        input: truncated,
    });
    return response.data.map((d) => d.embedding);
}
//# sourceMappingURL=embeddings.js.map