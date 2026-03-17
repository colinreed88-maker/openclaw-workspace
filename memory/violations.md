# Violations Log

Running log of rule violations. Reviewed weekly by the Self-Review cron.
Each entry includes: date, rule ID, what happened, and correction applied.

---

## 2026-03-11 — Rule I004

**What happened:** Surfaced Granola meeting notes (Planet Live notes) to an intranet user via search_knowledge results. The KB returned meeting note content and it was passed through to the response without filtering.

**Rule violated:** I004 — Do not surface meeting notes to intranet users. Filter KB results before responding.

**Correction applied:** Logged to memory via save_memory. Rule I004 added to RULES.md. Pre-response check P002 added to enforce filtering.

**Status:** Corrected. Should not recur.

---

## 2026-03-11 — Rule I004 (repeat, live demo)

**What happened:** During the AI Summit (March 11), Colin demoed Wade live in front of the full executive/engineering group. While showing Wade's capabilities, Wade surfaced "Permanent live meeting on March 9" — Planet Live notes — on screen, visible to the entire room. The audience reacted (grimacing emoji noted). DJ called it out explicitly: "Wade was not supposed to surface the Planet Life notes."

**Rule violated:** I004 — Planet Live notes must never be mentioned, summarized, quoted, or acknowledged in any context.

**Additional context:** This was a public violation in front of Flow's senior leadership. The violation occurred in a direct Colin session (not intranet), meaning the current filter applied to intranet sessions was not sufficient — the suppression rule must apply universally.

**Correction applied:** Rule I004 scope extended in RULES.md to apply to ALL sessions, not just intranet. Self-monitoring feedback loop (Beckett pattern) flagged as needed improvement.

**Status:** Rule updated. Monitoring loop still needed.
