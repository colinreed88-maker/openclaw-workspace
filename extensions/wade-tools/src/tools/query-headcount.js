import { getSupabase } from "../db.js";
import { stripCompColumns } from "../comp-guard.js";
import { textResult } from "../types.js";
export const definition = {
    name: "query_headcount",
    description: "Query headcount and employee roster data directly from structured tables. ALWAYS use this for headcount questions, employee lookups, compensation queries, or department staffing. Do NOT use query_financial_data for headcount questions.",
    parameters: {
        type: "object",
        properties: {
            source: {
                type: "string",
                enum: ["current_roster", "fpa_headcount_monthly", "fpa_employees"],
                description: "current_roster = live Rippling data, fpa_headcount_monthly = forecasted FTE by month, fpa_employees = detailed employee forecast. Default: current_roster.",
            },
            business_unit: {
                type: "string",
                description: "Filter by BU. Direct column on all headcount tables.",
            },
            department: {
                type: "string",
                description: "Filter by department (Reporting_Dept on roster, department on FPA).",
            },
            employee_search: {
                type: "string",
                description: "Substring search on employee name.",
            },
            status: {
                type: "string",
                description: 'Employment status filter (e.g. "Active", "Terminated").',
            },
            month_from: {
                type: "string",
                description: "For fpa_headcount_monthly: start month (YYYY-MM-01).",
            },
            month_to: {
                type: "string",
                description: "For fpa_headcount_monthly: end month (YYYY-MM-01).",
            },
            group_by: {
                type: "string",
                enum: ["business_unit", "department", "location", "month"],
                description: "How to aggregate. Only for current_roster and fpa_headcount_monthly.",
            },
            limit: { type: "number", description: "Max rows (default 50)." },
        },
        required: [],
    },
};
export async function execute(_id, params) {
    const supabase = getSupabase();
    const source = params.source ?? "current_roster";
    const businessUnit = params.business_unit;
    const department = params.department;
    const employeeSearch = params.employee_search;
    const status = params.status;
    const monthFrom = params.month_from;
    const monthTo = params.month_to;
    const groupBy = params.group_by;
    const limit = params.limit ?? 50;
    if (source === "current_roster") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = supabase.from("mbr_current_roster").select("*").limit(limit);
        if (businessUnit)
            q = q.eq("Organization/BU", businessUnit);
        if (department)
            q = q.eq("Reporting_Dept", department);
        if (status)
            q = q.eq("Employment status", status);
        if (employeeSearch)
            q = q.ilike("Employee", `%${employeeSearch}%`);
        const { data, error } = await q;
        if (error)
            return textResult({ error: error.message });
        const rows = (data ?? []);
        if (groupBy) {
            const colMap = { business_unit: "Organization/BU", department: "Reporting_Dept", location: "Work location name" };
            const col = colMap[groupBy] ?? "Organization/BU";
            const agg = new Map();
            for (const row of rows) {
                const key = row[col] ?? "(unknown)";
                agg.set(key, (agg.get(key) ?? 0) + 1);
            }
            const sorted = Array.from(agg.entries())
                .map(([k, v]) => ({ group_key: k, headcount: v }))
                .sort((a, b) => b.headcount - a.headcount);
            const raw = JSON.stringify({ source: "mbr_current_roster", group_by: groupBy, rows: sorted, total: rows.length });
            return textResult(JSON.parse(stripCompColumns(raw)));
        }
        const raw = JSON.stringify({
            source: "mbr_current_roster",
            filters_applied: { business_unit: businessUnit ?? "ALL", department, employee_search: employeeSearch, status },
            row_count: rows.length,
            rows,
        });
        return textResult(JSON.parse(stripCompColumns(raw)));
    }
    if (source === "fpa_headcount_monthly") {
        let scenarioId = params.scenario_id;
        if (!scenarioId) {
            const { data: scenarios } = await supabase
                .from("fpa_scenarios")
                .select("id")
                .eq("is_active", true)
                .order("created_at", { ascending: false })
                .limit(1);
            scenarioId = scenarios?.[0]?.id;
            if (!scenarioId)
                return textResult({ error: "No active FPA scenario found." });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = supabase.from("fpa_headcount_monthly")
            .select("*")
            .eq("scenario_id", scenarioId)
            .order("month", { ascending: true })
            .limit(limit);
        if (businessUnit)
            q = q.eq("business_unit", businessUnit);
        if (department)
            q = q.eq("department", department);
        if (monthFrom)
            q = q.gte("month", monthFrom);
        if (monthTo)
            q = q.lte("month", monthTo);
        const { data, error } = await q;
        if (error)
            return textResult({ error: error.message });
        return textResult({ source: "fpa_headcount_monthly", scenario_id: scenarioId, row_count: (data ?? []).length, rows: data ?? [] });
    }
    if (source === "fpa_employees") {
        let scenarioId = params.scenario_id;
        if (!scenarioId) {
            const { data: scenarios } = await supabase
                .from("fpa_scenarios")
                .select("id")
                .eq("is_active", true)
                .order("created_at", { ascending: false })
                .limit(1);
            scenarioId = scenarios?.[0]?.id;
            if (!scenarioId)
                return textResult({ error: "No active FPA scenario found." });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = supabase.from("fpa_employees")
            .select("*")
            .eq("scenario_id", scenarioId)
            .limit(limit);
        if (businessUnit)
            q = q.eq("business_unit", businessUnit);
        if (department)
            q = q.eq("department", department);
        if (employeeSearch)
            q = q.ilike("employee_name", `%${employeeSearch}%`);
        if (status)
            q = q.eq("status", status);
        const { data, error } = await q;
        if (error)
            return textResult({ error: error.message });
        const raw = JSON.stringify({ source: "fpa_employees", scenario_id: scenarioId, row_count: (data ?? []).length, rows: data ?? [] });
        return textResult(JSON.parse(stripCompColumns(raw)));
    }
    return textResult({ error: `Unknown headcount source: ${source}` });
}
//# sourceMappingURL=query-headcount.js.map