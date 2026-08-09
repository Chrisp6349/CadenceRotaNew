# CADEX — Atrium Response to Contract v1.0

**From:** Craig (The Atrium)
**To:** Chris (Cadence)
**Date:** August 2026
**Re:** `CADEX_Integration_Proposal_v1.0_COMPLETE.md` + `CADEX_Cadence_API_Contract_v1.0.md` + initials-matching update

**Short version: accepted.** The architecture, ownership model, endpoints, auth and
failure handling are all agreed as written. This document answers your open items,
proposes a small number of amendments for a v1.1 of the contract, and asks one
question. Nothing here changes the shape of your endpoints; the amendments concern
cadence, value conventions and one possible addition.

---

## 1. Answers to your open items

### 1.1 Consultant strings

Atrium will send its canonical consultant initials, verbatim: unique two-letter
capitals, exactly as they appear throughout Atrium (grid, ICS feed, share link).
These are stable identifiers on our side and will not change format.

The definitive initials-to-name list will be supplied alongside the API key
exchange rather than in this document, so the pairing travels with the credentials
and not with a file that may be forwarded. Enter each as that consultant's
"CADEX initials" in your Staff Admin and the auto-match will work first time.

### 1.2 Week range support

Yes. `GET /api/v1/consultants?week=YYYY-MM-DD` will serve any requested week,
snapping to Monday as per your convention, with two caveats:

- **Published rota only.** Atrium quarters move through draft states before
  publication; the feed serves published (and archived) data exclusively. No
  draft or provisional allocations will ever appear.
- Weeks with no published data return the agreed "nothing scheduled" signal:
  the day keys present, each an empty object.

Practical envelope: Atrium reliably holds the current quarter plus the next once
published (quarters are compiled roughly six weeks ahead), and history back at
least a year. Requests outside that range degrade to empty objects, never errors.

### 1.3 Keys and base URLs

Agreed as specified: two independent keys, `Authorization: Bearer`, 401 on
failure. Atrium's key for Cadence will be issued from Atrium's admin and is
revocable/rotatable on our side without redeploy; we'd ask the same of the
Cadence-issued key. Exchange in person or by NHS mail, separately from the URLs.
Base URLs and a test window to be agreed when both sides are ready; Atrium's
production base will be `https://theatrium.org.uk/api/v1/`.

---

## 2. Proposed amendments for v1.1

### 2.1 Atrium's polling of Cadence: fetch-on-view, not a fixed 60s loop

Your contract already leaves the interval to us; stating our actual behaviour so
it is on the record. Atrium will not run a 60-second background poll. Instead it
fetches `/api/v1/odp` and `/api/v1/surgeons` **when a user opens a screen that
shows the data**, through a short server-side cache (roughly 60 seconds), plus a
manual refresh. The result is the same freshness whenever anyone is actually
looking, with no scheduled infrastructure on our side, which keeps us inside your
own principle 10 (no additional paid services). Your 60-second polling of
Atrium's `/api/v1/consultants` is accepted as written and is comfortably within
our capacity; your 10-second timeout will be met.

### 2.2 Value conventions for consultant fields

Atrium theatre-days have a few shapes your single-string field cannot fully
carry. Proposed conventions, relying on your documented fallback (no match =
show raw string with a warning, never guess):

| Atrium situation | String sent | Cadence behaviour |
| --- | --- | --- |
| One consultant, full day | `CD` | Auto-matches |
| Half-day split (rare) | `CD am / SE pm` | Won't match; shows raw with warning, which is the correct outcome |
| Double-up (two consultants, one list) | Primary's initials only | Auto-matches |
| List cancelled | `""` (empty) | Field left unfilled; to theatre staff a cancelled list has nobody coming |
| Closed / no list / gap | `""` (empty) | Field left unfilled |

Confirm you're happy that empty string carries the meaning "nothing to show"
in all three of the last cases; it matches your "not yet filled in" semantics.

### 2.3 Atrium's handling of Cadence data: same courtesy as yours

Mirroring your import model: Cadence data appearing in Atrium (ODP columns,
surgeon on-call, weekend waiting-list ODP) will be displayed with a visible
"from Cadence" provenance and will never overwrite a manual Atrium entry;
where both exist, the local entry wins and the conflict is visible. Cadence
remains the sole owner of that data, per your principles 1, 2 and 7 to 9.

Your `odp1`/`odp2` pair and the weekend on-call/waiting-list fields are all
consumable on our side; no change requested to your shapes.

### 2.4 Versioning of these amendments

None of the above changes an endpoint or field. Suggest folding them into the
contract as v1.1 and holding your "additive only within v1, breaking changes
mean v2" rule from there.

---

## 3. One question: surgeon-per-theatre

Your export list covers cardiac and thoracic surgeon **on-call**, which Atrium
will gladly take and display. The original Atrium wish-list item, though, was
**which surgeon is operating in which theatre each day** - currently kept on a
spreadsheet on our side. Does Cadence hold that? If yes, we'd ask for it as an
additive field (per-theatre surgeon alongside the ODP allocations, or a fourth
endpoint - whatever suits your data). If Cadence doesn't hold it, no problem:
on-call only is still worth having, and per-theatre surgeons stay a manual/
spreadsheet concern on our side for now.

---

## 4. Sequencing from Atrium's side

Following your four-stage deployment (section 25):

1. Atrium builds its provider (`/api/v1/status`, `/api/v1/consultants`) first;
   this touches only long-stable Atrium data and can be deployed independently
   of other Atrium work in progress.
2. You test your consumer against it with the exchanged test keys.
3. Atrium's consumer of `/api/v1/odp` and `/api/v1/surgeons` lands with the next
   Atrium feature release (the theatre-team board, currently in testing), since
   that's the screen the data appears on.
4. Production keys and go-live once both sides match, per your section 25.

Status note for symmetry with yours: nothing on the Atrium side is built yet;
provider work starts once you confirm v1.1 and the conventions in 2.2.

---

*Agreed items not restated here (auth model, error handling, resilience rules,
status endpoints, governance, security) are accepted exactly as your v1.0 states
them. Atrium's `/api/v1/status` will accept both authenticated and bare pings,
matching yours.*
