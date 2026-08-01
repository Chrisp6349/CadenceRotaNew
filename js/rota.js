// -----------------------------------------------------------------------
// rota.js
// The merged core: one grid, driven by the department's own theatre
// list, that renders editable (dropdowns) for editors/admins and
// read-only (plain text) for viewers. This replaces the separate
// Rota Manager (edit) and Rota Viewer (read-only) apps.
//
// Allocation keys keep the old flat-key shape so the data model stays
// familiar: "<Day>_<theatreId>_odp1", "<Day>_support1", "<Day>_oncall_odp"
// etc. — but theatreId now comes from the department's own configurable
// theatre list instead of being hardcoded (t1/t2/t4/t5/cath).
// -----------------------------------------------------------------------

import { db, doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "./firebase-init.js";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const WEEKENDS = ["Saturday", "Sunday"];

export function mondayOfCurrentWeek() {
  let d = new Date();
  let day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().split("T")[0];
}

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
export async function loadWeek(deptId, weekStart) {
  const snap = await getDoc(doc(db, "departments", deptId, "weeks", weekStart));
  return snap.exists() ? snap.data() : { data: {}, published: false };
}

// Turns a "<Day>_<suffix>" key into a human-readable field name for the
// audit log — same key-shape knowledge as insights.js's classify(), but
// covering every field (list types, sessions, from-home) since all of
// them matter for an audit trail, not just person placements.
function describeField(day, suffix, theatres) {
  let m = suffix.match(/^(.+)_odp([12])$/);
  if (m) {
    const t = theatres.find(x => x.id === m[1]);
    if (t) return `${day} ${t.name} ODP${m[2]}`;
  }
  m = suffix.match(/^(.+)_anaes$/);
  if (m) {
    if (m[1] === "oncall") return `${day} On call Anaesthetist`;
    if (m[1] === "wl") return `${day} Weekend waiting list Anaesthetist`;
    const t = theatres.find(x => x.id === m[1]);
    if (t) return `${day} ${t.name} Anaesthetist`;
  }
  m = suffix.match(/^(.+)_list$/);
  if (m) {
    if (m[1] === "support") return `${day} Support list type`;
    const t = theatres.find(x => x.id === m[1]);
    if (t) return `${day} ${t.name} list type`;
  }
  if (/^support[123]$/.test(suffix)) return `${day} Support ${suffix.slice(-1)}`;
  if (suffix === "oncall_odp") return `${day} On call ODP`;
  if (suffix === "oncall_extra") return `${day} On call extra`;
  if (suffix === "oncall_home") return `${day} On call — from home`;
  if (suffix === "oncall_odp1" || suffix === "oncall_odp2") return `${day} On call ODP ${suffix.slice(-1)}`;
  if (suffix === "oncall_session1" || suffix === "oncall_session2") return `${day} On call session ${suffix.slice(-1)}`;
  if (suffix === "wl_odp") return `${day} Weekend waiting list ODP`;
  return `${day} ${suffix}`;
}

function formatVal(v) {
  if (v === true) return "Yes";
  if (!v) return "";
  return String(v);
}

// Diffs the previous saved version against the new one, field by field,
// for the audit log. Booleans (the from-home checkbox) and strings are
// both handled — anything falsy on either side is treated as "empty".
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

// `theatres` and `displayName` are only used to build a readable audit
// log entry — omit them (e.g. from older call sites) and saving still
// works, it just skips logging.
export async function saveWeek(deptId, weekStart, data, publish, uid, theatres = [], displayName = "") {
  const ref = doc(db, "departments", deptId, "weeks", weekStart);
  const prevSnap = await getDoc(ref);
  const prevData = prevSnap.exists() ? (prevSnap.data().data || {}) : {};

  await setDoc(ref, {
    data,
    published: !!publish,
    updatedAt: new Date().toISOString(),
    updatedBy: uid
  }, { merge: true });

  if (!theatres.length) return; // no theatre list passed in — can't describe fields, skip logging
  const changes = diffRota(prevData, data, theatres);
  if (!changes.length) return;

  await addDoc(collection(db, "departments", deptId, "auditLog"), {
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

// A CADEX-imported value that hasn't been applied to the local field yet
// shows as a small badge with an Apply button (editors/admins only) —
// never written into `rota` automatically, so an import can never
// silently overwrite something a person already typed in (see the CADEX
// proposal, guiding principle 9). Once applied, or once the local value
// already matches what The Atrium sent, the badge just confirms a match.
function cadexBadge(fkey, importedVal, currentVal, editable) {
  if (!importedVal) return "";
  if (importedVal === currentVal) {
    return `<span class="cadex-badge cadex-match" title="Matches The Atrium">CADEX ✓</span>`;
  }
  const applyBtn = editable
    ? `<button type="button" class="cadex-apply" data-apply-key="${fkey}" data-apply-value="${importedVal}">Apply</button>`
    : "";
  return `<span class="cadex-badge" title="Imported from The Atrium, not yet applied here">CADEX: ${importedVal}${applyBtn}</span>`;
}

// CICU has no equivalent field in Cadence's own rota — it's purely a
// read-only import from The Atrium, shown alongside on-call info rather
// than tied to any editable box.
function cicuReadout(cicuVal) {
  return cicuVal ? `<span class="cadex-badge cadex-readonly" title="CICU consultant, from The Atrium">CICU (CADEX): ${cicuVal}</span>` : "";
}

// ---- Grid rendering --------------------------------------------------------
// `dept`   = department doc (listOptions, extraOnCall, bankHolidays)
// `theatres` = [{id, name}, ...] in display order
// `staff`  = { odps: [...], anaesthetists: [...] }
// `rota`   = the flat key/value object for the week
// `editable` = true for editor/admin, false for viewer
// `cadex`  = optional CADEX imports, keyed by lowercase day, e.g.
//            { monday: { "Theatre 1": "PJ", "On Call": "NM", "CICU": "VR" }, ... }
//            (see functions/cadex-mapping.js mapAtriumConsultants()) — omit
//            or pass null/undefined when there's no import yet.
export function renderGrid({ weekStart, dept, theatres, staff, rota, editable, onChange, cadex }) {
  function used(day) {
    let o = [], a = [];
    Object.entries(rota).forEach(([k, v]) => {
      if (!k.startsWith(day + "_") || !v || k.includes("oncall") || k.includes("_list")) return;
      k.includes("_anaes") ? a.push(v) : o.push(v);
    });
    return { o, a };
  }

  function field(day, key, list, type, restricted = true, placeholder) {
    const fkey = `${day}_${key}`;
    const current = rota[fkey] || "";
    if (!editable) {
      return `<span class="ro-field">${current}</span>`;
    }
    const u = used(day);
    // The blank option shows the role name (e.g. "ODP", "Anaesthetist")
    // instead of being empty, so whoever's filling in the rota can tell
    // what each box is for before they've picked anyone.
       let h = `<select data-key="${fkey}" class="${current ? "" : "is-placeholder"}"><option value="">${placeholder || ""}</option>`;

    [...list].sort().forEach(n => {
      let hide = false;
      if (restricted) {
        if (type === "odp") hide = u.o.includes(n) && n !== current;
        if (type === "anaes") hide = u.a.includes(n) && n !== current;
      }
      if (!hide) h += `<option title="${n}" ${current === n ? "selected" : ""}>${n}</option>`;
    });
    // A saved value that isn't in the department's own staff list — most
    // often a name just applied from a CADEX import (see cadexBadge()
    // below), since The Atrium's consultants aren't part of Cadence's
    // own anaesthetist list — would otherwise vanish from the dropdown
    // even though it's still the value actually saved. Keep it visible.
    if (current && !list.includes(current)) {
      h += `<option title="${current}" selected>${current}</option>`;
    }
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

  function homeCheckbox(day) {
    const fkey = `${day}_oncall_home`;
    const checked = !!rota[fkey];
    if (!editable) {
      return checked ? `<span class="home-badge">FROM HOME</span>` : "";
    }
    return `<label class="home-check"><input type="checkbox" data-key="${fkey}" data-kind="checkbox" ${checked ? "checked" : ""}> From home</label>`;
  }

  function dayCadex(day) {
    return (cadex && cadex[day.toLowerCase()]) || {};
  }

  function theatreCell(day, theatreId, theatreName) {
    const anaesKey = `${theatreId}_anaes`;
    const fkey = `${day}_${anaesKey}`;
    const imported = dayCadex(day)[theatreName];
    return field(day, `${theatreId}_odp1`, staff.odps, "odp", true, "ODP")
      + field(day, `${theatreId}_odp2`, staff.odps, "odp", true, "ODP")
      + field(day, anaesKey, staff.anaesthetists, "anaes", true, "Anaesthetist")
      + cadexBadge(fkey, imported, rota[fkey], editable)
      + field(day, `${theatreId}_list`, dept.listOptions || [], "list", false, "List type");
  }

  const theatreCols = theatres.map(t => `<th class="theatre-col">${t.name}</th>`).join("");

  let h = `<table class="rota-table"><tr><th>Day</th>${theatreCols}<th class="support-col">Support</th><th class="oncall-col">On Call</th></tr>`;
  WEEKDAYS.forEach((d, i) => {
    const cells = theatres.map(t => `<td>${theatreCell(d, t.id, t.name)}</td>`).join("");
    const onCallAnaesKey = `${d}_oncall_anaes`;
    h += `<tr${isToday(i) ? " class='today'" : ""}><td class="daycell">${dayLabel(i)}</td>${cells}<td>
        ${field(d, "support1", staff.odps, "odp", true, "ODP")}
        ${field(d, "support2", staff.odps, "odp", true, "ODP")}
        ${field(d, "support3", staff.odps, "odp", true, "ODP")}
        <br>${field(d, "support_list", dept.listOptions || [], "list", false, "List type")}
      </td><td>
        ${field(d, "oncall_odp", staff.odps, "odp", false, "ODP")}
        ${homeCheckbox(d)}
        ${field(d, "oncall_extra", dept.extraOnCall || ["", "EXTRA O/C"], "list", false, "Extra on-call")}
        ${field(d, "oncall_anaes", staff.anaesthetists, "anaes", false, "Anaesthetist")}
        ${cadexBadge(onCallAnaesKey, dayCadex(d)["On Call"], rota[onCallAnaesKey], editable)}
        ${cicuReadout(dayCadex(d)["CICU"])}
      </td></tr>`;
  });
  h += "</table>";

  let w = `<table class="rota-table weekend-table"><tr><th>Day</th><th>On Call ODP</th><th>On Call Anaesthetist</th><th>Waiting List</th></tr>`;
  WEEKENDS.forEach((d, i) => {
    const onCallAnaesKey = `${d}_oncall_anaes`;
    const wlAnaesKey = `${d}_wl_anaes`;
    w += `<tr${isToday(i + 5) ? " class='today'" : ""}><td class="daycell">${dayLabel(i + 5)}</td>
      <td>${field(d, "oncall_odp1", staff.odps, "odp", false, "ODP")}${field(d, "oncall_session1", ["ALL DAY","AM","PM"], "list", false, "Session")}<br>
          ${field(d, "oncall_odp2", staff.odps, "odp", false, "ODP")}${field(d, "oncall_session2", ["ALL DAY","AM","PM"], "list", false, "Session")}</td>
      <td>${field(d, "oncall_anaes", staff.anaesthetists, "anaes", false, "Anaesthetist")}
        ${cadexBadge(onCallAnaesKey, dayCadex(d)["On Call"], rota[onCallAnaesKey], editable)}
        ${cicuReadout(dayCadex(d)["CICU"])}
      </td>
      <td>${field(d, "wl_odp", staff.odps, "odp", false, "ODP")}${field(d, "wl_anaes", staff.anaesthetists, "anaes", false, "Anaesthetist")}
        ${cadexBadge(wlAnaesKey, dayCadex(d)["Waiting List"], rota[wlAnaesKey], editable)}
      </td>
    </tr>`;
  });
  w += "</table>";

  return { weekdayHtml: h, weekendHtml: w };
}

export function attachChangeHandlers(container, rota, onChange) {
  if (!container) return;
  container.querySelectorAll("select[data-key]").forEach(sel => {
    sel.addEventListener("change", () => {
      rota[sel.dataset.key] = sel.value;
      onChange && onChange();
    });
  });
  container.querySelectorAll("input[type=checkbox][data-key]").forEach(cb => {
    cb.addEventListener("change", () => {
      rota[cb.dataset.key] = cb.checked;
      onChange && onChange();
    });
  });
  // CADEX "Apply" buttons — copies an imported value from The Atrium
  // into the local field, same as if someone had picked it themselves.
  container.querySelectorAll("button[data-apply-key]").forEach(btn => {
    btn.addEventListener("click", () => {
      rota[btn.dataset.applyKey] = btn.dataset.applyValue;
      onChange && onChange();
    });
  });
}

export { WEEKDAYS, WEEKENDS };
