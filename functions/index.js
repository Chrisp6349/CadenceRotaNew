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

const { buildOdpExport, buildSurgeonsExport, mapAtriumConsultants } = require("./cadex-mapping");

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
async function departmentForProviderKey(apiKey) {
  if (!apiKey) return null;
  const snap = await db.collectionGroup("cadexConfig")
    .where("providerApiKey", "==", apiKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const configDoc = snap.docs[0];
  if (configDoc.id !== "settings" || !configDoc.data().enabled) return null;
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
      const nursingSnap = await db.doc(`departments/${deptId}/nursingWeeks/${weekId}`).get();
      const payload = buildSurgeonsExport(weekId, nursingSnap.exists ? nursingSnap.data() : null);
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

// ---- Consumer: pull The Atrium's consultant data for one department ---
// Never writes into departments/{deptId}/weeks/{weekId}.data (the
// editable rota) — only into cadexImports, a read-only projection the
// client displays alongside the grid and can choose to apply (guiding
// principles 7 and 9: imported data is clearly identifiable, and never
// silently replaces something a person already entered).
async function syncDepartment(deptId, config) {
  const weekId = mondayOf();
  const url = `${config.atriumBaseUrl.replace(/\/$/, "")}/api/v1/consultants?week=${weekId}`;
  const statusRef = db.doc(`departments/${deptId}/cadexStatus/live`);

  let resp;
  try {
    resp = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${config.atriumApiKey}`, Accept: "application/json" }
    });
  } catch (err) {
    await statusRef.set({ import: {
      lastFailureAt: admin.firestore.FieldValue.serverTimestamp(),
      lastImportOk: false,
      lastError: `network error: ${err.message}`
    } }, { merge: true });
    return { ok: false, error: err.message };
  }

  if (!resp.ok) {
    const error = `Atrium returned HTTP ${resp.status}`;
    await statusRef.set({ import: {
      lastFailureAt: admin.firestore.FieldValue.serverTimestamp(),
      lastImportOk: false,
      lastError: error
    } }, { merge: true });
    return { ok: false, error };
  }

  let payload;
  try {
    payload = await resp.json();
  } catch (err) {
    const error = "invalid JSON from Atrium";
    await statusRef.set({ import: {
      lastFailureAt: admin.firestore.FieldValue.serverTimestamp(),
      lastImportOk: false,
      lastError: error
    } }, { merge: true });
    return { ok: false, error };
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

  await statusRef.set({ import: {
    lastImportAt: admin.firestore.FieldValue.serverTimestamp(),
    lastImportOk: true,
    lastError: null
  } }, { merge: true });

  return { ok: true, weekId: receivedWeekId };
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
