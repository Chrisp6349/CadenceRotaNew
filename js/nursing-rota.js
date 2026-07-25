// -----------------------------------------------------------------------
// nursing-rota.js
// The nursing team's own rota grid — same rendering/save pattern as
// rota.js (the ODP rota), but a completely separate data model and a
// separate Firestore path, so nothing here ever touches ODP data:
//   departments/{deptId}/nursingWeeks/{weekStart}   (vs .../weeks/...)
//   departments/{deptId}/nursingAuditLog             (vs .../auditLog)
//
// Allocation keys, per day:
//   "<theatreId>_nurse1".."nurse4"   4 nurses per theatre (Mon-Fri only)
//   "<theatreId>_hca1".."hca2"       2 HCAs per theatre (Mon-Fri only)
//   "<theatreId>_surgeon"            1 surgeon per theatre (Mon-Fri only)
//   "<theatreId>_list"               nursing list type (dept.nursingListOptions)
//   "support_nurse1".."nurse2"       support column, Mon-Fri
//   "support_hca1".."hca2"           support column, Mon-Fri
//   "coordinator"                    one nurse, Mon-Fri, free pick (never restricted)
//   "oncall_nurse1".."nurse3"        on call, every day (Mon-Sun)
//   "oncall_hca"                     on call, every day (Mon-Sun)
//   "wl_nurse1".."nurse3"            weekend waiting list, Sat-Sun only
//   "wl_hca"                         weekend waiting list, Sat-Sun only
//   "wl_surgeon"                     weekend waiting list, Sat-Sun only
//
// Mutual exclusion matches the ODP rota's established rule: a nurse/HCA
// picked in a theatre is hidden from that day's other theatres AND the
// support column (and vice versa) so nobody is double-booked. On call
// and the weekend waiting list are deliberately NOT restricted — same
// as the ODP rota's on call, they always show everyone, since on-call
// is a separate commitment rather than a same-day placement. The
// coordinator is a free pick from all nurses regardless of any other
// allocation that day. Surgeons are mutually exclusive across theatres
// on the same day (like anaesthetists on the ODP rota) but not
// restricted against the weekend waiting list surgeon.
// -----------------------------------------------------------------------

import { db, doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "./firebase-init.js";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const WEEKENDS = ["Saturday", "Sunday"];

function suffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return n + "th";
  switch (n % 10) { case 1: return n + "st"; case 2: return n + "nd"; case 3: return n + "rd"; default: return n + "th"; }
}

function isoPlusDays(mondayIso, i) {
  let d = new Date(mondayIso);
  d.setDate(d.getDate() + i);
  return d.toISOString().split("T")[0];
}

// ---- Firestore read/write ------------------------------------------------
export async function loadNursingWeek(deptId, weekStart) {
  const snap = await getDoc(doc(db, "departments", deptId, "nursingWeeks", weekStart));
  return snap.exists() ? snap.data() : { data: {}, published: false };
}

function describeField(day, suffix, theatres) {
  let m = suffix.match(/^(.+)_nurse([1-4])$/);
  if (m) {
    if (m[1] === "oncall") return `${day} On call Nurse ${m[2]}`;
    if (m[1] === "wl") return `${day} Weekend waiting list Nurse ${m[2]}`;
    if (m[1] === "support") return `${day} Support Nurse ${m[2]}`;
    const t = theatres.find(x => x.id === m[1]);
    if (t) return `${day} ${t.name} Nurse ${m[2]}`;
  }
  m = suffix.match(/^(.+)_hca([12])?$/);
  if (m) {
    const label = m[2] ? `HCA ${m[2]}` : "HCA";
    if (m[1] === "oncall") return `${day} On call ${label}`;
    if (m[1] === "wl") return `${day} Weekend waiting list ${label}`;
    if (m[1] === "support") return `${day} Support ${label}`;
    const t = theatres.find(x => x.id === m[1]);
    if (t) return `${day} ${t.name} ${label}`;
  }
  m = suffix.match(/^(.+)_surgeon$/);
  if (m) {
    if (m[1] === "wl") return `${day} Weekend waiting list Surgeon`;
    const t = theatres.find(x => x.id === m[1]);
    if (t) return `${day} ${t.name} Surgeon`;
  }
  m = suffix.match(/^(.+)_list$/);
  if (m) {
    const t = theatres.find(x => x.id === m[1]);
    if (t) return `${day} ${t.name} list type`;
  }
  if (suffix === "coordinator") return `${day} Coordinator`;
  return `${day} ${suffix}`;
}

