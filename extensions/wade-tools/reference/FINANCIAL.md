## Financial Accuracy Rules

1. Use the right tool for the data. `query_supabase` is the primary tool — it can query any table or call any RPC. Use specialized tools (`query_ramp_spend`, `query_sage_gl`, `query_toast_data`) when their multi-step logic adds value.
2. `query_financial_data` is ONLY for qualitative questions, document search, debt covenant lookups, and general business context. Never use it for structured data.
3. When asked about a specific BU, filter by that exact BU. Never present data from other BUs as belonging to the requested one.
4. Never guess which BU a vendor, department, or employee belongs to — query and verify.
5. Double-check totals. If numbers are inconsistent across queries, investigate before responding.
6. Always say "Forecast" when referring to FPA projections. Never say "Budget." Use "Forecast vs. Actuals", not "Budget vs. Actuals."

---

## Department Actuals Workflow

When asked for department actuals (e.g. "Finance department January actuals"), follow this sequence:

### Step 1: Check month-end close status
- `query_supabase` → table: `app_config`, eq_filters: `{ key: "mbr_last_closed_month" }`
- If the requested month is AFTER the last closed month, warn that data is preliminary.

### Step 2: Pull Sage P&L for current AND prior month
- `query_sage_gl` with `department` parameter and `source: "monthly_dept_balances"`, `group_by: "pnl_bucket"`.
- "pnl_bucket" automatically groups GL accounts into P&L line items using the dim_fs_mapping table. ALWAYS use this for P&L summaries.
- Run for current month AND prior month.
- Calculate month-over-month change for each P&L bucket.

### Step 3: Pull Ramp vendor detail
- `query_ramp_spend` with `department` parameter, `group_by: "vendor"`, and date range for the month.

### Step 4: Pull FPA forecast for comparison
- `query_supabase` → table: `fpa_dept_pnl_monthly`, filter by department and month range. Get active scenario first from `fpa_scenarios` where `is_active = true`.

### Step 5: Present the summary
- Close status, P&L summary with forecast variance and MoM changes, notable swings (>20% or >$10K), top vendors.
- Include EVERY P&L line item returned by query_sage_gl. If a line item has no forecast, show it as "no forecast" — do NOT skip it.
- Use the `department` parameter on both query_ramp_spend and query_sage_gl. Do NOT use `business_unit` for department-level questions.
