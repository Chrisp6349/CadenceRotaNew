// -----------------------------------------------------------------------
// department.js
// Reads and writes a department's configuration: theatres, staff,
// list-type options, and bank holidays. This is what replaces hand-
// editing config.js for each department — it's all in Firestore now,
// editable from the Administration screen.
// -----------------------------------------------------------------------

import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, limit } from "./firebase-init.js";

export async function getDepartment(deptId) {
  const snap = await getDoc(doc(db, "departments", deptId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateDepartment(deptId, fields) {
  await updateDoc(doc(db, "departments", deptId), fields);
}

// ---- Theatres -----------------------------------------------------------
export async function listTheatres(deptId) {
  const q = query(collection(db, "departments", deptId, "theatres"), orderBy("order"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveTheatre(deptId, theatreId, data) {
  await setDoc(doc(db, "departments", deptId, "theatres", theatreId), data, { merge: true });
}

export async function deleteTheatre(deptId, theatreId) {
  await deleteDoc(doc(db, "departments", deptId, "theatres", theatreId));
}

// ---- Staff (ODPs + anaesthetists) ---------------------------------------
export async function listStaff(deptId) {
  const snap = await getDocs(collection(db, "departments", deptId, "staff"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveStaff(deptId, staffId, data) {
  await setDoc(doc(db, "departments", deptId, "staff", staffId), data, { merge: true });
}

export async function deleteStaff(deptId, staffId) {
  await deleteDoc(doc(db, "departments", deptId, "staff", staffId));
}

// Convenience splits used by the rota grid. Nurses combine every
// nurse-shaped type — the three banded admin boxes (nurse_band5,
// nurse_band6, nurse_aptap) plus the legacy plain "nurse" type from
// before banding existed — into one list, since the rota's Nurse
// dropdowns don't distinguish band, just who can fill the slot.
//
// Everyone except anaesthetists/surgeons uses their rotaName ("Chris")
// over their full name ("Chris Parrish") wherever set — that's what
// actually gets shown and stored throughout the rota (grid, dashboards,
// print, corridor board), matching what admin.js collects when adding
// them. Falls back to the full name when no rotaName was given.
const NURSE_TYPES = ["nurse", "nurse_band5", "nurse_band6", "nurse_aptap"];
function displayName(s) { return s.rotaName || s.name; }
export function splitStaff(staffList) {
  return {
    odps: staffList.filter(s => s.type === "odp").map(displayName),
    anaesthetists: staffList.filter(s => s.type === "anaesthetist").map(s => s.name),
    nurses: staffList.filter(s => NURSE_TYPES.includes(s.type)).map(displayName),
    hcas: staffList.filter(s => s.type === "hca").map(displayName),
    // Isolated separately (rather than only being folded into `nurses`
    // above) so the nursing rota's on-call HCA slot can offer AP/TAPs
    // alongside actual HCAs — they still show up in every Nurse slot
    // too, via the combined `nurses` list above; this is additive, not
    // instead-of.
    aptaps: staffList.filter(s => s.type === "nurse_aptap").map(displayName),
    surgeons: staffList.filter(s => s.type === "surgeon").map(s => s.name)
  };
}

// Maps each anaesthetist's CADEX initials (set in Staff Admin, e.g. "PJ")
// to their full Cadence name — used to resolve CADEX-imported consultant
// data (The Atrium identifies anaesthetists by initials; Cadence's rota
// dropdown uses full names) to the right person automatically instead of
// just showing raw initials. Matching is case-insensitive; if two
// anaesthetists share the same initials, whichever was read last wins —
// admin.js warns on save if that would happen.
export function buildAnaesthetistInitialsMap(staffList) {
  const map = {};
  staffList
    .filter(s => s.type === "anaesthetist" && s.initials)
    .forEach(s => { map[s.initials.trim().toUpperCase()] = s.name; });
  return map;
}

// ---- Audit log ------------------------------------------------------------
// The SODP and nursing rotas log to separate collections (rota.js writes
// to "auditLog", nursing-rota.js to "nursingAuditLog" — see the header
// comment in nursing-rota.js), so both are fetched and merged here into
// one timeline, tagged with which rota each entry came from.
export async function listRecentAuditLog(deptId, count = 20) {
  const [sodpSnap, nursingSnap] = await Promise.all([
    getDocs(query(collection(db, "departments", deptId, "auditLog"), orderBy("timestamp", "desc"), limit(count))),
    getDocs(query(collection(db, "departments", deptId, "nursingAuditLog"), orderBy("timestamp", "desc"), limit(count)))
  ]);
  const entries = [
    ...sodpSnap.docs.map(d => ({ id: d.id, ...d.data(), rota: "SODP" })),
    ...nursingSnap.docs.map(d => ({ id: d.id, ...d.data(), rota: "Nursing" }))
  ];
  entries.sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
  return entries.slice(0, count);
}
