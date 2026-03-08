## Data Dictionary

### Supabase Tables by Domain

**FP&A (Budget & Forecast)**
- `fpa_scenarios` — scenario registry (F1 Forecast, F2, Budget, Prior Year). Filter by `is_active`.
- `fpa_pnl_monthly` — consolidated monthly P&L by scenario (section, category, line_item, month, amount).
- `fpa_dept_pnl_monthly` — department-level monthly P&L. Keyed by scenario_id, business_unit, department, line_item.
- `fpa_headcount_monthly` — FTE counts by department and month.
- `fpa_employees` — employee/contractor roster from the forecast model.
- `fpa_vendors` — vendor spend by department/category (software, contractors, prof_services, travel, other).
- `fpa_kpis` — pre-computed KPI metrics per scenario.
- `fpa_dept_gl_detail` — GL-level detail by department, parent_category, gl_code.

**Sage Intacct (Actuals / GL)**
- `intacct_gl_detail` — ~1M journal entry lines (Dec 2020–present). Key columns: entry_date, account_no, account_title, department_id, location_id, amount, description, document_no.
- `intacct_monthly_dept_balances` — pre-aggregated GL by entity, department, account, year_month. Key columns: year_month, department_id, entity_id, account_no, net_amount, debit_total, credit_total, line_count.
- `intacct_accounts` — chart of accounts (518 accounts). account_no, title.
- `intacct_entities` — 43 legal entities (E100–E920).
- `intacct_departments` — ~128 ERP departments. department_id, title.

**Ramp (Expense Management)**
- `ramp_transactions` — card transactions. Key columns: amount, merchant_name, business_unit, sage_dept_name, sage_entity_name, transaction_date, card_holder_name, state. Filter: `state IN ['CLEARED', 'PENDING']`.
- `ramp_bills` — vendor bills/invoices. Key columns: amount, vendor_name, business_unit, sage_dept_name, sage_entity_name, posting_date, issued_at, status. Date filter: use `posting_date` (primary), fall back to `issued_at` when null.
- `ramp_trips` — T&E trips with route and spend.

**Toast (F&B / POS)** — Use `query_toast_data` with RPC metrics (daily_sales, labor, top_items, category_sales, payment_mix, hourly_sales, server_performance, employee_performance, ticket_time, discount_void, dining_options). Use metric "orders" for raw order data.
- Locations: Grocer, Station, Food Truck, Pool.

**Property P&L**
- `prop_pnl_actuals` / `prop_pnl_budget` / `prop_pnl_gl` / `prop_pnl_pricing` / `prop_pnl_marketing` / `prop_pnl_rented_units`.
- Properties: Society (FFL/E501), Caoba (FM/E506), G-West (E507), Block E (E508), Aventura, Biscayne, Brickell.

**Debt**
- `debt_loans` — loan instruments with lender, balance, rate, maturity.
- `debt_guarantees` — guarantee terms and triggers.
- `debt_covenants` — financial covenant details (min net worth, DSCR, etc.).

**HR / Headcount**
- `mbr_current_roster` — current Rippling roster (employee, title, dept, org, location, manager).
- `mbr_rippling_headcount_weekly` — weekly headcount snapshots.

**System Config**
- `app_config` — key-value config table. Key `mbr_last_closed_month` = latest month Sage data is closed through.

**BU Mapping**
- `dim_bu_mapping` — source key to budget_bu (source_system: sage, budget, rippling, roster).
- `dim_bu_scopes` — BU scope classification (opco, mena, consolidated_re).

---

### Available Tools

| Tool | Purpose |
|------|---------|
| `query_supabase` | Primary data tool. Query any table with full filter support (eq, gte, lte, in, ilike, or, not_null) or call Supabase RPCs. |
| `query_ramp_spend` | Merges ramp_transactions + ramp_bills, aggregates by dimension (vendor, department, business_unit, month, entity). Use when you need combined card + bill spend. |
| `query_sage_gl` | GL detail or monthly department balances with pnl_bucket grouping. Use for P&L summaries and actuals. |
| `query_toast_data` | F&B metrics via Postgres RPCs (daily_sales, labor, top_items, etc.). Matches intranet FB Dashboard exactly. |
| `query_financial_data` | RAG proxy for qualitative questions, SOPs, debt docs. NOT for structured data. |
| `retrieve_knowledge_doc` | Document search and download. |
| `retrieve_ramp_invoice` | Ramp invoice PDF retrieval. |
| `read_github_file` | Read files from Flow GitHub repos (flow-intranet, flow-ai-worker, openclaw-workspace). Use to understand how pages query data, how tools work, or to diagnose data discrepancies. |
| `search_web` | Current web info, news, rates. |
| `send_email` | Send email via Resend. Show draft first, call after approval. |
| `create_calendar_event` | Create Google Calendar event. Show details first, call after approval. |
| `get_calendar_availability` | Check free/busy for attendees. |
| `list_upcoming_events` | List upcoming calendar events. |
| `manage_scheduled_tasks` | CRUD for scheduled cron tasks. Show details first, call after approval for create/update/delete. |

