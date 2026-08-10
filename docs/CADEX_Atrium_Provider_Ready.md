# CADEX: Atrium's provider side is ready

Chris,

The provider half is built and the database side is on production, so Atrium can serve
`/api/v1/status` and `/api/v1/consultants` as soon as we swap keys. Nothing is switched on
yet: until I add the key you generate, both endpoints return 401 to everyone, so there's no
rush and nothing that can leak in the meantime.

## What's there

`GET /api/v1/status` answers a bare ping with no key, as in §3.1, so your "Test connection"
button and a plain curl both work. If a key is present but wrong it returns 401, so a
mistyped key in your admin panel will show up there rather than passing quietly.

`GET /api/v1/consultants?week=YYYY-MM-DD` takes any date in the target week and snaps it to
that Monday, defaulting to the current week if you leave the parameter off. It serves
published and archived quarters only, so nothing draft or provisional can appear; a week we
haven't published yet comes back as the seven day keys with empty objects, not an error.

The §7 value conventions all behave as agreed, and I've tested each against real July to
September data rather than assuming: a full day sends plain initials, a half-day split sends
"CD am / SE pm", a double-up sends the primary's initials only, and a cancelled or closed
list omits the field entirely. CICU and on-call resolve per day, so if someone takes a single
day out of a colleague's block you get whoever actually holds that day. The Friday to Monday
weekend block correctly puts the same person on both `cicu` and `onCall`.

## What you get, and what you don't

Worth being explicit, since this is a rota for a small department and people will ask me.

The feed carries two-letter initials against six theatre fields (`ct1` to `ct5` and `cl`)
plus `cicu` and `onCall`, per day, for one week at a time, and nothing else. No names, no
email addresses, no leave or availability, no NOCP markers, no job plans, no work diaries, no
notes, no draft or unpublished quarters, and no HRPAC. Those aren't filtered out at the edge
as an afterthought; the database function that serves this can only see published theatre
allocations and the two duty lines, so the rest isn't available to it to send. Resolving
initials to people happens on your side, from the list below.

## The `ct3` mapping, which I'd like to settle before we go live

Our v1.1 mapping table sends `ct3` to your Cath Lab on Thursdays, with `cl` covering the
other days. I've checked our published April to September data and the mechanics are safe:
CT3 runs on Thursdays and nothing else, 25 days in all, and CL runs only on Tuesdays and
Fridays, 10 and 25 days. They can't collide, and your "fall back to `cl` if blank" clause
never fires.

The meaning is what worries me. CT3 in our system is a theatre, labelled "occasional
thoracics", and of the 21 filled Thursdays it was the fellow 9 times and locum or substantive
consultants the other 12. There is no Atrium cath lab list on a Thursday at all. So as things
stand your Thursday Cath Lab line would be naming whoever is running our thoracics theatre,
usually the fellow, and it would do it quietly rather than failing, which is exactly the sort
of error nobody notices for a month.

If Thursday's cath lab work genuinely is what we record under CT3 then it's right as agreed
and there's nothing to change. If it isn't, I'd suggest we either drop `ct3` from your
mapping entirely, or give it its own line rather than folding it into Cath Lab. Your call
which fits Cadence better; I'm happy either way and it's a small change at my end.

## Initials to names

Seventeen people can appear in the feed. These are stable identifiers, sent verbatim, and
they're the same initials we use everywhere in Atrium.

| Initials | Name |
|---|---|
| JA | Jonathan Ambler |
| ZB | Zuzana Blazejova |
| JC | James Cole |
| CD | Craig Dunlop |
| SE | Sean Edwards |
| JH | Jennie Hares |
| CH | Craig Holdstock |
| PJ | Patrycja Jonetzko |
| NM | Nilofer Mahmood |
| PR | Pete Robbins |
| VR | Vlad Rogozov |
| LC | Leena Chaudhari |
| TG | Tharanga Gunurathna |
| SB | Steve Boumphrey |
| TB | Teresa Burnett |
| MC | Michelle Chopra |
| AA | Aminu Abdulrahman |

The last four are not core department consultants: SB, TB and MC are the general
anaesthetists who cover fixed CT1 lists, and AA is the current fellow, who rotates. When the
fellow changes I'll send you the new pairing rather than reusing the initials silently.

## What I need from you

The key, generated your end and given to me in person or on NHS mail, along with your
production base URL so I can build the consumer side against it. Once I have it I'll add it
and the feed goes live immediately, no deploy needed. If you ever want it rotated or shut
off, it's a one-line change for me and your last good import stays put in the meantime.

I'd rather have your answer on `ct3` before I turn the key on, since that's the one thing
that would be wrong without looking wrong.

Housekeeping: §8 has the initials list travelling with the key rather than separately, so
I'll hand this over with the credentials rather than send it on its own.

Have a read and see what you think.

Craig
