# Wade's Memory

## Property P&L — Key Mappings

Always use `prop_pnl_actuals` and `prop_pnl_budget` tables for property P&L questions. These feed the Portfolio P&L tab in Flow Intranet. Do NOT use raw Sage GL for property-level P&L.

Property key mappings:
- `society` → Society Las Olas → **Flow Fort Lauderdale (FFL)**
- `caoba` → Caoba Miami World Center → **Flow Miami** — always use `fmAdj` when Colin asks for Flow Miami performance
- `fmAdj` → **Flow Miami Adjusted** — the correct view for Flow Miami financials
- `brickell` → **Flow Brickell** — 3rd building in Miami
- G-West (entity E507) → **Flow House** — no financials yet

When Colin asks for "Flow Miami performance," always pull `fmAdj`, not `caoba`.

## Property P&L — Data Model

- `prop_pnl_actuals`: actuals AND budget by property. Key columns: `property`, `label`, `line_type` ('pnl' or 'kpi'), `is_subtotal`, `row_order`, `values` (actuals, jsonb array), `budget_values` (budget, jsonb array). Use `->` operator for 0-based array indexing.
- `prop_pnl_config`: contains `monthLabels` (actuals month index) and `budgetMonthLabels`
- As of March 2026: monthLabels index 56 = Jan 2026, index 57 = Feb 2026 (both available). Use `values->57` for Feb actuals.
- budgetMonthLabels index 0 = March 2026 (FY2026 Budget starts March 2026; only society and brickell have budget_values — fmAdj has none)

## OpCo vs Re_Ops Scope

In `fpa_pnl_monthly`, section = 'opco' covers: Executive, Tech, Growth & Revenue, F&B, Hotel, Shared Services.
Property Mgmt and owned-asset entities likely fall under 're_ops'.

## Sage GL Department Mapping

To map Sage GL departments to budget BUs, join:
`intacct_monthly_dept_balances` → `intacct_departments` (on department_id) → `dim_bu_mapping` (on title = source_identifier, source_system = 'sage')

`dim_fs_mapping` uses column `gl_account_number` (not `account_no`) and `financial_statement = 'Profit and Loss'` (not 'Income Statement').

## Close Status

As of March 2026: `mbr_last_closed_month` = 2026-01 (January 2026).

## Ramp Invoice Detail

When pulling Ramp bills, always try to retrieve the invoice PDF for line-item detail — hours, rates, employees, billing periods, project names. This is where the most useful information is. Use `retrieve_ramp_invoice` with the bill_id, then `pdf` tool on the download_url if available. Some invoices are not yet cached — Colin is working on getting all PDFs synced to storage.

## Colin's Preferences

- Colin is the Head of Strategic Finance at Flow (not "Flow Living" — company is Flow)
- When asking about a property, always pull from prop_pnl_actuals with the correct property key
- Flow properties: Flow Fort Lauderdale (FFL), Flow Miami, Flow Brickell, Flow House (no financials yet)

## Windows PC Node

Colin has a Windows PC. Discussed pairing it as an OpenClaw node for local desktop automation (Zoom, Granola, etc.). March 13 reminder passed — follow up when opportunity arises.

## Known Tool Issues

- `search_memories` tool has a persistent Supabase function conflict error ("Could not choose the best candidate function"). Use `memory_search` (file-based) or `memory_get` instead for reading MEMORY.md and memory/*.md.
- Google Calendar sync has been failing since March 15, 2026 with `invalid_grant`. Calendar ingestion and calendar tool calls both broken until Colin reauths.
