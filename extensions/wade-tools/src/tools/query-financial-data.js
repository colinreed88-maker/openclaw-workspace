import { textResult } from "../types.js";
export const definition = {
    name: "query_financial_data",
    description: "Proxy a qualitative question to the Flow Intranet agent for knowledge base lookups, debt document search, and general business context. Use ONLY for qualitative questions and document search. Do NOT use for Ramp spend (use query_ramp_spend), GL data (use query_sage_gl), budget/forecast (use query_fpa_data), headcount (use query_headcount), or F&B metrics (use query_toast_data).",
    parameters: {
        type: "object",
        properties: {
            question: { type: "string", description: "The qualitative financial/business question to answer" },
        },
        required: ["question"],
    },
};
export async function execute(_id, params) {
    const question = params.question;
    const apiUrl = process.env.INTRANET_API_URL ?? "https://flow-intranet.vercel.app";
    const serviceKey = process.env.ASSISTANT_SERVICE_KEY ?? "";
    if (!serviceKey)
        return textResult({ error: "ASSISTANT_SERVICE_KEY not configured" });
    try {
        const res = await fetch(`${apiUrl}/api/assistant/process`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ message: question, request_id: _id }),
        });
        if (!res.ok) {
            const body = await res.text();
            return textResult({ error: `Intranet API ${res.status}: ${body}` });
        }
        const data = (await res.json());
        return textResult({ answer: data.response, tools_used: data.tools_used });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Intranet proxy failed: ${msg}` });
    }
}
//# sourceMappingURL=query-financial-data.js.map