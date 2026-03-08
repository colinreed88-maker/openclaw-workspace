import { textResult } from "../types.js";
export const definition = {
    name: "search_web",
    description: "Search the internet for current information. Use for news, real-time data, market trends, company info, or anything not available in the knowledge base or financial tools. Returns summarized results from web pages.",
    parameters: {
        type: "object",
        properties: {
            query: { type: "string", description: "Search query (be specific for better results)" },
            max_results: { type: "number", description: "Max results to return (default 5, max 10)" },
        },
        required: ["query"],
    },
};
export async function execute(_id, params) {
    const query = params.query;
    const maxResults = params.max_results ?? 5;
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey)
        return textResult({ error: "TAVILY_API_KEY not configured." });
    try {
        const { tavily } = await import("@tavily/core");
        const client = tavily({ apiKey });
        const response = await client.search(query, {
            maxResults: Math.min(maxResults, 10),
            includeAnswer: true,
        });
        return textResult({
            answer: response.answer,
            results: response.results?.map((r) => ({
                title: r.title,
                url: r.url,
                content: r.content?.slice(0, 500),
            })),
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Web search failed: ${msg}` });
    }
}
//# sourceMappingURL=search-web.js.map