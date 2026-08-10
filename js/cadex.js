// -----------------------------------------------------------------------
// cadex.js
// Client-side access to CADEX (Cadence-Atrium Data Exchange): the
// department's connection config, live status, imported consultant data,
// and the two admin actions (manual sync / test connection) that call
// through to the Cloud Functions in functions/index.js.
//
// Mirrors department.js's read/write pattern rather than introducing a
// new one — a single doc per concern (cadexConfig/settings,
// cadexStatus/live), one doc per week for imports.
// -----------------------------------------------------------------------

import { db, doc, getDoc, setDoc, collection, addDoc, serverTimestamp, functions, httpsCallable } from "./firebase-init.js";

export async function getCadexConfig(deptId) {
  const snap = await getDoc(doc(db, "departments", deptId, "cadexConfig", "settings"));
  return snap.exists() ? snap.data() : { enabled: false, atriumBaseUrl: "", atriumApiKey: "", providerApiKey: "" };
}

const CADEX_FIELD_LABELS = {
  enabled: "Enabled",
  atriumBaseUrl: "The Atrium's base URL",
  atriumApiKey: "API key Cadence sends to The Atrium",
  providerApiKey: "API key The Atrium must send to Cadence",
  cadenceBaseUrl: "Cadence's own base URL"
};

// Keys never appear as their actual value in the audit log — this log
// is meant to answer "who changed the connection and when", not to be
// another place a secret is sitting in plain text for anyone who can
// see it later.
const SECRET_CADEX_FIELDS = ["atriumApiKey", "providerApiKey"];

function formatCadexVal(field, v) {
  if (SECRET_CADEX_FIELDS.includes(field)) return v ? "(set)" : "(empty)";
  if (v === true) return "Yes";
  if (v === false) return "No";
  return v || "(empty)";
}

function diffCadexFields(previous, next) {
  const changes = [];
  Object.keys(CADEX_FIELD_LABELS).forEach(field => {
    const oldV = previous?.[field] ?? (field === "enabled" ? false : "");
    const newV = next?.[field] ?? (field === "enabled" ? false : "");
    if (oldV === newV) return;
    changes.push({ field: CADEX_FIELD_LABELS[field], from: formatCadexVal(field, oldV), to: formatCadexVal(field, newV) });
  });
  return changes;
}

// `previous`/`uid`/`displayName` are optional — omit them (e.g. from an
// older call site) and the save still works, it just skips logging,
// same pattern as rota.js's saveWeek().
export async function saveCadexConfig(deptId, fields, uid, displayName, previous) {
  await setDoc(doc(db, "departments", deptId, "cadexConfig", "settings"), fields, { merge: true });
  if (!uid) return;
  const changes = diffCadexFields(previous, fields);
  if (!changes.length) return;
  await addDoc(collection(db, "departments", deptId, "cadexAuditLog"), {
    uid,
    displayName,
    action: "changed",
    changeCount: changes.length,
    changes,
    timestamp: serverTimestamp()
  });
}

export async function getCadexStatus(deptId) {
  const snap = await getDoc(doc(db, "departments", deptId, "cadexStatus", "live"));
  return snap.exists() ? snap.data() : { export: null, import: null };
}

// One doc per Monday-keyed week, same weekId shape as loadWeek() in
// rota.js — so a caller that already has the current week's weekId can
// look up the matching CADEX import with no extra date math.
export async function getCadexImports(deptId, weekId) {
  const snap = await getDoc(doc(db, "departments", deptId, "cadexImports", weekId));
  return snap.exists() ? snap.data() : null;
}

export async function cadexManualSync(deptId) {
  const fn = httpsCallable(functions, "cadexManualSync");
  const res = await fn({ deptId });
  return res.data;
}

export async function cadexTestConnection(deptId) {
  const fn = httpsCallable(functions, "cadexTestConnection");
  const res = await fn({ deptId });
  return res.data;
}

// Generates a long random key for either direction's API key field —
// used by the admin panel's "Generate" buttons so nobody has to invent
// their own secret.
export function generateApiKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