---

### Business Unit Reference

Canonical BUs (display order): Executive, Tech, Growth & Revenue, F&B, Hotel, Property Mgmt, Real Estate & Dev, Shared Services, MENA, Flow Practice.
Budget-only BUs: 3rd Party Revenue, Building Elimination, FM, FFL, Condos, Unallocated Comp.

### Budget Department → Sage Departments

Each BU contains budget departments that span multiple Sage ERP departments. Use the `department` parameter on `query_ramp_spend` and `query_sage_gl` — it resolves via `dim_bu_mapping` to the correct set of Sage departments.

Key mappings:
- **Finance** → Finance, Corporate Accounting, Accounts Payable, Strategic Finance, Property Accounting
- **People** → People Operations, Talent Acquisition, People
- **Legal** → Legal
- **Engineering** → Engineering, Product Management - Engineering, Product Design, IT, Program Office
- **Marketing** → Marketing, Leasing, Pricing, Data Analytics, Brokerage
- **Food and Beverage** → Food and Beverage, Food and Beverage - Miami, Food and Beverage - FTL

Always use the `department` parameter (not `business_unit`) when the user asks about a specific department.

### Entity Quick Reference

- E100: Flow Global Holdings (TopCo)
- E120: Flow Operating Company (OpCo — the main P&L)
- E200: FLOW Living
- E210: FOL Management (employment entity)
- E215: Flow FS (hotel master-lease entity)
- E501: Society (Flow Fort Lauderdale / FFL)
- E506: Caoba (Flow Miami / FM)
- E507: G-West (Flow House condos)
- E508: Block E
- E515: Biscayne JV
- E900/E910/E920: Elimination entities

### Key Gotchas

- **Multi-entity payroll**: Payroll/compensation expenses are booked across multiple entities. E120 (OpCo) AND E210 (FOL Management, the employment entity) both carry payroll for the same departments. When querying department P&L actuals, use `intacct_monthly_dept_balances` and include ALL OpCo-scope entities (from `intacct_book_entities` where `book_id = 'Top Exc CnP'`), excluding E9xx elimination entities. Do NOT filter to just E120 — you will undercount payroll by ~50%.
- OpCo elimination removes intercompany management fees between OpCo and owned buildings (Society, Caoba) and F&B commissary revenue.
- Flow FS master-leases hotel space — rent expense at FS = rental income at building level.
- **FPA date format**: `fpa_dept_pnl_monthly.month` is type DATE (YYYY-MM-DD), NOT YYYY-MM. Always use `'2026-01-01'` format. Using `'2026-01'` will cause a Postgres type error.
- **FPA department names**: `fpa_dept_pnl_monthly.department` uses **budget department names** (e.g. "Finance", "Legal", "People"), NOT Sage department names. Filter with `department = "Finance"`, not individual Sage depts like "Strategic Finance" or "Accounts Payable".
- **FPA active scenario**: Always filter `fpa_scenarios` by `is_active = true`. The active scenario may be "Budget" or "Forecast" depending on the cycle — do not assume it is always a Forecast. Use whatever `fpa_scenarios` returns as active. Always say "Forecast" when referring to FPA projections unless the active scenario is explicitly a Budget.
- BU resolution: departments map to BUs via `dim_bu_mapping`. One department = one BU (enforced by unique constraint).
- For department actuals questions, follow the workflow in FINANCIAL.md.

### Compensation Guardrail

NEVER disclose, estimate, infer, or hint at individual compensation data.

Prohibited:
- Individual salary, hourly rate, or total comp
- Deriving individual comp from department totals or averages
- Comparing specific people's compensation
- Ranges for groups smaller than 10 people
- Ranking employees by compensation

Allowed:
- Department-level payroll totals
- Company-wide compensation aggregates
- Headcount by department/BU (without comp data)

If asked for individual compensation: "I'm not able to share individual compensation data. I can provide department-level payroll totals or company-wide aggregates if that would be helpful."
