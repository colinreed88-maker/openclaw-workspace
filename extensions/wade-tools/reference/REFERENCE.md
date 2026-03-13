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
| `query_snowflake` | Property operations data from Snowflake ANALYTICS: leasing, tenants, occupancy, rent roll, work orders, pricing, Yardi transactions, hotel, marketing. Write SQL with fully qualified table names (ANALYTICS.SCHEMA.TABLE). |
| `query_financial_data` | RAG proxy for qualitative questions, SOPs, debt docs. NOT for structured data. |
| `retrieve_knowledge_doc` | Document search and download. |
| `retrieve_ramp_invoice` | Ramp invoice PDF retrieval. |
| `read_github_file` | Read files from Flow GitHub repos (flow-intranet, flow-ai-worker, openclaw-workspace). Use to understand how pages query data, how tools work, or to diagnose data discrepancies. |
| `search_web` | Current web info, news, rates. |
| `send_email` | Send email via Resend. Optional attachments (url or content_base64). Show draft first, call after approval. |
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

---

## Snowflake (ANALYTICS Database)

Use the `query_snowflake` tool for all property operations data: leasing, tenants, occupancy, rent rolls, work orders, pricing, Yardi financials, hotel, and marketing. All tables live in the **ANALYTICS** database. Use fully qualified names like `ANALYTICS.MULTIFAMILY.TENANTS`.

### Schema Overview

| Schema | Domain | Key Tables |
|--------|--------|------------|
| MULTIFAMILY | Leasing, tenants, occupancy, rent roll | PROSPECT_DETAILS, TENANTS, DAILY_OCCUPANCY, US_RENT_ROLL_CURRENT, RENEWALS, LEASING_DAILY_ACTIVITY |
| OPERATIONS | Work orders, unit rents, hotel, concessions | YARDI_WORK_ORDERS, UNIT_RENTS, CONCESSIONS, HOTEL_RESERVATIONS_DETAILED_ROOM_RATES |
| FINANCIAL | Yardi GL transactions, arrears, lease charges | TRANSACTIONS, TENANT_ARREARS, TENANT_LEASE_CHARGES |
| HOUSE | Pre-aggregated leasing funnels | GROSS_LEASING_FUNNEL, COHORTED_PROSPECT_FUNNEL |
| PRICING | Competitor listings, market comps | LISTINGS, COMP_PROPERTIES, V_MARKET_COMPS |
| MARKETING | Daily spend, acquisition costs | MARKETING_DAILY_SPEND, PERFORMANCE_MARKETING, LEASING_ACQUISITION_COSTS |
| HOTEL | Reservations, daily/weekly summaries | DAILY_HOTEL_SUMMARY_BY_PROPERTY, RESERVATIONS, CHECK_INS, CHECK_OUTS |
| BUILDING_OPERATIONS | Zendesk tickets, make-ready, unit status | ZENDESK_TICKETS, MAKE_READY, UNIT_STATUS |
| FLOW | Master reference | PROPERTIES (13 rows), UNITS (3,907 rows) |
| DIMENSIONS | Calendar spine | CALENDAR, CALENDAR_PROPERTY_SPINE |

### Key Tables and Columns

**MULTIFAMILY.PROSPECT_DETAILS** (55,887 rows) — Full prospect journey
- PROSPECT_ID, PROPERTY_CODE, PROPERTY_GROUP, FIRST_NAME, LAST_NAME
- SOURCE, SOURCE_NAME, MARKETING_SOURCE
- PROSPECT_DATE, TOUR_DATE, APPLICATION_DATE, APPROVED_DATE, LEASE_DATE, MOVE_IN_DATE
- FUNNEL_STAGE, IS_CONVERTED, IS_ACTIVE
- DESIRED_BEDROOMS, DESIRED_FLOORPLAN

**MULTIFAMILY.TENANTS** (9,467 rows) — Tenant roster
- TENANT_ID, PROPERTY_CODE, PROPERTY_GROUP, NAME
- STATUS (Current, Former, Future, Eviction, etc.)
- UNIT_CODE, FLOORPLAN, BEDROOMS, SQFT
- LEASE_START, LEASE_END, MOVE_IN_DATE, MOVE_OUT_DATE
- MONTHLY_RENT, MARKET_RENT, CONCESSION_AMOUNT

**MULTIFAMILY.DAILY_OCCUPANCY** (9,417 rows) — Daily occupancy by property
- DATE, PROPERTY_CODE, PROPERTY_GROUP
- TOTAL_UNITS, OCCUPIED_UNITS, OCCUPANCY_PCT
- NET_LEASED_30, NET_LEASED_60, NET_LEASED_90
- VACANT_UNITS, VACANT_PCT

