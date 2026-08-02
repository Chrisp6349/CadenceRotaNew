# CADEX Cadence API Contract — update

Addendum to `CADEX_Integration_Proposal_v1.0.md`'s API contract — one
change since the version already sent over.

**What changed:** Cadence now automatically matches consultant initials
to the right anaesthetist, instead of just displaying whatever code
arrives. New section below (renumbers the old "Open items for Craig" to
section 8, otherwise unchanged).

---

## 7. Consultant initials — now matched automatically on Cadence's side

Cadence resolves whatever string arrives in `ct1`–`ct5`/`cl`/`onCall`/`cicu`
against each anaesthetist's own "CADEX initials" set in Cadence's Staff
Admin (case-insensitive). A match applies the anaesthetist's full Cadence
name to the rota automatically; no match falls back to showing the raw
string with a "no match" warning rather than guessing.

This means **the exact initials convention matters**: whatever short code
The Atrium sends for a consultant needs to be entered as that same
person's "CADEX initials" in Cadence, or the match won't happen. Two-
letter capitals (e.g. "PJ") is what Cadence's placeholder text assumes,
matching the format already shown in the proposal's example payload —
but Cadence treats it as an opaque string either way, so any consistent
short code works as long as both sides agree on it per consultant.
