# CADEX — Cadence reply: CT3 confirmed, ready for key exchange

**From:** Chris (Cadence)
**To:** Craig (The Atrium)
**Date:** August 2026
**Re:** `CADEX_Atrium_Provider_Ready.md`

Craig,

Great news that the provider side is built and tested — appreciate you
checking the §7 conventions against real data rather than just the spec,
and the "keep an eye out for the fellow rotating" note.

## CT3

Confirmed: Thursday's Cath Lab list in Cadence genuinely is that
occasional thoracics list — same clinical activity, just recorded under
"Cath Lab" as the theatre name on our side historically. The mapping is
right as agreed. `ct3` → Cath Lab, Thursdays only, no change needed on
either side.

## Initials

Got the list of seventeen. Will enter each against the matching
anaesthetist's "CADEX initials" field in Cadence's Staff Admin before we
switch anything on, so the auto-match works from the first import rather
than showing "no match" warnings while I catch up. Noted on SB/TB/MC
being the fixed CT1 general anaesthetists and AA being the current
fellow — will treat that pairing as provisional and expect a new one
from you whenever the fellow changes, same as you said.

## What's left on Cadence's side before the key exchange

Nothing to redesign — this is deployment, not more design work:

1. Deploy Cadence's CADEX Cloud Functions and Firestore rules to
   production (not yet done).
2. Generate the two API keys in Cadence's Administration → CADEX panel.
3. Enter the seventeen initials into Staff Admin (above).
4. Send you Cadence's key and production base URL; take your key and
   confirm `https://theatrium.org.uk/api/v1/` as agreed in v1.1.

Will confirm once that's done and we can move to your step 2 (testing
Cadence's consumer against your provider with test keys) — no rush on
your end in the meantime, as you said.

Chris