function formatVal(v) {
  if (v === true) return "Yes";
  if (!v) return "";
  return String(v);
}

function diffRota(oldData, newData, theatres) {
  const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  const changes = [];
  keys.forEach(k => {
    const oldV = oldData?.[k], newV = newData?.[k];
    if (formatVal(oldV) === formatVal(newV)) return;
    const m = k.match(/^([A-Za-z]+)_(.+)$/);
    if (!m) return;
    changes.push({ field: describeField(m[1], m[2], theatres), from: formatVal(oldV), to: formatVal(newV) });
  });
  return changes;
}

export async function saveNursingWeek(deptId, weekStart, data, publish, uid, theatres = [], displayName = "") {
  const ref = doc(db, "departments", deptId, "nursingWeeks", weekStart);
  const prevSnap = await getDoc(ref);
  const prevData = prevSnap.exists() ? (prevSnap.data().data || {}) : {};

  await setDoc(ref, {
    data,
    published: !!publish,
    updatedAt: new Date().toISOString(),
    updatedBy: uid
  }, { merge: true });

  if (!theatres.length) return;
  const changes = diffRota(prevData, data, theatres);
  if (!changes.length) return;

  await addDoc(collection(db, "departments", deptId, "nursingAuditLog"), {
    weekStart,
    uid,
    displayName,
    action: publish ? "published" : "saved a draft of",
    changeCount: changes.length,
    changes: changes.slice(0, 20),
    truncated: changes.length > 20,
    timestamp: serverTimestamp()
  });
}