**MULTIFAMILY.US_RENT_ROLL_CURRENT** (3,111 rows) — Current rent roll snapshot
- PROPERTY_CODE, PROPERTY_GROUP, UNIT_CODE, FLOORPLAN
- BEDROOMS, SQFT, STATUS
- MARKET_RENT, LEASE_RENT, EFFECTIVE_RENT
- CONCESSION_AMOUNT, TRADE_OUT
- LEASE_START, LEASE_END

**MULTIFAMILY.RENEWALS** (9,829 rows) — Renewal and move-out detail
- PROPERTY_CODE, PROPERTY_GROUP, TENANT_ID, UNIT_CODE
- RENEWAL_STATUS, LEASE_END
- PRIOR_RENT, NEW_RENT, MARKET_RENT
- TRADE_OUT, CONCESSION_AMOUNT

**MULTIFAMILY.LEASING_DAILY_ACTIVITY** (105,501 rows) — Per-person daily flags
- DATE, PROPERTY_CODE, PROPERTY_GROUP, LEASING_AGENT
- IS_PROSPECT, IS_TOUR, IS_APPLICATION, IS_LEASE, IS_MOVE_IN

**OPERATIONS.YARDI_WORK_ORDERS** (47,026 rows) — Work orders
- WORK_ORDER_ID, PROPERTY_CODE, PROPERTY_GROUP
- CATEGORY, SUB_CATEGORY, PRIORITY, STATUS
- CREATED_DATE, COMPLETED_DATE, DAYS_OPEN
- UNIT_CODE, ASSIGNED_TECH, DESCRIPTION

**FINANCIAL.TRANSACTIONS** (1,586,576 rows) — All Yardi transactions
- TRANSACTION_ID, PROPERTY_CODE, PROPERTY_GROUP
- TENANT_ID, UNIT_CODE
- TRANSACTION_DATE, TRANSACTION_TYPE, GL_ACCOUNT
- AMOUNT, DESCRIPTION

**FINANCIAL.TENANT_ARREARS** (124,183 rows) — Aging buckets
- PROPERTY_CODE, PROPERTY_GROUP, TENANT_ID, UNIT_CODE
- CURRENT_BALANCE, DAYS_30, DAYS_60, DAYS_90, DAYS_120_PLUS
- TOTAL_BALANCE

**HOUSE.GROSS_LEASING_FUNNEL** (413,748 rows) — Daily funnel by property + source
- DATE, PROPERTY_CODE, PROPERTY_GROUP, MARKETING_SOURCE
- PROSPECTS, TOURS, APPLICATIONS, APPROVALS, LEASES, MOVE_INS
- CONVERSION_TOUR_PCT, CONVERSION_LEASE_PCT

**MARKETING.MARKETING_DAILY_SPEND** (86,316 rows) — Marketing spend
- DATE, PROPERTY_CODE, PROPERTY_GROUP, CHANNEL
- SPEND, IMPRESSIONS, CLICKS

**HOTEL.DAILY_HOTEL_SUMMARY_BY_PROPERTY** (13,785 rows)
- DATE, PROPERTY_CODE
- ROOMS_AVAILABLE, ROOMS_SOLD, OCCUPANCY_PCT
- ADR, REVPAR, REVENUE

### Flow Properties (FLOW.PROPERTIES)

| Code | Name | Group |
|------|------|-------|
| flow_miami_world | Flow Miami World | Flow Miami |
| flow_miami_east | Flow Miami East | Flow Miami |
| flow_miami_west | Flow Miami West | Flow Miami |
| r2108 | Flow Fort Lauderdale | Flow Fort Lauderdale |
| flow_brickell | Flow Brickell | Flow Brickell |
| stacks | Stacks on Main | Stacks on Main |
| society | Society Las Olas | Society Las Olas |
| 2010_west_end | 2010 West End | 2010 West End |
| 3005_buckhead | 3005 Buckhead | 3005 Buckhead |
| trace | Trace | Trace |
| caoba | Caoba | Caoba |
| g_west | G-West | G-West |

Use PROPERTY_CODE for filtering. Use PROPERTY_GROUP to aggregate across sub-buildings (e.g., Flow Miami group = world + east + west).

### Example Queries

**Occupancy by property (latest day)**
```sql
SELECT PROPERTY_GROUP, DATE, TOTAL_UNITS, OCCUPIED_UNITS,
  ROUND(OCCUPANCY_PCT * 100, 1) AS OCC_PCT
FROM ANALYTICS.MULTIFAMILY.DAILY_OCCUPANCY
WHERE DATE = (SELECT MAX(DATE) FROM ANALYTICS.MULTIFAMILY.DAILY_OCCUPANCY)
ORDER BY PROPERTY_GROUP
```

