# CADEX — Cadence Response to Atrium's v1.0 Response

**From:** Chris (Cadence)
**To:** Craig (The Atrium)
**Date:** August 2026
**Re:** `CADEX_Atrium_Response_v1.0.md`

**Short version: all agreed.** All of section 1's answers, all four
amendments in section 2, and the sequencing in section 4 are accepted as
written. Section 3's question has a yes — details below, and it's now
folded into `CADEX_Cadence_API_Contract_v1.1.md`, attached.

---

## 1. Your answers — all accepted

- **1.1 (initials):** Understood — the initials-to-name list will come
  with the key exchange rather than this document. Will enter each
  consultant's initials against their record in Cadence's Staff Admin as
  soon as that arrives.
- **1.2 (week range):** Agreed, including the caveats. Published-only is
  exactly right for Cadence too — Cadence only ever requests the current
  week in practice, so it's comfortably inside your coverage window.
  Empty-object-for-nothing-scheduled matches Cadence's own semantics
  already.
- **1.3 (keys/base URLs):** Agreed. Your production base
  (`https://theatrium.org.uk/api/v1/`) is noted in the contract. Same
  revocable-without-redeploy expectation holds for the key Cadence
  issues you.

## 2. Your amendments — all accepted

- **2.1 (fetch-on-view):** Fine as-is — this is entirely your side of
  the fence and needs no change to what Cadence exposes. Noted in the
  contract for the record.
- **2.2 (value conventions):** Confirmed — yes, empty string means
  "nothing to show" in all three cases you listed. Checked this against
  Cadence's actual implementation rather than just agreeing on paper:
  the half-day-split and double-up cases already fall through to the
  "no match, show raw string with a warning" path with zero code
  changes needed, and an empty string already means no badge is shown
  at all. Nothing to build on Cadence's side for this one.
- **2.3 (your handling of Cadence data):** Acknowledged, and it mirrors
  what Cadence already does — glad we converged on the same pattern
  independently.
- **2.4 (versioning):** Done — see `CADEX_Cadence_API_Contract_v1.1.md`.
  Agreed on your rule: additive stays v1.x, anything breaking is v2.

## 3. Per-theatre surgeon — yes, Cadence holds this

Cadence's nursing rota already tracks which surgeon is assigned to each
theatre, Monday–Friday (plus a weekend waiting-list surgeon) — separate
from the cardiac/thoracic on-call fields already in the v1.0 contract.

Added as an additive field on the existing `/api/v1/surgeons` endpoint
rather than a new one, since it's the same weekly document on Cadence's
side:

```json
"monday": {
  "cardiacOnCall": "Mr Adams",
  "thoracicOnCall": "Ms Baker",
  "theatres": { "Theatre 1": "Mr Adams", "Theatre 2": "Ms Baker", "Cath Lab": "Mr Clarke" }
}
```

Same theatre-name set as `/api/v1/odp`'s `theatres` object (Theatre 1/2/4/5,
Cath Lab — whichever exist for the department), Monday–Friday only, and
a `waitingListSurgeon` field for Saturday/Sunday. Full shape is in
`CADEX_Cadence_API_Contract_v1.1.md` §3.3. This is already implemented
in Cadence's code, not yet deployed.

## 4. Sequencing — agreed

Your four-step order matches ours. Status on Cadence's side: provider
and consumer are both coded, nothing deployed yet — will confirm once
Cadence's environment is live so we can move to your step 2 (testing
Cadence's consumer against your provider with test keys).

---

*Attached: `CADEX_Cadence_API_Contract_v1.1.md` — supersedes v1.0.*
