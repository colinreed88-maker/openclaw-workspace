import { textResult } from "../types.js";
export const definition = {
    name: "query_snowflake",
    description: `Execute a read-only SQL query against the Snowflake ANALYTICS data warehouse. ` +
        `Use for property operations data: leasing funnel, tenants, occupancy, rent rolls, ` +
        `work orders, pricing/renewals, Yardi financial transactions, tenant arrears, ` +
        `hotel reservations, marketing spend, and market comps. ` +
        `Only SELECT statements allowed. Results capped at 5,000 rows. ` +
        `All tables are in the ANALYTICS database. Key schemas: ` +
        `MULTIFAMILY (prospects, tenants, occupancy, rent roll, renewals, leasing events), ` +
        `OPERATIONS (work orders, unit rents, concessions, hotel), ` +
        `FINANCIAL (Yardi transactions, tenant arrears, lease charges), ` +
        `HOUSE (pre-aggregated leasing funnels), ` +
        `PRICING (competitor listings, market comps), ` +
        `MARKETING (daily spend, acquisition costs), ` +
        `HOTEL (reservations, daily summaries), ` +
        `FLOW (master property and unit reference). ` +
        `Do NOT use for Ramp spend (use query_ramp_spend), Sage GL (use query_sage_gl), ` +
        `Toast F&B (use query_toast_data), or budget/forecast (use query_supabase).`,
    parameters: {
        type: "object",
        properties: {
            sql: {
                type: "string",
                description: "The SELECT query to execute. Use fully qualified table names like ANALYTICS.MULTIFAMILY.TENANTS. " +
                    "Common tables: MULTIFAMILY.PROSPECT_DETAILS, MULTIFAMILY.TENANTS, MULTIFAMILY.DAILY_OCCUPANCY, " +
                    "MULTIFAMILY.US_RENT_ROLL_CURRENT, MULTIFAMILY.RENEWALS, MULTIFAMILY.LEASING_DAILY_ACTIVITY, " +
                    "OPERATIONS.YARDI_WORK_ORDERS, OPERATIONS.UNIT_RENTS, OPERATIONS.CONCESSIONS, " +
                    "FINANCIAL.TRANSACTIONS, FINANCIAL.TENANT_ARREARS, " +
                    "HOUSE.GROSS_LEASING_FUNNEL, FLOW.PROPERTIES.",
            },
            description: {
                type: "string",
                description: "Brief description of what this query is answering (for logging).",
            },
        },
        required: ["sql"],
    },
};
export async function execute(_id, params) {
    const sql = params.sql;
    if (!sql?.trim())
        return textResult({ error: "sql parameter is required" });
    const apiUrl = process.env.INTRANET_API_URL ?? "https://flow-intranet.vercel.app";
    const token = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!token)
        return textResult({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" });
    try {
        const res = await fetch(`${apiUrl}/api/snowflake/query?token=${encodeURIComponent(token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sql, database: "ANALYTICS" }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({ error: res.statusText }));
            return textResult({ error: body.error ?? `Snowflake API ${res.status}` });
        }
        const data = await res.json();
        return textResult({
            source: "snowflake",
            description: params.description,
            columns: data.columns,
            row_count: data.totalRows ?? data.rows?.length,
            rows: data.rows?.slice(0, 200),
            truncated: (data.rows?.length ?? 0) > 200,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Snowflake query failed: ${msg}` });
    }
}
//# sourceMappingURL=query-snowflake.js.map