**Leasing funnel summary (last 30 days)**
```sql
SELECT PROPERTY_GROUP,
  SUM(PROSPECTS) AS PROSPECTS, SUM(TOURS) AS TOURS,
  SUM(APPLICATIONS) AS APPS, SUM(LEASES) AS LEASES
FROM ANALYTICS.HOUSE.GROSS_LEASING_FUNNEL
WHERE DATE >= DATEADD('day', -30, CURRENT_DATE())
GROUP BY PROPERTY_GROUP ORDER BY PROSPECTS DESC
```

**Open work orders by property**
```sql
SELECT PROPERTY_GROUP, CATEGORY, COUNT(*) AS OPEN_COUNT,
  ROUND(AVG(DAYS_OPEN), 1) AS AVG_DAYS_OPEN
FROM ANALYTICS.OPERATIONS.YARDI_WORK_ORDERS
WHERE STATUS NOT IN ('Completed', 'Cancelled')
GROUP BY PROPERTY_GROUP, CATEGORY
ORDER BY OPEN_COUNT DESC
```

**Current rent roll summary**
```sql
SELECT PROPERTY_GROUP, COUNT(*) AS UNITS,
  ROUND(AVG(MARKET_RENT), 0) AS AVG_MARKET,
  ROUND(AVG(LEASE_RENT), 0) AS AVG_LEASE,
  ROUND(AVG(TRADE_OUT), 0) AS AVG_TRADE_OUT
FROM ANALYTICS.MULTIFAMILY.US_RENT_ROLL_CURRENT
GROUP BY PROPERTY_GROUP ORDER BY PROPERTY_GROUP
```

**Tenant arrears summary**
```sql
SELECT PROPERTY_GROUP,
  COUNT(*) AS TENANTS_WITH_BALANCE,
  ROUND(SUM(TOTAL_BALANCE), 0) AS TOTAL_ARREARS,
  ROUND(SUM(DAYS_30), 0) AS OVER_30,
  ROUND(SUM(DAYS_60), 0) AS OVER_60,
  ROUND(SUM(DAYS_90), 0) AS OVER_90
FROM ANALYTICS.FINANCIAL.TENANT_ARREARS
WHERE TOTAL_BALANCE > 0
GROUP BY PROPERTY_GROUP ORDER BY TOTAL_ARREARS DESC
```

**Hotel performance (last 7 days)**
```sql
SELECT PROPERTY_CODE, DATE, ROOMS_SOLD, OCCUPANCY_PCT,
  ROUND(ADR, 2) AS ADR, ROUND(REVPAR, 2) AS REVPAR
FROM ANALYTICS.HOTEL.DAILY_HOTEL_SUMMARY_BY_PROPERTY
WHERE DATE >= DATEADD('day', -7, CURRENT_DATE())
ORDER BY DATE DESC, PROPERTY_CODE
```

**Marketing spend by channel (current month)**
```sql
SELECT CHANNEL, PROPERTY_GROUP,
  ROUND(SUM(SPEND), 2) AS TOTAL_SPEND,
  SUM(CLICKS) AS CLICKS, SUM(IMPRESSIONS) AS IMPRESSIONS
FROM ANALYTICS.MARKETING.MARKETING_DAILY_SPEND
WHERE DATE >= DATE_TRUNC('month', CURRENT_DATE())
GROUP BY CHANNEL, PROPERTY_GROUP ORDER BY TOTAL_SPEND DESC
```

### Snowflake vs Supabase Tool Routing

| Question type | Use tool |
|---|---|
| Leasing funnel, prospects, tours, apps | `query_snowflake` |
| Tenants, rent roll, occupancy | `query_snowflake` |
| Work orders, maintenance | `query_snowflake` |
| Yardi transactions, tenant arrears | `query_snowflake` |
| Pricing comps, market rents | `query_snowflake` |
| Hotel reservations, ADR, RevPAR | `query_snowflake` |
| Marketing spend, acquisition costs | `query_snowflake` |
| Ramp card/bill spend | `query_ramp_spend` |
| Sage GL, journal entries | `query_sage_gl` |
| Budget, forecast, FPA data | `query_supabase` |
| Toast F&B, restaurant sales | `query_toast_data` |
| Headcount, employees, roster | `query_supabase` |
| Qualitative, SOPs, debt docs | `query_financial_data` |

### Snowflake Query Guidelines

- Always use fully qualified table names: `ANALYTICS.SCHEMA.TABLE`
- Only SELECT statements allowed (no INSERT, UPDATE, DELETE, DDL)
- Results capped at 5,000 rows; use GROUP BY or LIMIT for large tables
- Use Snowflake date functions: `DATEADD('day', -30, CURRENT_DATE())`, `DATE_TRUNC('month', ...)`, `DATEDIFF('day', ...)`
- Filter by PROPERTY_CODE (exact match) or PROPERTY_GROUP (grouping)
- Column and table names are UPPERCASE in Snowflake
- When the user says "Flow Miami" they mean the PROPERTY_GROUP = 'Flow Miami' (3 buildings), not a single property
