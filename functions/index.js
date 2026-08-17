// -----------------------------------------------------------------------
// index.js — CADEX (Cadence-Atrium Data Exchange)
//
// Implements the proposal at CADEX_Integration_Proposal_v1.0 (Chris
// Parrish -> Craig, August 2026): a read-only, authenticated REST API in
// each direction between Cadence and The Atrium, synchronised
// automatically, with no shared database and no direct writes into the
// other application's editable rota fields (guiding principles 1-4, 9).
//
// Three pieces:
//   - cadex (onRequest)      Provider API: GET /api/v1/{odp,surgeons,status}
//                             Exposed at /api/v1/** via the hosting rewrite
//                             in firebase.json.
//   - cadexSync (onSchedule) Consumer: polls The Atrium's /api/v1/consultants
//                             every minute (the proposal's "every 60
//                             seconds") for every department with CADEX
//                             enabled, and writes the result into a
//                             read-only cadexImports doc — never into the
//                             editable weekly rota directly, so an import
//                             can never silently clobber a local edit.
//   - cadexManualSync / cadexTestConnection (onCall)
//                             Admin-triggered versions of the same, for
//                             the CADEX panel in Administration.
// -----------------------------------------------------------------------

const { onRequest, HttpsError, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const { buildOdpExport, buildSurgeonsExport, mapAtriumConsultants, applyCadexToWeekData } = require("./cadex-mapping");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "europe-west2", maxInstances: 10 });

const API_VERSION = "v1";
const FETCH_TIMEOUT_MS = 10000;

