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

import { db, doc, getDoc, setDoc, functions, httpsCallable } from "./firebase-init.js";

export async function getCadexConfig(deptId) {
  const snap = await getDoc(doc(db, "departments", deptId, "cadexConfig", "settings"));
  return snap.exists() ? snap.data() : { enabled: false, atriumBaseUrl: "", atriumApiKey: "", providerApiKey: "" };
}

export async function saveCadexConfig(deptId, fields) {
  await setDoc(doc(db, "departments", deptId, "cadexConfig", "settings"), fields, { merge: true });
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
