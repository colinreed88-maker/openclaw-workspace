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
| Leasing funnel, prospects, tours, apps | `query_snowflake` | query_financial_data |
| Tenants, rent roll, occupancy | `query_snowflake` | query_financial_data |
| Work orders, maintenance | `query_snowflake` | query_financial_data |
| Yardi transactions, tenant arrears | `query_snowflake` | query_financial_data |
| Pricing comps, market rents | `query_snowflake` | query_financial_data |
| Hotel reservations, ADR, RevPAR | `query_snowflake` | query_financial_data |
| Marketing spend, acquisition costs | `query_snowflake` | query_financial_data |
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
- PROPERTY_NAME, FULL_NAME, PERSON_FIRST_NAME, PERSON_LAST_NAME
- FIRST_TOUCH_SOURCE, MARKETING_SOURCE
- PROSPECT_CREATED_DATE, APPLICATION_DATE, LEASE_DATE, MOVE_IN_DATE
- FUNNEL_STAGE, CURRENT_PROSPECT_STATUS, IS_DEDUPLICATED_RECORD

**MULTIFAMILY.TENANTS** (9,467 rows) — Tenant roster
- PROPERTY_NAME, UNIT_NAME, TENANT_CODE, FIRST_NAME, LAST_NAME, EMAIL
- TENANT_STATUS (Current, Former, Future, Eviction, etc.)
- FLOORPLAN, FLOORPLAN_DESC, BEDROOMS, SQFT
- TENANT_RENT, LEASE_FROM_DATE, LEASE_TO_DATE, MOVE_IN_DATE, MOVE_OUT_DATE
- LEASE_TERM, IS_MONTH_TO_MONTH

**MULTIFAMILY.DAILY_OCCUPANCY** (9,417 rows) — Daily occupancy by property
- DAY, PROPERTY_NAME
- TOTAL_UNITS, OCCUPIED_UNITS, OCCUPANCY_PCT
- NET_LEASED_30_PCT, NET_LEASED_60_PCT, NET_LEASED_90_PCT

**MULTIFAMILY.US_RENT_ROLL_CURRENT** (3,111 rows) — Current rent roll snapshot
- PROPERTY_NAME, UNIT_NAME, FLOORPLAN_DESC
- BEDROOMS, SQFT, UNIT_STATUS, OCCUPANCY_STATUS
- IS_OCCUPIED, IS_VACANT, IS_EXCLUDED
- MARKET_RENT, LEASE_RENT, EFFECTIVE_LEASE_RENT
- TOTAL_CONCESSION, LEASE_TRADE_OUT
- LEASE_START_DATE, LEASE_END_DATE, DAYS_REMAINING

**MULTIFAMILY.RENEWALS** (9,829 rows) — Renewal and move-out detail
- PROPERTY_NAME, UNIT_NAME, NAME
- LEASE_FROM_DATE, LEASE_TO_DATE, RENEWAL_DATE
- LEASE_RENT, PRIOR_LEASE_RENT, MARKET_RENT, LEASE_TRADE_OUT
- IS_RENEWAL_OR_TRANSFER, MOVE_OUT_REASON, DAYS_UNTIL_EXPIRATION, EXCLUSION_ROW

**MULTIFAMILY.LEASING_DAILY_ACTIVITY** (105,501 rows) — Per-person daily flags
- ACTIVITY_DATE, PROPERTY_NAME, PERSON_KEY
- HAD_PROSPECT_CREATED, HAD_TOUR_SCHEDULED, HAD_TOUR_COMPLETED, HAD_TOUR_MISSED
- HAD_APPLICATION, HAD_APPROVAL, HAD_LEASE, HAD_MOVE_IN

**OPERATIONS.YARDI_WORK_ORDERS** (47,026 rows) — Work orders
- WORK_ORDER_ID, PROPERTY_NAME, UNIT_NAME
- WORK_ORDER_CATEGORY, WORK_ORDER_SUBCATEGORY, WORK_ORDER_STATUS, WORK_ORDER_PRIORITY
- CALL_DATE, SCHEDULED_DATE, WORK_ORDER_COMPLETE_DATE
- CALLER_NAME, ASSIGNED_TO_FIRST_NAME, ASSIGNED_TO_LAST_NAME, YARDI_GROUP
- WORK_ORDER_DESC, ORIGIN

