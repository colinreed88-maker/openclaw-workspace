import { getSupabase } from "../db.js";
import { textResult, type ToolResult } from "../types.js";

export const definition = {
  name: "query_supabase",
  description: `Read-only query tool for any Supabase table or RPC. Primary data tool — use for direct table lookups, filtered queries, and RPC calls.

KEY TABLES:
- ramp_transactions: amount, merchant_name, business_unit, sage_dept_name, transaction_date, state, card_holder_name, is_bill_payment
- ramp_bills: amount, vendor_name, business_unit, sage_dept_name, posting_date, issued_at, status, bill_owner_name
- fpa_scenarios: id, name, type, fiscal_year, is_active — filter by is_active=true
- fpa_dept_pnl_monthly: scenario_id, business_unit, department, line_item, month, amount, sort_order
- fpa_pnl_monthly: scenario_id, section (opco/mena/re_ops/consolidated), line_item, month, amount, sort_order
- fpa_headcount_monthly: scenario_id, business_unit, department, month, fte
- fpa_employees: scenario_id, business_unit, department, employee_name, status (AVOID comp columns)
- fpa_vendors: scenario_id, department, vendor, category, amount
- fpa_kpis: scenario_id, metric, value, sort_order
- intacct_monthly_dept_balances: year_month, department_id, entity_id, account_no, net_amount
- intacct_gl_detail: entry_date, account_no, department_id, location_id, amount, description
- intacct_accounts: account_no, title, status (518 rows)
- intacct_departments: department_id, title
- intacct_entities: entity_id, name
- mbr_current_roster: Employee, "Organization/BU", Reporting_Dept, "Employment status" (AVOID comp columns)
- app_config: key, value — key='mbr_last_closed_month' for close status
- dim_bu_mapping: source_system, source_identifier, budget_bu, budget_department, forecast_department, is_active

COMP COLUMNS TO NEVER SELECT: compensation, salary, hourly, wage, pay_rate, base_pay, total_pay, annual_comp

For combined card + bill Ramp queries, use query_ramp_spend.
For Sage GL with pnl_bucket grouping, use query_sage_gl.
For aggregated Toast/F&B metrics, use query_toast_data.`,
  parameters: {
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name. Ignored if rpc_name is set.",
      },
      select: {
        type: "string",
        description: "Column selection (Supabase syntax). Default '*'. Prefer specific columns.",
      },
      eq_filters: {
        type: "object",
        description: "Exact match filters. E.g. { is_active: true, source_system: 'sage' }",
        additionalProperties: true,
      },
      gte_filters: {
        type: "object",
        description: ">= filters. E.g. { transaction_date: '2026-01-01' }",
        additionalProperties: { type: "string" },
      },
      lte_filters: {
        type: "object",
        description: "<= filters. E.g. { transaction_date: '2026-01-31' }",
        additionalProperties: { type: "string" },
      },
      in_filters: {
        type: "object",
        description: "IN filters (key → array). E.g. { state: ['CLEARED', 'PENDING'] }",
        additionalProperties: { type: "array", items: { type: "string" } },
      },
      ilike_filters: {
        type: "object",
        description: "Case-insensitive substring. E.g. { vendor_name: 'google' } → ilike '%google%'",
        additionalProperties: { type: "string" },
      },
      or_filter: {
        type: "string",
        description: "Raw PostgREST .or() string. E.g. 'posting_date.gte.2026-01-01,issued_at.gte.2026-01-01'",
      },
      not_null: {
        type: "array",
        items: { type: "string" },
        description: "Columns that must not be null. E.g. ['amount']",
      },
      order_by: { type: "string", description: "Column to order by" },
      ascending: { type: "boolean", description: "Sort ascending (default false)" },
      limit: { type: "number", description: "Max rows (default 50, max 10000)" },
      rpc_name: {
        type: "string",
        description: "Call supabase.rpc() instead of table query. E.g. 'fb_daily_sales'",
      },
      rpc_params: {
        type: "object",
        description: "RPC parameters. E.g. { since_date: '2026-02-01' }",
        additionalProperties: true,
      },
    },
    required: [],
  },
};

export async function execute(_id: string, params: Record<string, unknown>): Promise<ToolResult> {
  const supabase = getSupabase();

  // RPC mode
  const rpcName = params.rpc_name as string | undefined;
  if (rpcName) {
    const rpcParams = (params.rpc_params as Record<string, unknown>) ?? {};
    const { data, error } = await supabase.rpc(rpcName, rpcParams);
    if (error) return textResult({ error: `RPC ${rpcName} failed: ${error.message}` });
    const rows = (data ?? []) as unknown[];
    const limit = Math.min((params.limit as number) ?? 50, 10000);
    return textResult({
      source: `rpc:${rpcName}`,
      row_count: rows.length,
      rows: rows.slice(0, limit),
    });
  }

  // Table query mode
  const table = params.table as string;
  if (!table) return textResult({ error: "Either 'table' or 'rpc_name' is required." });

  const select = (params.select as string) ?? "*";
  const eqFilters = (params.eq_filters as Record<string, unknown>) ?? (params.filters as Record<string, unknown>) ?? {};
  const gteFilters = (params.gte_filters as Record<string, string>) ?? {};
  const lteFilters = (params.lte_filters as Record<string, string>) ?? {};
  const inFilters = (params.in_filters as Record<string, string[]>) ?? {};
  const ilikeFilters = (params.ilike_filters as Record<string, string>) ?? {};
  const orFilter = params.or_filter as string | undefined;
  const notNull = (params.not_null as string[]) ?? [];
  const orderBy = params.order_by as string | undefined;
  const ascending = (params.ascending as boolean) ?? false;
  const limit = Math.min((params.limit as number) ?? 50, 10000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from(table) as any).select(select);

  for (const [key, value] of Object.entries(eqFilters)) {
    query = query.eq(key, value);
  }
  for (const [key, value] of Object.entries(gteFilters)) {
    query = query.gte(key, value);
  }
  for (const [key, value] of Object.entries(lteFilters)) {
    query = query.lte(key, value);
  }
  for (const [key, values] of Object.entries(inFilters)) {
    query = query.in(key, values);
  }
  for (const [key, value] of Object.entries(ilikeFilters)) {
    query = query.ilike(key, `%${value}%`);
  }
  if (orFilter) {
    query = query.or(orFilter);
  }
  for (const col of notNull) {
    query = query.not(col, "is", null);
  }
  if (orderBy) {
    query = query.order(orderBy, { ascending });
  }

  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return textResult({ error: error.message });
  return textResult({
    source: table,
    row_count: (data ?? []).length,
    rows: data ?? [],
    note: (data ?? []).length === limit ? `Limit reached (${limit}). Increase for more.` : undefined,
  });
}
