import { getSupabase } from "../db.js";
import { resolveBudgetDeptToSageDepts, resolveDeptNamesToIds, loadDeptIdToName, loadAccountNoToTitle, loadFsMapping, loadBuMapping, loadBuMappingByDeptId, } from "../bu-mapping.js";
import { textResult } from "../types.js";
const GL_DETAIL_COLUMNS = "entry_date, account_no, account_title, department_id, location_id, amount, description, document_no, batch_title";
const MONTHLY_BALANCE_COLUMNS = "year_month, department_id, entity_id, account_no, net_amount, debit_total, credit_total, line_count";
export const definition = {
    name: "query_sage_gl",
    description: "Query Sage Intacct GL data — journal entries or monthly department balances. Supports pnl_bucket grouping which maps GL accounts to P&L line items via dim_fs_mapping. Use this for department P&L summaries, GL detail, or account balance analysis.",
    parameters: {
        type: "object",
        properties: {
            business_unit: {
                type: "string",
                description: 'Exact BU. Resolves to Sage department IDs via dim_bu_mapping.',
            },
            department: {
                type: "string",
                description: 'Budget department name (e.g. "Finance"). Resolves via dim_bu_mapping. Preferred over department_id.',
            },
            department_id: {
                type: "string",
                description: "Sage department ID. Use 'department' instead when filtering by budget department.",
            },
            entity_id: { type: "string", description: "Sage entity/location ID." },
            account_no: { type: "string", description: "GL account number (e.g. 63570)." },
            date_from: { type: "string", description: "YYYY-MM-DD for gl_detail, YYYY-MM for monthly balances." },
            date_to: { type: "string", description: "YYYY-MM-DD for gl_detail, YYYY-MM for monthly balances." },
            source: {
                type: "string",
                enum: ["gl_detail", "monthly_dept_balances"],
                description: "gl_detail = journal entries, monthly_dept_balances = pre-aggregated. Default: monthly_dept_balances.",
            },
            group_by: {
                type: "string",
                enum: ["department", "account", "entity", "month", "business_unit", "pnl_bucket"],
                description: "pnl_bucket groups GL accounts into P&L line items — use for department P&L summaries. Default: department.",
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
    // Resolve department name to Sage department IDs
    let budgetDeptFilter = null;
    if (department) {
        const deptNames = await resolveBudgetDeptToSageDepts(department);
        if (deptNames.length === 0) {
            return textResult({ error: `No Sage departments mapped to "${department}".` });
        }
        budgetDeptFilter = await resolveDeptNamesToIds(deptNames);
        if (budgetDeptFilter.length === 0) {
            return textResult({ error: `No department_id codes found for "${department}".` });
        }
    }
    // Resolve BU to department IDs
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
            .select(GL_DETAIL_COLUMNS)
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
            row_count: enriched.length,
            rows: enriched,
        });
    }
    // monthly_dept_balances (default)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = supabase.from("intacct_monthly_dept_balances")
        .select(MONTHLY_BALANCE_COLUMNS)
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
            if (!entry || !entry.is_pl)
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
        group_by: groupBy,
        row_count: sorted.length,
        rows: sorted.map((r) => ({ ...r, net_amount: Math.round(r.net_amount * 100) / 100 })),
    });
}
//# sourceMappingURL=query-sage-gl.js.map