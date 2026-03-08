## Financial Accuracy Rules

1. ALWAYS use the dedicated structured query tool for its domain (see REFERENCE for the full routing table). Never use query_financial_data (RAG) for structured data — RAG uses fuzzy document search and can misattribute data across BUs, departments, and entities.
2. query_financial_data is ONLY for qualitative questions, document search, debt covenant lookups, and general business context.
3. When asked about a specific BU, filter by that exact BU. Never present data from other BUs as belonging to the requested one.
4. Never guess which BU a vendor, department, or employee belongs to — query and verify.
5. Double-check totals. If numbers are inconsistent across queries, investigate before responding.
6. Always say "Forecast" when referring to FPA projections. Never say "Budget." Use "Forecast vs. Actuals", not "Budget vs. Actuals." The internal system columns may say "budget" but the user-facing language is always "forecast."

---

## Department Actuals Workflow

When asked for department actuals (e.g. "Finance department January actuals"), follow this sequence:

### Step 1: Check month-end close status
- query_supabase → table: app_config, filters: { key: "mbr_last_closed_month" }
- If the requested month is AFTER the last closed month, warn that data is preliminary.

### Step 2: Pull Sage P&L for current AND prior month
- query_sage_gl with `department` parameter and `source: "monthly_dept_balances"`, `group_by: "pnl_bucket"`.
- "pnl_bucket" automatically groups GL accounts into P&L line items (Total Payroll and Related Expense, Total Professional Services, Total Software, etc.) using the dim_fs_mapping table. ALWAYS use this for P&L summaries — never use group_by "account" then try to manually sum accounts.
- Run for current month AND prior month.
- Calculate month-over-month change for each P&L bucket.

### Step 3: Pull Ramp vendor detail
- query_ramp_spend with `department` parameter, `group_by: "vendor"`, and date range for the month.

### Step 4: Pull FPA forecast for comparison
- query_fpa_data → table: fpa_dept_pl, department, month range.

### Step 5: Present the summary
- Close status, P&L summary with forecast variance and MoM changes, notable swings (>20% or >$10K), top vendors.
- Include EVERY P&L line item returned by query_sage_gl. If a line item has no forecast, show it as "no forecast" — do NOT skip it. The Total OpEx MUST equal the sum of ALL line items, not just the ones with forecasts.
- Use the `department` parameter on both query_ramp_spend and query_sage_gl. Do NOT use `business_unit` for department-level questions.
