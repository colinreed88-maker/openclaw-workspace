import { querySnowflake } from "../snowflake.js";
import { textResult } from "../types.js";
const BLOCKED_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE",
    "ALTER", "CREATE", "REPLACE", "MERGE", "GRANT", "REVOKE",
];
const MAX_ROWS = 5000;
const LLM_ROW_CAP = 200;
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
function isMutating(sql) {
    const upper = sql.toUpperCase().replace(/\s+/g, " ").trim();
    for (const keyword of BLOCKED_KEYWORDS) {
        if (upper.startsWith(keyword) || upper.includes(` ${keyword} `)) {
            return keyword;
        }
    }
    return null;
}
function addLimitIfNeeded(sql) {
    const upper = sql.toUpperCase().replace(/\s+/g, " ").trim();
    const clean = sql.trim().replace(/;+\s*$/, "");
    if (!upper.includes("LIMIT") && (upper.startsWith("SELECT") || upper.startsWith("WITH"))) {
        return `${clean} LIMIT ${MAX_ROWS}`;
    }
    return clean;
}
export async function execute(_id, params) {
    const sql = params.sql;
    if (!sql?.trim())
        return textResult({ error: "sql parameter is required" });
    const blocked = isMutating(sql);
    if (blocked)
        return textResult({ error: `Mutating operations are not allowed: ${blocked}` });
    const safeSql = addLimitIfNeeded(sql);
    try {
        const result = await querySnowflake(safeSql);
        return textResult({
            source: "snowflake",
            description: params.description,
            columns: result.columns,
            row_count: result.totalRows,
            rows: result.rows.slice(0, LLM_ROW_CAP),
            truncated: result.totalRows > LLM_ROW_CAP,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: msg });
    }
}
//# sourceMappingURL=query-snowflake.js.map