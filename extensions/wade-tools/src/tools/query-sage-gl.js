import { getSupabase } from "../db.js";
import { resolveBudgetDeptToSageDepts, resolveDeptNamesToIds, loadDeptIdToName, loadAccountNoToTitle, loadFsMapping, loadBuMapping, loadBuMappingByDeptId, } from "../bu-mapping.js";
import { textResult } from "../types.js";
export const definition = {
    name: "query_sage_gl",
    description: "Query Sage Intacct GL data (journal entries, monthly balances by department) directly from structured tables. ALWAYS use this for any question about GL detail, journal entries, account balances, or Sage accounting data. Resolves BU from department via dim_bu_mapping. Do NOT use query_financial_data for GL questions.",
    parameters: {
        type: "object",
        properties: {
            business_unit: {
                type: "string",
                description: 'Filter to a specific BU. Must be exact: "Executive", "Tech", "Growth & Revenue", "F&B", "Hotel", "Property Mgmt", "Real Estate & Dev", "Shared Services", "MENA". Resolved via dim_bu_mapping.',
            },
            department: {
                type: "string",
                description: 'Filter by budget department name (e.g. "Finance", "People", "Legal", "Engineering"). Resolves via dim_bu_mapping to the correct set of Sage department IDs. PREFERRED over department_id when asking about a department.',
            },
            department_id: {
                type: "string",
                description: "Sage department ID (e.g. Asset Management, Marketing). Exact match. Use 'department' instead when filtering by budget department.",
            },
            entity_id: {
                type: "string",
                description: "Sage entity/location ID.",
            },
            account_no: {
                type: "string",
                description: "GL account number (e.g. 63570).",
            },
            date_from: {
                type: "string",
                description: "Start date (YYYY-MM-DD) for GL detail, or year_month (YYYY-MM) for monthly balances.",
            },
            date_to: {
                type: "string",
                description: "End date (YYYY-MM-DD) for GL detail, or year_month (YYYY-MM) for monthly balances.",
            },
            source: {
                type: "string",
                enum: ["gl_detail", "monthly_dept_balances"],
                description: "Which table to query. gl_detail = individual journal entries, monthly_dept_balances = pre-aggregated monthly by dept+account. Default: monthly_dept_balances.",
            },
            group_by: {
                type: "string",
                enum: ["department", "account", "entity", "month", "business_unit", "pnl_bucket"],
                description: "How to aggregate results. 'pnl_bucket' groups GL accounts into P&L line items using dim_fs_mapping — USE THIS for department P&L summaries. Default: department.",
            },
            limit: { type: "number", description: "Max rows (default 50)." },
        },
        required: [],
    },
};
export async function execute(_id, params) {
    const supabase = getSupabase();
    const businessUnit = params.business_unit;
    const department = params.department;
    const departmentId = params.department_id;
    const entityId = params.entity_id;
    const accountNo = params.account_no;
    const dateFrom = params.date_from;
    const dateTo = params.date_to;
    const source = params.source ?? "monthly_dept_balances";
    const groupBy = params.group_by ?? "department";
    const limit = params.limit ?? 50;
    let budgetDeptFilter = null;
    if (department) {
        const deptNames = await resolveBudgetDeptToSageDepts(department);
        if (deptNames.length === 0) {
            return textResult({ error: `No Sage departments mapped to budget department "${department}".` });
        }
        budgetDeptFilter = await resolveDeptNamesToIds(deptNames);
        if (budgetDeptFilter.length === 0) {
            return textResult({ error: `Sage departments found for "${department}" but no matching department_id codes in intacct_departments.` });
        }
    }
    let buDeptFilter = null;
    if (businessUnit) {
        const buMap = await loadBuMapping();
        const buDeptNames = Array.from(buMap.entries())
            .filter(([, bu]) => bu === businessUnit)
            .map(([dept]) => dept);
        if (buDeptNames.length === 0) {
            return textResult({ error: `No Sage departments mapped to BU "${businessUnit}".` });
        }
        buDeptFilter = await resolveDeptNamesToIds(buDeptNames);
    }
    const effectiveDeptFilter = budgetDeptFilter ?? buDeptFilter;
    if (source === "gl_detail") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = supabase.from("intacct_gl_detail")
            .select("*")
            .order("entry_date", { ascending: false })
            .limit(limit);
        if (departmentId)
            q = q.eq("department_id", departmentId);
        if (effectiveDeptFilter && !departmentId)
            q = q.in("department_id", effectiveDeptFilter);
        if (entityId)
            q = q.eq("location_id", entityId);
        if (accountNo)
            q = q.eq("account_no", accountNo);
        if (dateFrom)
            q = q.gte("entry_date", dateFrom);
        if (dateTo)
            q = q.lte("entry_date", dateTo);
        const { data, error } = await q;
        if (error)
            return textResult({ error: error.message });
        const rows = (data ?? []);
        const [buIdMap, deptNameMap] = await Promise.all([loadBuMappingByDeptId(), loadDeptIdToName()]);
        const enriched = rows.map((r) => ({
            ...r,
            resolved_department: deptNameMap.get(r.department_id) ?? r.department_id,
            resolved_bu: buIdMap.get(r.department_id) ?? "(unmapped)",
        }));
        return textResult({
            source: "intacct_gl_detail",
            filters_applied: { business_unit: businessUnit ?? "ALL", department, department_id: departmentId, sage_dept_ids_resolved: effectiveDeptFilter, entity_id: entityId, account_no: accountNo, date_from: dateFrom, date_to: dateTo },
            row_count: enriched.length,
            rows: enriched,
        });
    }
    // monthly_dept_balances (default)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = supabase.from("intacct_monthly_dept_balances")
        .select("*")
        .order("year_month", { ascending: false })
        .limit(5000);
    if (departmentId)
        q = q.eq("department_id", departmentId);
    if (effectiveDeptFilter && !departmentId)
        q = q.in("department_id", effectiveDeptFilter);
    if (entityId)
        q = q.eq("entity_id", entityId);
    if (accountNo)
        q = q.eq("account_no", accountNo);
    if (dateFrom)
        q = q.gte("year_month", dateFrom.slice(0, 7));
    if (dateTo)
        q = q.lte("year_month", dateTo.slice(0, 7));
    const { data, error } = await q;
    if (error)
        return textResult({ error: error.message });
    const rows = (data ?? []);
    const needAcctNames = groupBy === "account";
    const needFsMapping = groupBy === "pnl_bucket";
    const emptyFsMap = new Map();
    const [buIdMap, deptNameMap, acctNameMap, fsMap] = await Promise.all([
        loadBuMappingByDeptId(),
        loadDeptIdToName(),
        needAcctNames ? loadAccountNoToTitle() : Promise.resolve(new Map()),
        needFsMapping ? loadFsMapping() : Promise.resolve(emptyFsMap),
    ]);
    const agg = new Map();
    const groupCol = {
        department: "department_id",
        account: "account_no",
        entity: "entity_id",
        month: "year_month",
        business_unit: "department_id",
        pnl_bucket: "account_no",
    };
    const col = groupCol[groupBy] ?? "department_id";
    for (const row of rows) {
        let key = row[col] ?? "(unknown)";
        if (groupBy === "business_unit")
            key = buIdMap.get(key) ?? "(unmapped)";
        if (groupBy === "department")
            key = deptNameMap.get(key) ?? key;
        if (groupBy === "pnl_bucket") {
            const entry = fsMap.get(key);
            if (!entry)
                continue;
            if (!entry.is_pl)
                continue;
            key = entry.subtotal_line;
        }
        if (groupBy === "account") {
            const title = acctNameMap.get(key);
            if (title)
                key = `${key} ${title}`;
        }
        const existing = agg.get(key) ?? { group_key: key, net_amount: 0, debit_total: 0, credit_total: 0, line_count: 0 };
        existing.net_amount += Number(row.net_amount) || 0;
        existing.debit_total += Number(row.debit_total) || 0;
        existing.credit_total += Number(row.credit_total) || 0;
        existing.line_count += Number(row.line_count) || 0;
        agg.set(key, existing);
    }
    const sorted = Array.from(agg.values())
        .sort((a, b) => Math.abs(b.net_amount) - Math.abs(a.net_amount))
        .slice(0, limit);
    return textResult({
        source: "intacct_monthly_dept_balances",
        filters_applied: { business_unit: businessUnit ?? "ALL", department, department_id: departmentId, sage_dept_ids_resolved: effectiveDeptFilter, entity_id: entityId, account_no: accountNo, date_from: dateFrom, date_to: dateTo, group_by: groupBy },
        row_count: sorted.length,
        rows: sorted.map((r) => ({ ...r, net_amount: Math.round(r.net_amount * 100) / 100 })),
    });
}
//# sourceMappingURL=query-sage-gl.js.map