function mondayOf(dateStr) {
  const d = dateStr ? new Date(dateStr + "T00:00:00Z") : new Date();
  const day = (d.getUTCDay() + 6) % 7; // Monday=0..Sunday=6
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().split("T")[0];
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---- Provider auth: resolve an inbound Bearer key to a department -----
// Every department's config lives at departments/{deptId}/cadexConfig/settings.
// providerApiKey is the key The Atrium must send when calling *us*.
//
// Deliberately does NOT check `enabled` — that flag controls whether
// Cadence's own Consumer polls The Atrium (see enabledCadexConfigs()
// below), a completely separate direction. Provider auth only needs a
// matching key: the two sides can and do go live independently, exactly
// as CADEX's two-independent-connections design intends. Requiring
// `enabled` here would mean nobody can even test the key against
// Cadence's Provider API until Cadence's own Consumer is switched on —
// which is the wrong direction to gate on.
async function departmentForProviderKey(apiKey) {
  if (!apiKey) return null;
  const snap = await db.collectionGroup("cadexConfig")
    .where("providerApiKey", "==", apiKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const configDoc = snap.docs[0];
  if (configDoc.id !== "settings") return null;
  return configDoc.ref.parent.parent.id;
}

function bearerToken(req) {
  const h = req.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function recordExportStatus(deptId, ok, error) {
  await db.doc(`departments/${deptId}/cadexStatus/live`).set({
    export: {
      lastRequestAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRequestOk: ok,
      lastError: error || null,
      apiVersion: API_VERSION
    }
  }, { merge: true });
}

// ---- Provider API: GET /api/v1/{status,odp,surgeons} -------------------
const cadex = onRequest(async (req, res) => {
  const path = req.path.replace(/^\/?api\/v1\/?/, "").split("?")[0];
  const key = bearerToken(req);

  if (path === "status" && !key) {
    // A bare, unauthenticated status ping is fine — it reveals nothing
    // about any department. Every other endpoint requires the key.
    res.json({ version: API_VERSION, status: "ok", timestamp: new Date().toISOString() });
    return;
  }

  const deptId = await departmentForProviderKey(key);
  if (!deptId) {
    res.status(401).json({ error: "invalid_api_key" });
    return;
  }

  const weekId = mondayOf(req.query.week);

  try {
    if (path === "status") {
      res.json({ version: API_VERSION, status: "ok", timestamp: new Date().toISOString() });
      await recordExportStatus(deptId, true);
      return;
    }

    if (path === "odp") {
      const [weekSnap, theatreSnap] = await Promise.all([
        db.doc(`departments/${deptId}/weeks/${weekId}`).get(),
        db.collection(`departments/${deptId}/theatres`).get()
      ]);
      const theatres = theatreSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const payload = buildOdpExport(weekId, weekSnap.exists ? weekSnap.data() : null, theatres);
      res.json(payload);
      await recordExportStatus(deptId, true);
      return;
    }

    if (path === "surgeons") {
      const [nursingSnap, theatreSnap] = await Promise.all([
        db.doc(`departments/${deptId}/nursingWeeks/${weekId}`).get(),
        db.collection(`departments/${deptId}/theatres`).get()
      ]);
      const theatres = theatreSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const payload = buildSurgeonsExport(weekId, nursingSnap.exists ? nursingSnap.data() : null, theatres);
      res.json(payload);
      await recordExportStatus(deptId, true);
      return;
    }

    res.status(404).json({ error: "not_found" });
  } catch (err) {
    logger.error("CADEX provider request failed", { deptId, path, error: err.message });
    await recordExportStatus(deptId, false, err.message);
    res.status(500).json({ error: "internal_error" });
  }
});

// How far ahead of the current week to pull each sync — staff naturally
// look further ahead than "this week" when checking the rota (planning,
// swaps, upcoming on-call), and Atrium confirmed it holds the current
// quarter plus the next once published, so requesting a few weeks
// ahead is well within what it can serve. A week Atrium hasn't
// published yet just comes back as empty per-day objects (see §4.2 of
// the contract) — harmless, and picked up automatically once published.
const SYNC_WEEKS_AHEAD = 4;

function addWeeks(weekId, weeks) {
  const d = new Date(weekId + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}

// Fetches one week's consultant data, stores it in cadexImports (the
// read-only projection the rota page displays badges from), and — new —
// also applies whatever's safe to apply directly into the live
// weeks/{weekId} document, the same way applyCadexToWeekData() would
// if someone had the rota page open. This is what makes an already-
// published week's Dashboard/corridor board display update on its own,
// instead of staying stale until someone opens Rota and republishes.
// `published` is never touched here — merge() only changes `data` and
// leaves whatever publish state a human already chose exactly as it
// was, for a draft or a published week alike.
async function syncOneWeek(deptId, config, weekId, theatres, anaesInitials) {
  const url = `${config.atriumBaseUrl.replace(/\/$/, "")}/api/v1/consultants?week=${weekId}`;

  let resp;
  try {
    resp = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${config.atriumApiKey}`, Accept: "application/json" }
    });
  } catch (err) {
    return { ok: false, weekId, error: `network error: ${err.message}` };
  }

  if (!resp.ok) {
    return { ok: false, weekId, error: `Atrium returned HTTP ${resp.status}` };
  }

  let payload;
  try {
    payload = await resp.json();
  } catch (err) {
    return { ok: false, weekId, error: "invalid JSON from Atrium" };
  }

  const receivedWeekId = mondayOf(payload.weekCommencing) || weekId;
  const days = mapAtriumConsultants(payload);

  await db.doc(`departments/${deptId}/cadexImports/${receivedWeekId}`).set({
    weekCommencing: receivedWeekId,
    source: "atrium",
    sourceLastUpdated: payload.lastUpdated || null,
    receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    days
  });

  await applyToLiveWeek(deptId, receivedWeekId, days, theatres, anaesInitials);

  return { ok: true, weekId: receivedWeekId };
}

// Applies matched, non-overridden anaesthetist fields straight into the
// week's live data and logs it to the same Change log the rota page's
// own saves go to — under "CADEX (automatic)" rather than a person's
// name, so it's always clear from the log which changes were made by
// someone and which happened on their own. A no-op (no write, no log
// entry) when nothing actually changed, which is the common case once
// a week's already in sync.
async function applyToLiveWeek(deptId, weekId, days, theatres, anaesInitials) {
  const ref = db.doc(`departments/${deptId}/weeks/${weekId}`);
  const snap = await ref.get();
  const current = snap.exists ? snap.data() : { data: {}, published: false };
  const { data, changes } = applyCadexToWeekData(current.data || {}, days, theatres, anaesInitials);
  if (!changes.length) return;

  await ref.set({ data }, { merge: true });

  await db.collection(`departments/${deptId}/auditLog`).add({
    weekStart: weekId,
    uid: "cadex",
    displayName: "CADEX (automatic)",
    action: "auto-updated",
    changeCount: changes.length,
    changes: changes.slice(0, 20),
    truncated: changes.length > 20,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
}

// Syncs the current week plus SYNC_WEEKS_AHEAD weeks ahead, then
// records one combined status: "ok" if at least one week succeeded (a
// single flaky week ahead shouldn't mark the whole import as failed),
// with the first error kept for the status panel if none did.
async function syncDepartment(deptId, config) {
  const [theatreSnap, staffSnap] = await Promise.all([
    db.collection(`departments/${deptId}/theatres`).get(),
    db.collection(`departments/${deptId}/staff`).get()
  ]);
  const theatres = theatreSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const anaesInitials = {};
  staffSnap.docs.forEach(d => {
    const s = d.data();
    if (s.type === "anaesthetist" && s.initials) anaesInitials[s.initials.trim().toUpperCase()] = s.name;
  });

  const currentWeek = mondayOf();
  const weekIds = Array.from({ length: SYNC_WEEKS_AHEAD + 1 }, (_, i) => addWeeks(currentWeek, i));
  const results = await Promise.all(weekIds.map(weekId => syncOneWeek(deptId, config, weekId, theatres, anaesInitials)));

  const statusRef = db.doc(`departments/${deptId}/cadexStatus/live`);
  const anyOk = results.some(r => r.ok);
  if (anyOk) {
    await statusRef.set({ import: {
      lastImportAt: admin.firestore.FieldValue.serverTimestamp(),
      lastImportOk: true,
      lastError: null
    } }, { merge: true });
  } else {
    await statusRef.set({ import: {
      lastFailureAt: admin.firestore.FieldValue.serverTimestamp(),
      lastImportOk: false,
      lastError: results[0]?.error || "unknown error"
    } }, { merge: true });
  }

  return { ok: anyOk, weekIds: results.filter(r => r.ok).map(r => r.weekId), errors: results.filter(r => !r.ok) };
}

async function enabledCadexConfigs() {
  const snap = await db.collectionGroup("cadexConfig").where("enabled", "==", true).get();
  return snap.docs
    .filter(d => d.id === "settings" && d.data().atriumBaseUrl && d.data().atriumApiKey)
    .map(d => ({ deptId: d.ref.parent.parent.id, config: d.data() }));
}

// Cloud Scheduler's minimum granularity is one minute — this is the
// closest match to the proposal's "automatic every 60 seconds" without
// needing a separate always-on process.
exports.cadexSync = onSchedule("every 1 minutes", async () => {
  const configs = await enabledCadexConfigs();
  await Promise.all(configs.map(({ deptId, config }) =>
    syncDepartment(deptId, config).catch(err => logger.error("CADEX sync threw", { deptId, error: err.message }))
  ));
});

exports.cadex = cadex;

// ---- Admin callables: manual sync + test connection --------------------
async function requireDeptAdmin(auth, deptId) {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const userSnap = await db.doc(`users/${auth.uid}`).get();
  const profile = userSnap.exists ? userSnap.data() : null;
  if (!profile || profile.departmentId !== deptId || profile.role !== "admin") {
    throw new HttpsError("permission-denied", "Only an admin for this department can do this.");
  }
}

exports.cadexManualSync = onCall(async (request) => {
  const { deptId } = request.data || {};
  if (!deptId) throw new HttpsError("invalid-argument", "deptId is required.");
  await requireDeptAdmin(request.auth, deptId);

  const configSnap = await db.doc(`departments/${deptId}/cadexConfig/settings`).get();
  if (!configSnap.exists || !configSnap.data().enabled) {
    throw new HttpsError("failed-precondition", "CADEX isn't enabled for this department.");
  }
  const config = configSnap.data();
  if (!config.atriumBaseUrl || !config.atriumApiKey) {
    throw new HttpsError("failed-precondition", "Set The Atrium's base URL and API key first.");
  }
  return syncDepartment(deptId, config);
});

exports.cadexTestConnection = onCall(async (request) => {
  const { deptId } = request.data || {};
  if (!deptId) throw new HttpsError("invalid-argument", "deptId is required.");
  await requireDeptAdmin(request.auth, deptId);

  const configSnap = await db.doc(`departments/${deptId}/cadexConfig/settings`).get();
  const config = configSnap.exists ? configSnap.data() : null;
  if (!config || !config.atriumBaseUrl) {
    throw new HttpsError("failed-precondition", "Set The Atrium's base URL first.");
  }

  const url = `${config.atriumBaseUrl.replace(/\/$/, "")}/api/v1/status`;
  const started = Date.now();
  try {
    const resp = await fetchWithTimeout(url, {
      headers: config.atriumApiKey ? { Authorization: `Bearer ${config.atriumApiKey}` } : {}
    });
    const latencyMs = Date.now() - started;
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}`, latencyMs };
    const body = await resp.json().catch(() => null);
    return { ok: true, latencyMs, remote: body };
  } catch (err) {
    return { ok: false, error: err.message, latencyMs: Date.now() - started };
  }
});