**FINANCIAL.TRANSACTIONS** (1,586,576 rows) — All Yardi transactions
- PROPERTY_NAME, UNIT_NAME, TENANT_CODE
- TRANSACTION_TYPE, GL_ACCOUNT_NAME
- POST_DATE, TRANSACTION_AMOUNT, TOTAL_AMOUNT
- TRANSACTION_NOTES, CREATED_BY_NAME

**FINANCIAL.TENANT_ARREARS** (124,183 rows) — Aging buckets
- PROPERTY_NAME, TENANT_ID
- THIRTY_DAY_PAST_DUE, SIXTY_DAY_PAST_DUE, NINETY_DAY_PAST_DUE, OVER_NINETY_DAY_PAST_DUE

**HOUSE.GROSS_LEASING_FUNNEL** (413,748 rows) — Daily funnel by property + source
- DAY, PROPERTY_NAME
- PROSPECTS, TOURS_SCHEDULED, TOURS_COMPLETED, TOURS_MISSED, APPS_STARTED

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
SELECT PROPERTY_NAME, DAY, TOTAL_UNITS, OCCUPIED_UNITS,
  ROUND(OCCUPANCY_PCT * 100, 1) AS OCC_PCT
FROM ANALYTICS.MULTIFAMILY.DAILY_OCCUPANCY
WHERE DAY = (SELECT MAX(DAY) FROM ANALYTICS.MULTIFAMILY.DAILY_OCCUPANCY)
ORDER BY PROPERTY_NAME
```

**Leasing funnel summary (last 30 days)**
```sql
SELECT PROPERTY_NAME,
  SUM(PROSPECTS) AS PROSPECTS, SUM(TOURS_SCHEDULED) AS TOURS,
  SUM(APPS_STARTED) AS APPS
FROM ANALYTICS.HOUSE.GROSS_LEASING_FUNNEL
WHERE DAY >= DATEADD('day', -30, CURRENT_DATE())
GROUP BY PROPERTY_NAME ORDER BY PROSPECTS DESC
```

**Open work orders by property**
```sql
SELECT PROPERTY_NAME, WORK_ORDER_CATEGORY, COUNT(*) AS OPEN_COUNT,
  ROUND(AVG(DATEDIFF('day', CALL_DATE, CURRENT_DATE())), 1) AS AVG_DAYS_OPEN
FROM ANALYTICS.OPERATIONS.YARDI_WORK_ORDERS
WHERE WORK_ORDER_STATUS NOT IN ('Work Completed', 'Canceled')
GROUP BY PROPERTY_NAME, WORK_ORDER_CATEGORY
ORDER BY OPEN_COUNT DESC
```

**Current rent roll summary**
```sql
SELECT PROPERTY_NAME, COUNT(*) AS UNITS,
  ROUND(AVG(MARKET_RENT), 0) AS AVG_MARKET,
  ROUND(AVG(LEASE_RENT), 0) AS AVG_LEASE,
  ROUND(AVG(LEASE_TRADE_OUT), 0) AS AVG_TRADE_OUT
FROM ANALYTICS.MULTIFAMILY.US_RENT_ROLL_CURRENT
GROUP BY PROPERTY_NAME ORDER BY PROPERTY_NAME
```

**Tenant arrears summary**
```sql
SELECT PROPERTY_NAME,
  COUNT(DISTINCT TENANT_ID) AS TENANTS_WITH_BALANCE,
  ROUND(SUM(THIRTY_DAY_PAST_DUE + SIXTY_DAY_PAST_DUE + NINETY_DAY_PAST_DUE + OVER_NINETY_DAY_PAST_DUE), 0) AS TOTAL_ARREARS,
  ROUND(SUM(THIRTY_DAY_PAST_DUE), 0) AS OVER_30,
  ROUND(SUM(SIXTY_DAY_PAST_DUE), 0) AS OVER_60,
  ROUND(SUM(NINETY_DAY_PAST_DUE), 0) AS OVER_90
FROM ANALYTICS.FINANCIAL.TENANT_ARREARS
WHERE (THIRTY_DAY_PAST_DUE + SIXTY_DAY_PAST_DUE + NINETY_DAY_PAST_DUE + OVER_NINETY_DAY_PAST_DUE) > 0
GROUP BY PROPERTY_NAME ORDER BY TOTAL_ARREARS DESC
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