// ---- Grid rendering --------------------------------------------------------
// `dept`   = department doc (nursingListOptions, bankHolidays — shared
//            with the ODP rota since bank holidays are dept-wide)
// `theatres` = [{id, name}, ...] in display order (shared theatre list)
// `staff`  = { nurses: [...], hcas: [...], surgeons: [...] }
// `rota`   = the flat key/value object for the week (nursing's own)
// `editable` = true for editor/admin, false for viewer
export function renderNursingGrid({ weekStart, dept, theatres, staff, rota, editable }) {
  // Theatre + support placements only — deliberately excludes on call,
  // the weekend waiting list, list types, and the coordinator, which
  // all stay unrestricted per the mutual-exclusion rule above.
  function used(day) {
    let n = [], h = [];
    Object.entries(rota).forEach(([k, v]) => {
      if (!k.startsWith(day + "_") || !v) return;
      if (k.includes("oncall") || k.includes("_wl_") || k.includes("_list") || k.endsWith("_coordinator")) return;
      if (k.includes("_nurse")) n.push(v);
      else if (k.includes("_hca")) h.push(v);
    });
    return { n, h };
  }

  // Surgeons: mutually exclusive across theatres the same day, but
  // this pool is kept separate from used() above since surgeons never
  // share a bucket with nurses/HCAs.
  function usedSurgeons(day) {
    let s = [];
    Object.entries(rota).forEach(([k, v]) => {
      if (!k.startsWith(day + "_") || !v) return;
      if (k.endsWith("_surgeon") && !k.includes("_wl_")) s.push(v);
    });
    return s;
  }

  function field(day, key, list, restrictKind) {
    const fkey = `${day}_${key}`;
    const current = rota[fkey] || "";
    if (!editable) {
      return current ? `<span class="ro-field">${current}</span>` : "";
    }
    let hideSet = [];
    if (restrictKind === "nurse") hideSet = used(day).n;
    if (restrictKind === "hca") hideSet = used(day).h;
    if (restrictKind === "surgeon") hideSet = usedSurgeons(day);
    let h = `<select data-key="${fkey}"><option value=""></option>`;
    [...list].sort().forEach(name => {
      const hide = hideSet.includes(name) && name !== current;
      if (!hide) h += `<option title="${name}" ${current === name ? "selected" : ""}>${name}</option>`;
    });
    h += "</select>";
    return h;
  }

  function dayLabel(i) {
    const ds = isoPlusDays(weekStart, i);
    const d = new Date(ds);
    let txt = `${["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][i]} ${suffix(d.getDate())}`;
    if (dept.bankHolidays && dept.bankHolidays[ds]) txt += `<br><span class="bh">BANK HOLIDAY</span>`;
    return txt;
  }

  function isToday(i) {
    return isoPlusDays(weekStart, i) === new Date().toISOString().split("T")[0];
  }

  function theatreCell(day, theatreId) {
    return field(day, `${theatreId}_nurse1`, staff.nurses, "nurse")
      + field(day, `${theatreId}_nurse2`, staff.nurses, "nurse")
      + field(day, `${theatreId}_nurse3`, staff.nurses, "nurse")
      + field(day, `${theatreId}_nurse4`, staff.nurses, "nurse")
      + field(day, `${theatreId}_hca1`, staff.hcas, "hca")
      + field(day, `${theatreId}_hca2`, staff.hcas, "hca")
      + field(day, `${theatreId}_surgeon`, staff.surgeons, "surgeon")
      + field(day, `${theatreId}_list`, dept.nursingListOptions || [], null);
  }

  const theatreCols = theatres.map(t => `<th class="theatre-col">${t.name}</th>`).join("");

  let h = `<table class="rota-table"><tr><th>Day</th>${theatreCols}<th class="support-col">Support</th><th class="oncall-col">On Call</th><th>Coordinator</th></tr>`;
  WEEKDAYS.forEach((d, i) => {
    const cells = theatres.map(t => `<td>${theatreCell(d, t.id)}</td>`).join("");
    h += `<tr${isToday(i) ? " class='today'" : ""}><td class="daycell">${dayLabel(i)}</td>${cells}<td>
        ${field(d, "support_nurse1", staff.nurses, "nurse")}
        ${field(d, "support_nurse2", staff.nurses, "nurse")}
        ${field(d, "support_hca1", staff.hcas, "hca")}
        ${field(d, "support_hca2", staff.hcas, "hca")}
      </td><td>
        ${field(d, "oncall_nurse1", staff.nurses, null)}
        ${field(d, "oncall_nurse2", staff.nurses, null)}
        ${field(d, "oncall_nurse3", staff.nurses, null)}
        ${field(d, "oncall_hca", staff.hcas, null)}
      </td><td>
        ${field(d, "coordinator", staff.nurses, null)}
      </td></tr>`;
  });
  h += "</table>";

  let w = `<table class="rota-table weekend-table"><tr><th>Day</th><th>On Call</th><th>Weekend Waiting List</th></tr>`;
  WEEKENDS.forEach((d, i) => {
    w += `<tr${isToday(i + 5) ? " class='today'" : ""}><td class="daycell">${dayLabel(i + 5)}</td>
      <td>${field(d, "oncall_nurse1", staff.nurses, null)}
          ${field(d, "oncall_nurse2", staff.nurses, null)}
          ${field(d, "oncall_nurse3", staff.nurses, null)}
          ${field(d, "oncall_hca", staff.hcas, null)}</td>
      <td>${field(d, "wl_nurse1", staff.nurses, null)}
          ${field(d, "wl_nurse2", staff.nurses, null)}
          ${field(d, "wl_nurse3", staff.nurses, null)}
          ${field(d, "wl_hca", staff.hcas, null)}
          ${field(d, "wl_surgeon", staff.surgeons, null)}</td>
    </tr>`;
  });
  w += "</table>";

  return { weekdayHtml: h, weekendHtml: w };
}

export function attachNursingChangeHandlers(container, rota, onChange) {
  if (!container) return;
  container.querySelectorAll("select[data-key]").forEach(sel => {
    sel.addEventListener("change", () => {
      rota[sel.dataset.key] = sel.value;
      onChange && onChange();
    });
  });
}

export { WEEKDAYS, WEEKENDS };
