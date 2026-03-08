import { getSupabase } from "../db.js";
import { textResult } from "../types.js";
export const definition = {
    name: "query_supabase",
    description: "Run a read-only query against Supabase tables. Available tables include: ramp_transactions (card spend), ramp_bills (vendor bills), app_config (key-value config — use key='mbr_last_closed_month' to check which month Sage is closed through), assistant_jobs, assistant_actions, sync_log, scheduled_tasks, agent_memories, dim_bu_mapping.",
    parameters: {
        type: "object",
        properties: {
            table: {
                type: "string",
                description: "Table name (ramp_transactions, ramp_bills, assistant_jobs, assistant_actions, sync_log, scheduled_tasks, dim_bu_mapping, agent_memories)",
            },
            select: { type: "string", description: "Column selection (Supabase select syntax)" },
            filters: {
                type: "object",
                description: "Key-value pairs for eq filters",
                additionalProperties: { type: "string" },
            },
            order_by: { type: "string", description: "Column to order by" },
            ascending: { type: "boolean", description: "Sort ascending (default false)" },
            limit: { type: "number", description: "Max rows (default 20)" },
        },
        required: ["table"],
    },
};
export async function execute(_id, params) {
    const supabase = getSupabase();
    const table = params.table;
    const select = params.select ?? "*";
    const filters = params.filters ?? {};
    const orderBy = params.order_by;
    const ascending = params.ascending ?? false;
    const limit = params.limit ?? 20;
    let query = supabase.from(table).select(select);
    for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
    }
    if (orderBy) {
        query = query.order(orderBy, { ascending });
    }
    query = query.limit(limit);
    const { data, error } = await query;
    if (error)
        return textResult({ error: error.message });
    return textResult(data ?? []);
}
//# sourceMappingURL=query-supabase.js.map