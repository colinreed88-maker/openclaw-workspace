## Data Landscape

### Supabase Tables by Domain

**FP&A (Budget & Forecast)**
- `fpa_scenarios` — scenario registry (F1 Forecast, F2, Budget, Prior Year). Filter by `is_active`.
- `fpa_pnl_monthly` — consolidated monthly P&L by scenario (section, category, line_item, month, amount).
- `fpa_dept_pnl` / `fpa_dept_pnl_monthly` — department-level P&L (annual and monthly). Keyed by scenario, business_unit, department, line_item.
- `fpa_headcount_monthly` — FTE counts by department and month.
- `fpa_employees` — employee/contractor roster from the forecast model.
- `fpa_vendors` — vendor spend by department/category (software, contractors, prof_services, travel, other).
- `fpa_kpis` — pre-computed KPI metrics per scenario.
- `fpa_dept_gl_detail` — GL-level detail by department, parent_category, gl_code.

**Sage Intacct (Actuals / GL)**
- `intacct_gl_detail` — ~1M journal entry lines (Dec 2020–present). Keyed by RECORDNO (text).
- `intacct_monthly_dept_balances` — pre-aggregated GL by entity, department, account, year_month.
- `intacct_accounts` — chart of accounts (518 accounts).
- `intacct_entities` — 43 legal entities (E100–E920). OpCo = E120, Flow FS = E215, Properties = E501–E508/E515/E516.
- `intacct_departments` — ~128 ERP departments.

**Ramp (Expense Management)**
- `ramp_transactions` — card transactions (amount, merchant, BU, sage dept, card holder).
- `ramp_bills` — vendor bills/invoices with PDF storage.
- `ramp_trips` — T&E trips with route and spend.

**Toast (F&B / POS)**
- `toast_orders` / `toast_order_items` / `toast_payments` — POS data by location.
- `toast_time_entries` — labor hours, wages by employee.
- `toast_menu_items` — menu catalog by location.
- Locations: Flow Grocer, Flow Station, Flow Food Truck, Flow Pool.

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
- `app_config` — key-value config table. Key `mbr_last_closed_month` = latest month Sage data is closed through (e.g. "2026-01"). Query via query_supabase before reporting actuals.

**BU Mapping**
- `dim_bu_mapping` — source key to budget_bu (source_system: sage, budget, rippling, roster).
- `dim_bu_scopes` — BU scope classification (opco, mena, consolidated_re).

### Tool Routing

| Question type | Tool | Never use |
|---|---|---|
| Ramp spend, vendor totals, card expenses | `query_ramp_spend` (supports `department` param) | query_financial_data |
| GL detail, journal entries, Sage balances | `query_sage_gl` (supports `department` param) | query_financial_data |
| Budget, forecast, FPA line items | `query_fpa_data` | query_financial_data |
| Month-end close status | `query_supabase` (table: app_config, key: mbr_last_closed_month) | — |
| Headcount, employees, roster | `query_headcount` | query_financial_data |
| F&B revenue, Toast sales, labor | `query_toast_data` | query_financial_data |
| Qualitative, SOPs, debt docs, business context | `query_financial_data` | — |
| Specific document or file download | `retrieve_knowledge_doc` | — |
| Corrections, preferences, known rules | `search_memories` | — |
| Current web info, news, rates | `search_web` | — |
| Codebase files, config, code review | `read_github_file` | — |
| Ramp invoice PDF | `retrieve_ramp_invoice` | — |

### Business Unit Reference

Canonical BUs (display order): Executive, Tech, Growth & Revenue, F&B, Hotel, Property Mgmt, Real Estate & Dev, Shared Services, MENA, Flow Practice.
Budget-only BUs: 3rd Party Revenue, Building Elimination, FM, FFL, Condos, Unallocated Comp.

### Budget Department → Sage Departments

Each BU contains budget departments that span multiple Sage ERP departments. When someone says "Finance department", use the `department` parameter — it resolves via dim_bu_mapping to the correct set of Sage departments.

Key mappings:
- **Finance** → Finance, Corporate Accounting, Accounts Payable, Strategic Finance, Property Accounting
- **People** → People Operations, Talent Acquisition, People
- **Legal** → Legal
- **Engineering** → Engineering, Product Management - Engineering, Product Design, IT, Program Office
- **Marketing** → Marketing, Leasing, Pricing, Data Analytics, Brokerage
- **Food and Beverage** → Food and Beverage, Food and Beverage - Miami, Food and Beverage - FTL

Always use the `department` parameter (not `business_unit`) when the user asks about a specific department. The tool resolves it automatically.

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

- OpCo elimination removes intercompany management fees between OpCo and owned buildings (Society, Caoba) and F&B commissary revenue.
- Flow FS master-leases hotel space — rent expense at FS = rental income at building level.
- FPA scenarios: always filter by `is_active = true`. Current active scenarios change each forecast cycle.
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
