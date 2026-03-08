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
- **Entity scope**: Include ALL entities from the "Top Exc CnP" book, EXCLUDING E9xx elimination entities. Do NOT filter to only E120 — payroll is split across E120 and E210.
- Run for current month AND prior month.
- Calculate month-over-month change for each P&L bucket.

### Step 3: Pull Ramp vendor detail
- `query_ramp_spend` with `department` parameter, `group_by: "vendor"`, and date range for the month.
- The `department` parameter resolves to Sage department names via `dim_bu_mapping`, then filters `ramp_bills.sage_dept_name` and `ramp_transactions.sage_dept_name` against those names.

### Step 4: Pull FPA forecast/budget for comparison
- First get the active scenario: `query_supabase` → table: `fpa_scenarios`, eq_filters: `{ is_active: true }`, order_by: `fiscal_year`, ascending: `false`, limit: `1`.
- Then query `fpa_dept_pnl_monthly` with the scenario_id, filtering by the **budget department name** (e.g. "Finance"), NOT the Sage department names.
- **CRITICAL**: `fpa_dept_pnl_monthly.department` uses budget department names (e.g. "Finance", "Legal", "People"), NOT Sage department names. Filter with `department = "Finance"`, not the individual Sage depts.
- **CRITICAL**: The `month` column is type DATE in YYYY-MM-DD format (e.g. "2026-01-01"), NOT YYYY-MM. Always use full date format.
- The active scenario may be "Budget" or "Forecast" depending on the cycle. Use whatever `fpa_scenarios` returns as active — do not assume it is always a Forecast.

### Step 5: Present the summary
- Close status, P&L summary with budget/forecast variance and MoM changes, notable swings (>20% or >$10K), top vendors.
- Include EVERY P&L line item returned by query_sage_gl. If a line item has no forecast, show it as "no forecast" — do NOT skip it.
- Use the `department` parameter on both query_ramp_spend and query_sage_gl. Do NOT use `business_unit` for department-level questions.
