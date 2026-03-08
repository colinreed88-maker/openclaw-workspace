import { getSupabase } from "../db.js";
import { resolveBudgetDeptToSageDepts } from "../bu-mapping.js";
import { textResult } from "../types.js";
const TXN_COLUMNS = "merchant_name, amount, business_unit, sage_dept_name, sage_entity_name, transaction_date, card_holder_name";
const BILL_COLUMNS = "vendor_name, amount, business_unit, sage_dept_name, sage_entity_name, posting_date, issued_at, status, bill_owner_name";
export const definition = {
    name: "query_ramp_spend",
    description: "Queries both ramp_transactions (card spend) and ramp_bills (vendor invoices), merges results, and aggregates by your chosen dimension. Use when you need combined card + bill spend totals, top vendors, or BU/department breakdowns.",
    parameters: {
        type: "object",
        properties: {
            business_unit: {
                type: "string",
                description: 'Exact BU: "Executive", "Tech", "Growth & Revenue", "F&B", "Hotel", "Property Mgmt", "Real Estate & Dev", "Shared Services", "MENA".',
            },
            department: {
                type: "string",
                description: 'Budget department (e.g. "Finance", "People", "Engineering"). Resolves via dim_bu_mapping.',
            },
            date_from: { type: "string", description: "Start date (YYYY-MM-DD)." },
            date_to: { type: "string", description: "End date (YYYY-MM-DD)." },
            vendor_search: { type: "string", description: "Case-insensitive substring on vendor/merchant name." },
            group_by: {
                type: "string",
                enum: ["vendor", "business_unit", "month", "department", "entity"],
                description: "Aggregation dimension. Default: vendor.",
            },
            limit: { type: "number", description: "Max rows (default 50)." },
            include_detail: { type: "boolean", description: "Return individual rows instead of aggregates. Default false." },
        },
        required: [],
    },
};
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
            return textResult({ error: `No Sage departments found for "${department}".` });
        }
    }
    // Build transaction query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function buildTxnQuery(cols, rowLimit) {
        let q = supabase.from("ramp_transactions")
            .select(cols)
            .not("amount", "is", null)
            .eq("is_bill_payment", false)
            .in("state", ["CLEARED", "PENDING"]);
        if (businessUnit)
            q = q.eq("business_unit", businessUnit);
        if (sageDeptFilter)
            q = q.in("sage_dept_name", sageDeptFilter);
        if (dateFrom)
            q = q.gte("transaction_date", dateFrom);
        if (dateTo)
            q = q.lte("transaction_date", dateTo);
        if (vendorSearch)
            q = q.ilike("merchant_name", `%${vendorSearch}%`);
        return q.order("amount", { ascending: false }).limit(rowLimit);
    }
    // Build bill query — uses posting_date as primary date, falls back to issued_at
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function buildBillQuery(cols, rowLimit) {
        let q = supabase.from("ramp_bills")
            .select(cols)
            .not("amount", "is", null);
        if (businessUnit)
            q = q.eq("business_unit", businessUnit);
        if (sageDeptFilter)
            q = q.in("sage_dept_name", sageDeptFilter);
        if (dateFrom)
            q = q.or(`posting_date.gte.${dateFrom},and(posting_date.is.null,issued_at.gte.${dateFrom})`);
        if (dateTo)
            q = q.or(`posting_date.lte.${dateTo},and(posting_date.is.null,issued_at.lte.${dateTo})`);
        if (vendorSearch)
            q = q.ilike("vendor_name", `%${vendorSearch}%`);
        return q.order("amount", { ascending: false }).limit(rowLimit);
    }
    // Detail mode
    if (includeDetail) {
        const [{ data: txns, error: txnErr }, { data: bills, error: billErr }] = await Promise.all([
            buildTxnQuery(TXN_COLUMNS, limit),
            buildBillQuery(BILL_COLUMNS, limit),
        ]);
        if (txnErr)
            return textResult({ error: txnErr.message });
        if (billErr)
            return textResult({ error: billErr.message });
        return textResult({ card_transactions: txns ?? [], bills: bills ?? [] });
    }
    // Aggregation mode
    const [{ data: txns, error: txnErr }, { data: bills, error: billErr }] = await Promise.all([
        buildTxnQuery(TXN_COLUMNS, 10000),
        buildBillQuery(BILL_COLUMNS, 10000),
    ]);
    if (txnErr)
        return textResult({ error: `Transaction query failed: ${txnErr.message}` });
    if (billErr)
        return textResult({ error: `Bill query failed: ${billErr.message}` });
    const groupColumn = {
        vendor: { txn: "merchant_name", bill: "vendor_name" },
        business_unit: { txn: "business_unit", bill: "business_unit" },
        month: { txn: "transaction_date", bill: "_posting_date" },
        department: { txn: "sage_dept_name", bill: "sage_dept_name" },
        entity: { txn: "sage_entity_name", bill: "sage_entity_name" },
    };
    const cols = groupColumn[groupBy] ?? groupColumn.vendor;
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
        let key;
        if (groupBy === "month") {
            // Use posting_date as primary, fall back to issued_at (matches intranet)
            key = (row.posting_date ?? row.issued_at)?.slice(0, 7) ?? null;
        }
        else {
            key = row[cols.bill];
        }
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
    return textResult({
        filters_applied: {
            business_unit: businessUnit ?? "ALL",
            department: department ?? "ALL",
            date_from: dateFrom ?? "all time",
            date_to: dateTo ?? "all time",
            vendor_search: vendorSearch ?? "none",
            group_by: groupBy,
        },
        grand_total: Math.round(grandTotal * 100) / 100,
        rows: sorted.map((r) => ({
            ...r,
            total_amount: Math.round(r.total_amount * 100) / 100,
            card_amount: Math.round(r.card_amount * 100) / 100,
            bill_amount: Math.round(r.bill_amount * 100) / 100,
        })),
        row_count: sorted.length,
    });
}
//# sourceMappingURL=query-ramp-spend.js.map