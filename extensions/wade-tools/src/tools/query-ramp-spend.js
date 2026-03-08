import { getSupabase } from "../db.js";
import { resolveBudgetDeptToSageDepts } from "../bu-mapping.js";
import { textResult } from "../types.js";
export const definition = {
    name: "query_ramp_spend",
    description: "Query Ramp spend data (card transactions + bills) directly from structured tables. ALWAYS use this for any question about Ramp spend, vendor totals, BU spend breakdowns, or top vendors. Returns precise, filtered, aggregated results. This is the primary tool for Ramp financial data — it queries the actual source tables with exact filters, not a knowledge base.",
    parameters: {
        type: "object",
        properties: {
            business_unit: {
                type: "string",
                description: 'Filter to a specific BU. Must be exact: "Executive", "Tech", "Growth & Revenue", "F&B", "Hotel", "Property Mgmt", "Real Estate & Dev", "Shared Services", "MENA". Case-sensitive.',
            },
            department: {
                type: "string",
                description: 'Filter by budget department name (e.g. "Finance", "People", "Legal", "Engineering", "Marketing"). This resolves via dim_bu_mapping to the correct set of Sage departments.',
            },
            date_from: {
                type: "string",
                description: "Start date (YYYY-MM-DD). Filters transaction_date/issued_at >= this value.",
            },
            date_to: {
                type: "string",
                description: "End date (YYYY-MM-DD). Filters transaction_date/issued_at <= this value.",
            },
            vendor_search: {
                type: "string",
                description: "Case-insensitive substring filter on vendor/merchant name.",
            },
            group_by: {
                type: "string",
                enum: ["vendor", "business_unit", "month", "department", "entity"],
                description: "How to group/aggregate results. Default: vendor.",
            },
            limit: {
                type: "number",
                description: "Max rows to return (default 50). Use for top-N queries.",
            },
            include_detail: {
                type: "boolean",
                description: "If true, return individual transactions/bills instead of aggregates. Default false.",
            },
        },
        required: [],
    },
};
async function queryRampDetail(businessUnit, dateFrom, dateTo, vendorSearch, limit = 50, sageDeptFilter) {
    const supabase = getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let txnQuery = supabase.from("ramp_transactions")
        .select("merchant_name, amount, business_unit, sage_dept_name, sage_entity_name, transaction_date, card_holder_name")
        .not("amount", "is", null)
        .eq("is_bill_payment", false)
        .order("amount", { ascending: false })
        .limit(limit);
    if (businessUnit)
        txnQuery = txnQuery.eq("business_unit", businessUnit);
    if (sageDeptFilter)
        txnQuery = txnQuery.in("sage_dept_name", sageDeptFilter);
    if (dateFrom)
        txnQuery = txnQuery.gte("transaction_date", dateFrom);
    if (dateTo)
        txnQuery = txnQuery.lte("transaction_date", dateTo);
    if (vendorSearch)
        txnQuery = txnQuery.ilike("merchant_name", `%${vendorSearch}%`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let billQuery = supabase.from("ramp_bills")
        .select("vendor_name, amount, business_unit, sage_dept_name, sage_entity_name, issued_at, status")
        .not("amount", "is", null)
        .order("amount", { ascending: false })
        .limit(limit);
    if (businessUnit)
        billQuery = billQuery.eq("business_unit", businessUnit);
    if (sageDeptFilter)
        billQuery = billQuery.in("sage_dept_name", sageDeptFilter);
    if (dateFrom)
        billQuery = billQuery.gte("issued_at", dateFrom);
    if (dateTo)
        billQuery = billQuery.lte("issued_at", dateTo);
    if (vendorSearch)
        billQuery = billQuery.ilike("vendor_name", `%${vendorSearch}%`);
    const [{ data: txns, error: txnErr }, { data: bills, error: billErr }] = await Promise.all([txnQuery, billQuery]);
    if (txnErr)
        return JSON.stringify({ error: txnErr.message });
    if (billErr)
        return JSON.stringify({ error: billErr.message });
    return JSON.stringify({
        card_transactions: txns ?? [],
        bills: bills ?? [],
        note: `Showing up to ${limit} per type, sorted by amount desc.`,
    });
}
export async function execute(_id, params) {
    const supabase = getSupabase();
    const businessUnit = params.business_unit;
    const department = params.department;
    const dateFrom = params.date_from;
    const dateTo = params.date_to;
    const vendorSearch = params.vendor_search;
    const groupBy = params.group_by ?? "vendor";
    const limit = params.limit ?? 50;
    const includeDetail = params.include_detail ?? false;
    let sageDeptFilter;
    if (department) {
        sageDeptFilter = await resolveBudgetDeptToSageDepts(department);
        if (sageDeptFilter.length === 0) {
            return textResult({
                error: `No Sage departments found for budget department "${department}". Check the department name — valid examples: Finance, People, Legal, Engineering, Marketing, etc.`,
            });
        }
    }
    const groupColumn = {
        vendor: { txn: "merchant_name", bill: "vendor_name" },
        business_unit: { txn: "business_unit", bill: "business_unit" },
        month: { txn: "transaction_date", bill: "issued_at" },
        department: { txn: "sage_dept_name", bill: "sage_dept_name" },
        entity: { txn: "sage_entity_name", bill: "sage_entity_name" },
    };
    const cols = groupColumn[groupBy] ?? groupColumn.vendor;
    if (includeDetail) {
        const result = await queryRampDetail(businessUnit, dateFrom, dateTo, vendorSearch, limit, sageDeptFilter);
        return textResult(JSON.parse(result));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let txnQuery = supabase.from("ramp_transactions")
        .select("*")
        .not("amount", "is", null)
        .eq("is_bill_payment", false);
    if (businessUnit)
        txnQuery = txnQuery.eq("business_unit", businessUnit);
    if (sageDeptFilter)
        txnQuery = txnQuery.in("sage_dept_name", sageDeptFilter);
    if (dateFrom)
        txnQuery = txnQuery.gte("transaction_date", dateFrom);
    if (dateTo)
        txnQuery = txnQuery.lte("transaction_date", dateTo);
    if (vendorSearch)
        txnQuery = txnQuery.ilike("merchant_name", `%${vendorSearch}%`);
    const { data: txns, error: txnErr } = await txnQuery.limit(10000);
    if (txnErr)
        return textResult({ error: `Transaction query failed: ${txnErr.message}` });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let billQuery = supabase.from("ramp_bills")
        .select("*")
        .not("amount", "is", null);
    if (businessUnit)
        billQuery = billQuery.eq("business_unit", businessUnit);
    if (sageDeptFilter)
        billQuery = billQuery.in("sage_dept_name", sageDeptFilter);
    if (dateFrom)
        billQuery = billQuery.gte("issued_at", dateFrom);
    if (dateTo)
        billQuery = billQuery.lte("issued_at", dateTo);
    if (vendorSearch)
        billQuery = billQuery.ilike("vendor_name", `%${vendorSearch}%`);
    const { data: bills, error: billErr } = await billQuery.limit(10000);
    if (billErr)
        return textResult({ error: `Bill query failed: ${billErr.message}` });
    const agg = new Map();
    for (const row of (txns ?? [])) {
        let key = row[cols.txn];
        if (groupBy === "month" && key)
            key = key.slice(0, 7);
        key = key ?? "(uncategorized)";
        const existing = agg.get(key) ?? { group_key: key, total_amount: 0, transaction_count: 0, card_amount: 0, card_count: 0, bill_amount: 0, bill_count: 0 };
        const amt = Math.abs(Number(row.amount) || 0);
        existing.card_amount += amt;
        existing.card_count += 1;
        existing.total_amount += amt;
        existing.transaction_count += 1;
        agg.set(key, existing);
    }
    for (const row of (bills ?? [])) {
        let key = row[cols.bill];
        if (groupBy === "month" && key)
            key = key.slice(0, 7);
        key = key ?? "(uncategorized)";
        const existing = agg.get(key) ?? { group_key: key, total_amount: 0, transaction_count: 0, card_amount: 0, card_count: 0, bill_amount: 0, bill_count: 0 };
        const amt = Math.abs(Number(row.amount) || 0);
        existing.bill_amount += amt;
        existing.bill_count += 1;
        existing.total_amount += amt;
        existing.transaction_count += 1;
        agg.set(key, existing);
    }
    const sorted = Array.from(agg.values())
        .sort((a, b) => b.total_amount - a.total_amount)
        .slice(0, limit);
    const grandTotal = sorted.reduce((s, r) => s + r.total_amount, 0);
    const totalTxns = sorted.reduce((s, r) => s + r.transaction_count, 0);
    return textResult({
        filters_applied: {
            business_unit: businessUnit ?? "ALL",
            department: department ?? "ALL",
            sage_departments_resolved: sageDeptFilter ?? "N/A",
            date_from: dateFrom ?? "all time",
            date_to: dateTo ?? "all time",
            vendor_search: vendorSearch ?? "none",
            group_by: groupBy,
        },
        grand_total: Math.round(grandTotal * 100) / 100,
        total_transactions: totalTxns,
        rows: sorted.map((r) => ({
            ...r,
            total_amount: Math.round(r.total_amount * 100) / 100,
            card_amount: Math.round(r.card_amount * 100) / 100,
            bill_amount: Math.round(r.bill_amount * 100) / 100,
        })),
        row_count: sorted.length,
        note: sorted.length === limit ? `Showing top ${limit} only. Increase limit for more.` : undefined,
    });
}
//# sourceMappingURL=query-ramp-spend.js.map