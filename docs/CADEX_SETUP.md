# CADEX — deployment notes

This is the Cadence side of the CADEX (Cadence-Atrium Data Exchange)
integration described in `CADEX_Integration_Proposal_v1.0.md`. The Atrium
side is a separate application and isn't part of this repo.

## What's here

- `functions/` — Firebase Cloud Functions (2nd gen, Node 20):
  - `cadex` — the Provider API (`GET /api/v1/status`, `/odp`, `/surgeons`),
    exposed at `/api/v1/**` via the Hosting rewrite in `firebase.json`.
  - `cadexSync` — a scheduled function that polls The Atrium's
    `/api/v1/consultants` once a minute for every department with CADEX
    enabled.
  - `cadexManualSync` / `cadexTestConnection` — callable functions used by
    the CADEX panel on the Administration page.
- `functions/cadex-mapping.js` — the field mapping between Cadence's rota
  data and the CADEX wire format (proposal Part 3, section 18/19).
- `firestore.rules` — adds `cadexConfig` (admin-only), `cadexStatus`
  (read-only to the department) and `cadexImports` (read-only to the
  department) under each `departments/{deptId}`.
- `js/cadex.js` — client access to the above, used by `js/admin.js`
  (the CADEX panel) and `rota.html`/`js/rota.js` (the imported-data
  badges and "Apply" buttons on the rota grid).

## First-time deploy

Requires the Firebase CLI and a Blaze (pay-as-you-go) plan — the free
Spark plan can't run Cloud Functions or Cloud Scheduler.

```
npm install --prefix functions
firebase deploy --only functions,firestore:rules,firestore:indexes,hosting
```

The first deploy of `cadexSync` also needs the Cloud Scheduler and
Eventarc APIs enabled on the Firebase project — the CLI will prompt to
enable them if they aren't already.

## Turning it on for a department

1. Sign in as an admin and open **Administration → CADEX — Atrium
   integration**.
2. Set The Atrium's base URL.
3. Generate (or paste) the two API keys:
   - **"API key Cadence sends to The Atrium"** — used as the `Authorization:
     Bearer` header when Cadence calls The Atrium's `/api/v1/consultants`.
     The Atrium needs to be told this same key.
   - **"API key The Atrium must send to Cadence"** — the key The Atrium
     must send when it calls Cadence's own `/api/v1/odp`, `/api/v1/surgeons`
     endpoints. Give this one to Craig.
4. Tick **Enabled** and **Save connection**.
5. **Test connection** checks The Atrium's `/api/v1/status` is reachable
   with the configured key. **Sync now** runs an import immediately
   instead of waiting for the next scheduled minute.

Nothing is imported automatically into the editable rota — imported
consultant names show up as a small "CADEX: …" badge next to the
relevant field, with an **Apply** button, so a person always has to
confirm before it overwrites anything (see guiding principle 9 in the
proposal).
