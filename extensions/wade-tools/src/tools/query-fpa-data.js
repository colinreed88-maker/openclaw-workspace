import { getSupabase } from "../db.js";
import { FPA_DEPT_TO_BU } from "../bu-mapping.js";
import { textResult } from "../types.js";
export const definition = {
    name: "query_fpa_data",
    description: "Query FP&A forecast/budget data directly from structured tables. ALWAYS use this for budget vs actuals, forecast line items, department P&L, headcount forecasts, or KPIs. business_unit is directly on FPA rows. Do NOT use query_financial_data for budget/forecast questions.",
    parameters: {
        type: "object",
        properties: {
            table: {
                type: "string",
                enum: ["fpa_dept_pnl_monthly", "fpa_pnl_monthly", "fpa_headcount_monthly", "fpa_employees", "fpa_vendors", "fpa_kpis"],
                description: "Which FPA table to query.",
            },
            scenario_id: {
                type: "string",
                description: "Scenario UUID. If not provided, uses the most recent active scenario.",
            },
            business_unit: {
                type: "string",
                description: "Filter to a specific BU (direct column on fpa_dept_pnl_monthly, fpa_headcount_monthly, fpa_employees). Case-sensitive.",
            },
            department: {
                type: "string",
                description: "Filter by department name.",
            },
            line_item: {
                type: "string",
                description: "Filter by line item (e.g. Total Revenue, Payroll, Total OpEx). Substring match.",
            },
            month_from: {
                type: "string",
                description: "Start month (YYYY-MM-01).",
            },
            month_to: {
                type: "string",
                description: "End month (YYYY-MM-01).",
            },
            section: {
                type: "string",
                enum: ["opco", "mena", "re_ops", "consolidated"],
                description: "For fpa_pnl_monthly: which P&L section.",
            },
            limit: { type: "number", description: "Max rows (default 50)." },
        },
        required: ["table"],
    },
};
export async function execute(_id, params) {
    const supabase = getSupabase();
    const table = params.table;
    let businessUnit = params.business_unit;
    const department = params.department;
    const lineItem = params.line_item;
    const monthFrom = params.month_from;
    const monthTo = params.month_to;
    const section = params.section;
    const limit = params.limit ?? 50;
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
    const deptHasBu = ["fpa_dept_pnl_monthly", "fpa_headcount_monthly", "fpa_employees", "fpa_dept_pnl"].includes(table);
    if (department && !businessUnit && deptHasBu) {
        const mappedBu = FPA_DEPT_TO_BU[department.toLowerCase()];
        if (mappedBu)
            businessUnit = mappedBu;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = supabase.from(table)
        .select("*")
        .eq("scenario_id", scenarioId)
        .limit(limit);
    if (businessUnit && deptHasBu) {
        q = q.eq("business_unit", businessUnit);
    }
    if (department)
        q = q.eq("department", department);
    if (section && table === "fpa_pnl_monthly")
        q = q.eq("section", section);
    if (lineItem)
        q = q.ilike("line_item", `%${lineItem}%`);
    if (monthFrom && ["fpa_dept_pnl_monthly", "fpa_pnl_monthly", "fpa_headcount_monthly"].includes(table)) {
        q = q.gte("month", monthFrom);
    }
    if (monthTo && ["fpa_dept_pnl_monthly", "fpa_pnl_monthly", "fpa_headcount_monthly"].includes(table)) {
        q = q.lte("month", monthTo);
    }
    if (["fpa_dept_pnl_monthly", "fpa_pnl_monthly"].includes(table)) {
        q = q.order("sort_order", { ascending: true });
    }
    const { data, error } = await q;
    if (error)
        return textResult({ error: error.message });
    // If department filter returned zero rows but we have a BU mapping, retry with BU only
    if ((data ?? []).length === 0 && department && businessUnit && deptHasBu) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let retryQ = supabase.from(table)
            .select("*")
            .eq("scenario_id", scenarioId)
            .eq("business_unit", businessUnit)
            .limit(limit);
        if (lineItem)
            retryQ = retryQ.ilike("line_item", `%${lineItem}%`);
        if (monthFrom && ["fpa_dept_pnl_monthly", "fpa_pnl_monthly", "fpa_headcount_monthly"].includes(table)) {
            retryQ = retryQ.gte("month", monthFrom);
        }
        if (monthTo && ["fpa_dept_pnl_monthly", "fpa_pnl_monthly", "fpa_headcount_monthly"].includes(table)) {
            retryQ = retryQ.lte("month", monthTo);
        }
        if (["fpa_dept_pnl_monthly", "fpa_pnl_monthly"].includes(table)) {
            retryQ = retryQ.order("sort_order", { ascending: true });
        }
        const { data: retryData, error: retryErr } = await retryQ;
        if (!retryErr && (retryData ?? []).length > 0) {
            return textResult({
                source: table,
                scenario_id: scenarioId,
                filters_applied: { business_unit: businessUnit, department: `${department} (resolved to BU: ${businessUnit})`, line_item: lineItem, month_from: monthFrom, month_to: monthTo, section },
                row_count: (retryData ?? []).length,
                rows: retryData ?? [],
            });
        }
    }
    return textResult({
        source: table,
        scenario_id: scenarioId,
        filters_applied: { business_unit: businessUnit ?? "ALL", department, line_item: lineItem, month_from: monthFrom, month_to: monthTo, section },
        row_count: (data ?? []).length,
        rows: data ?? [],
    });
}
//# sourceMappingURL=query-fpa-data.js.map