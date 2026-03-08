import { textResult } from "../types.js";
export const definition = {
    name: "search_web",
    description: "Search the internet for current information. Use for news, real-time data, market trends, company info, or anything not available in the knowledge base or financial tools. Returns summarized results from web pages.",
    parameters: {
        type: "object",
        properties: {
            query: { type: "string", description: "Search query (be specific for better results)" },
            max_results: { type: "number", description: "Max results to return (default 5, max 10)" },
            search_depth: {
                type: "string",
                enum: ["basic", "advanced"],
                description: "Search depth. 'advanced' does deeper scraping for more thorough results (default 'basic').",
            },
            topic: {
                type: "string",
                enum: ["general", "news"],
                description: "Search topic. Use 'news' for recent news, market events, current affairs (default 'general').",
            },
            include_domains: {
                type: "array",
                items: { type: "string" },
                description: "Only include results from these domains. E.g. ['reuters.com', 'bloomberg.com']",
            },
            exclude_domains: {
                type: "array",
                items: { type: "string" },
                description: "Exclude results from these domains.",
            },
        },
        required: ["query"],
    },
};
export async function execute(_id, params) {
    const query = params.query;
    const maxResults = params.max_results ?? 5;
    const searchDepth = params.search_depth ?? "basic";
    const topic = params.topic ?? "general";
    const includeDomains = params.include_domains;
    const excludeDomains = params.exclude_domains;
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey)
        return textResult({ error: "TAVILY_API_KEY not configured." });
    try {
        const { tavily } = await import("@tavily/core");
        const client = tavily({ apiKey });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opts = {
            maxResults: Math.min(maxResults, 10),
            includeAnswer: true,
            searchDepth,
            topic,
        };
        if (includeDomains?.length)
            opts.includeDomains = includeDomains;
        if (excludeDomains?.length)
            opts.excludeDomains = excludeDomains;
        const response = await client.search(query, opts);
        const contentLimit = searchDepth === "advanced" ? 1000 : 500;
        return textResult({
            answer: response.answer,
            results: response.results?.map((r) => ({
                title: r.title,
                url: r.url,
                content: r.content?.slice(0, contentLimit),
            })),
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Web search failed: ${msg}` });
    }
}
//# sourceMappingURL=search-web.js.map