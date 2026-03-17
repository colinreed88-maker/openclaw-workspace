# PRD: The Self-Managed Building
**Version:** 0.1 — Draft  
**Owner:** Colin Reed  
**Date:** March 2026  
**Pilot property:** Flow Brickell

---

## Objective

By Q4 2026, Flow Brickell operates with 40% fewer labor hours per unit while maintaining or improving NOI, resident NPS, and lease renewal rate. The GM spends time on exceptions, relationships, and culture — not process execution. Every repeatable operational loop runs without a human initiating it.

---

## What We're Building

A hierarchy of purpose-built agents — leasing, operations, finance, resident experience — operating under a shared building mission, connected to Flow's data systems, and governed by defined escalation thresholds. Each agent acts autonomously within its guardrails and escalates outside them.

This is not a dashboard. It's not a recommendation engine. It's operational infrastructure that does work.

---

## Build Order: Jobs the Building Needs Done

Prioritized by value × agent-readiness. Start at the top.

| # | Job | Current State | Data Source | Action Required | Agent-Ready? |
|---|-----|--------------|-------------|-----------------|--------------|
| 1 | Prospect follow-up (24h lag today) | Manual, inconsistent | Lighthouse API | Send SMS/email | ✅ Ready now |
| 2 | Lease renewal outreach (90-day trigger) | Manual | Yardi / Snowflake | Send offer, track response | ✅ Ready now |
| 3 | Rent delinquency follow-up | Manual | Yardi | Send notice, escalate | ✅ Ready now |
| 4 | Pricing updates | Weekly manual review | Snowflake + comps | Write to pricing system | ⚠️ Needs write API |
| 5 | Work order dispatch | Phone-based | Yardi | Create WO, notify vendor | ⚠️ Needs vendor onboarding |
| 6 | Front desk visitor lookup | Yardi (30-50 sec) | Snowflake | Display + dial | ✅ Eduardo built it |
| 7 | Event check-in + engagement tracking | Google Sheets | Community OS | Log attendance, trigger follow-up | ✅ Harrison built it |
| 8 | Resident satisfaction monitoring | Opinion.com CSVs | Survey data | Flag dissatisfied residents | ⚠️ Needs data pipeline |
| 9 | Move-in/move-out coordination | Manual checklists | Yardi | Task assignment, status tracking | 🔴 Complex |
| 10 | Preventive maintenance scheduling | Ad hoc | Work order history | Schedule recurring tasks | ⚠️ Needs pattern data |

---

## What Has to Be True

### Data (Sensing)
- Yardi lease and work order data flowing into Snowflake ✅
- Prospect and funnel data via Lighthouse ✅
- Resident profiles and event history via Community OS (Eduardo / Harrison) ✅
- Pricing and market comps in Snowflake ✅
- Survey and satisfaction data — **gap, needs pipeline from Opinion.com**

### Actions (Acting)
- Resident SMS/email communications — needs Twilio or equivalent
- Work order creation in Yardi — needs browser relay or Yardi API write access
- Pricing write-back — needs Deep Sky event bus or direct API
- Vendor digital dispatch — needs vendor onboarding to digital workflow

### Guardrails (Escalation Thresholds)
Agents act autonomously within these bounds. Outside them, they flag to GM.

| Decision | Auto-act threshold | Escalate if |
|---|---|---|
| Prospect follow-up | Always | N/A |
| Renewal offer | Standard terms | Non-standard concession needed |
| Pricing adjustment | ≤5% change | >5% or vacancy >15% |
| Work order dispatch | ≤$500 estimated cost | >$500 or emergency |
| Delinquency notice | Day 3, 7, 14 standard | Legal action required |
| Resident complaint | Acknowledge + route | No resolution within 48h |

---

## What We're Not Building (Yet)

- Full autonomous lease execution (legal review required)
- Eviction workflows (legal, jurisdictional)
- Capital expenditure decisions
- Hiring and HR for building staff
- Smart building hardware integration (doors, locks, HVAC) — Phase 2

---

## Dependencies

| Dependency | Owner | Timeline |
|---|---|---|
| Deep Sky event bus (agent write access) | Scott / Deep Sky team | ~2 weeks per summit |
| Snowflake MCP server (agent read access) | Scott | Live as of March 11 |
| Vendor digital dispatch onboarding | Eduardo / Ops | TBD |
| Twilio or equivalent for resident comms | AJ / Tech | TBD |
| Opinion.com data pipeline | Colin / Data | TBD |
| Paperclip or equivalent org layer | Colin / AJ | Evaluate March 2026 |

---

## Pilot Plan

**Phase 1 (April 2026):** Leasing loop at Brickell
- Prospect follow-up agent (Lighthouse → SMS/email)
- Renewal outreach agent (Yardi trigger → offer → track)
- Delinquency follow-up agent (Yardi → notices)
- Measure: response rate, conversion rate, GM hours saved

**Phase 2 (June 2026):** Operations loop
- Work order dispatch with vendor digital workflow
- Preventive maintenance scheduling
- Front desk agent (Eduardo's tool → full agent)

**Phase 3 (Q4 2026):** Full building intelligence
- Pricing agent with write-back
- Resident engagement and satisfaction loop
- Company Cortex layer — actions connect to NOI outcomes
- Measure: total GM hours, NOI vs. budget, NPS

---

## Definition of Done

Flow Brickell's GM reviews a morning briefing of exceptions each day. Everything else ran overnight. NOI is at or above budget. Renewal rate is at or above prior year. No resident waited more than 24 hours for a response to any inquiry.
