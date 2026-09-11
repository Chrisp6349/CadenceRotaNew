// -----------------------------------------------------------------------
// healthroster-import.js
// Reads a "Work Roster (4 weeks)" export from Allocate HealthRoster/Loop
// (an .xlsx file the user downloads and uploads themselves — nothing
// here ever logs into HealthRoster or fetches anything from it) and
// turns it into per-day availability data, so the SODP rota can flag
// "this person is on leave/off/unavailable" while you're allocating.
//
// The exported file is a print-layout spreadsheet (merged cells for the
// date headers, a multi-row block per person so a busy day can stack
// several lines — a shift time plus an on-call note, say). Parsing it
// is inherently tied to that specific report's layout; if Allocate ever
// changes it, this will need re-checking against a fresh sample.
// -----------------------------------------------------------------------

import { db, doc, getDoc, setDoc } from "./firebase-init.js";

const STATUS_LABELS = { leave: "A/L", unavailable: "Unavailable" };
// Only these statuses are worth flagging in the rota — "available" and
// "unknown" (a blank cell — HealthRoster simply has nothing recorded)
// both mean "no reason not to pick them".
export const FLAGGED_STATUSES = Object.keys(STATUS_LABELS);
export function statusLabel(status) { return STATUS_LABELS[status] || status; }

function addDaysIso(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function mondayOf(iso) {
  const d = new Date(iso + "T00:00:00");
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
function weekdayName(iso) {
  const d = new Date(iso + "T00:00:00");
  return WEEKDAY_NAMES[(d.getDay() + 6) % 7];
}

function cellStr(ws, addr) {
  const c = ws[addr];
  if (!c) return "";
  const v = c.w != null ? c.w : c.v;
  return v == null ? "" : String(v).trim();
}
function colLetter(n) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function classifyDay(values) {
  if (values.includes("A/L")) return "leave";
  if (values.includes("Unavailable")) return "unavailable";
  const shiftRe = /^\d{1,2}:?\d{2}\s*-\s*\d{1,2}:?\d{2}$/;
  // A real shift time wins regardless of what else is stacked in the
  // same cell — e.g. a normal working day that's also flagged OC is
  // still a normal working day.
  if (values.some(v => shiftRe.test(v))) return "available";
  // OC/WEOC with no separate shift time means they're on standby, not
  // necessarily in the building — not the same as a confirmed working
  // day, so this must never count as "available" for the SODP list.
  // It's also not "leave" or "unavailable" — they're not off, so this
  // stays unflagged in the rota's dropdowns too, just excluded from
  // the positive "who's actually in today" list.
  if (values.includes("OC") || values.includes("WEOC")) return "oncall";
  if (values.length) return "other"; // an unrecognised token — surfaced, never silently dropped
  return "unknown";
}

// workbook: the object returned by XLSX.read()/readFile() (window.XLSX,
// loaded via js/vendor/xlsx.full.min.js).
export function parseWorkbook(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws || !ws["!ref"]) throw new Error("Couldn't find a sheet to read in that file.");
  const range = window.XLSX.utils.decode_range(ws["!ref"]);

  let startDate = null;
  for (let r = range.s.r; r <= range.e.r && !startDate; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (cellStr(ws, colLetter(c + 1) + (r + 1)) !== "Start Date:") continue;
      for (let c2 = c + 1; c2 <= range.e.c; c2++) {
        const v2 = cellStr(ws, colLetter(c2 + 1) + (r + 1));
        const m = v2.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) { startDate = `${m[3]}-${m[2]}-${m[1]}`; break; }
      }
      break;
    }
  }
  if (!startDate) throw new Error("Couldn't find a \"Start Date:\" cell in that file — is this the right report?");

  let dateRow = null, dateCols = [];
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 15); r++) {
    const found = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (/^([1-9]|[12]\d|3[01])$/.test(cellStr(ws, colLetter(c + 1) + (r + 1)))) found.push(c);
    }
    if (found.length >= 20) { dateRow = r; dateCols = found; break; }
  }
  if (dateRow == null) throw new Error("Couldn't find the row of day-of-month numbers — is this the right report?");

  const dateByCol = {};
  dateCols.forEach((c, i) => { dateByCol[c] = addDaysIso(startDate, i); });
  const orderedDates = dateCols.map((c, i) => addDaysIso(startDate, i));

  const people = [];
  for (let r = dateRow + 1; r <= range.e.r; r++) {
    const v = cellStr(ws, "A" + (r + 1));
    const m = v.match(/^([A-Za-z]+)\s*-\s*(.+),\s*(.+)$/);
    if (m) people.push({ row: r, role: m[1], hrName: v, lastName: m[2].trim(), firstName: m[3].trim() });
  }
  if (!people.length) throw new Error("Couldn't find any staff rows (expected e.g. \"ODP - Smith, Jane\") — is this the right report?");

  // The last person's block would otherwise run to the very end of the
  // sheet, pulling the "SIGNED: / DATE:" footer in as if it were data.
  let footerRow = range.e.r + 1;
  for (let r = people[people.length - 1].row + 1; r <= range.e.r; r++) {
    if (/^SIGNED/i.test(cellStr(ws, "A" + (r + 1)))) { footerRow = r; break; }
  }
  people.forEach((p, i) => { p.rowEnd = (i + 1 < people.length ? people[i + 1].row : footerRow) - 1; });

  people.forEach(p => {
    p.days = {};
    dateCols.forEach(c => {
      const values = [];
      for (let r = p.row; r <= p.rowEnd; r++) {
        const v = cellStr(ws, colLetter(c + 1) + (r + 1));
        if (v) values.push(v);
      }
      p.days[dateByCol[c]] = { status: classifyDay(values), raw: values };
    });
    delete p.row; delete p.rowEnd;
  });

  return { startDate, endDate: orderedDates[orderedDates.length - 1], dates: orderedDates, people };
}

// Best-guess match against the department's own staff list — compares
// "First Last" (built from the export's "Last, First" name) against
// each staff member's display name (rotaName-or-name, same convention
// staff.html/rota.js use) and their full name, case-insensitively.
// Never auto-applies silently — the caller always shows this as a
// pre-filled but editable suggestion, since a wrong match here would
// flag the wrong person's leave against someone else's name.
export function suggestStaffMatch(person, staffList) {
  const full = `${person.firstName} ${person.lastName}`.toLowerCase();
  const eligible = staffList.filter(s => ["odp", "anaesthetist", "nurse", "nurse_band5", "nurse_band6", "nurse_aptap", "hca", "surgeon"].includes(s.type));
  return eligible.find(s => {
    const shown = (s.rotaName || s.name || "").toLowerCase();
    const name = (s.name || "").toLowerCase();
    return shown === full || name === full;
  }) || null;
}

// Splits the parsed 4-week span into one data object per Monday-
// anchored week, keyed by day name (matching the rota's own convention)
// then by the CADENCE display name chosen for each person (not the
// HealthRoster name) — nameByHrName: { hrName: cadenceDisplayName }.
// A person mapped to "" (skipped in the review step) is left out
// entirely rather than saved under their HealthRoster name.
//
// Every recognised status is stored, including "available" — not just
// the flagged ones. The rota's "Available SODPs" list under each day
// needs to tell "confirmed working that day" apart from "HealthRoster
// simply has no record for them that day" (status "unknown"), and only
// the former belongs in that list — "unknown" and the rare "other"
// (an unrecognised token) are left out entirely rather than guessed at.
// `oncallSODPs` (an array, stored alongside the per-name status entries
// under a reserved key that could never collide with a real display
// name) is who's flagged OC/WEOC that day, independent of the day's
// overall status — someone can be on a normal shift AND on-call the
// same day (status "available", OC just an extra note), and they still
// belong in this list. On leave/unavailable overrides it either way:
// a day marked A/L is never someone's on-call day regardless of what
// else is stacked in the same cell.
export function buildWeeklyDocs(parsed, nameByHrName) {
  const byWeek = {};
  parsed.dates.forEach(iso => {
    const week = mondayOf(iso);
    const day = weekdayName(iso);
    if (!byWeek[week]) byWeek[week] = {};
    if (!byWeek[week][day]) byWeek[week][day] = {};
    const oncallSODPs = [];
    parsed.people.forEach(p => {
      const cadenceName = nameByHrName[p.hrName];
      if (!cadenceName) return;
      const dayInfo = p.days[iso];
      const status = dayInfo?.status;
      if (status && status !== "unknown" && status !== "other") byWeek[week][day][cadenceName] = status;
      const flaggedOnCall = dayInfo && (dayInfo.raw.includes("OC") || dayInfo.raw.includes("WEOC"));
      if (flaggedOnCall && status !== "leave" && status !== "unavailable") oncallSODPs.push(cadenceName);
    });
    if (oncallSODPs.length) byWeek[week][day].oncallSODPs = oncallSODPs;
  });
  return Object.entries(byWeek).map(([weekStart, data]) => ({ weekStart, data }));
}

export async function saveAvailabilityWeeks(deptId, weeklyDocs, uploadedBy) {
  for (const { weekStart, data } of weeklyDocs) {
    await setDoc(doc(db, "departments", deptId, "availability", weekStart), {
      data, uploadedBy: uploadedBy || "", uploadedAt: new Date().toISOString(), source: "healthroster"
    });
  }
}

// Returns { Monday: { "Rebecca Brown": "leave", ... }, Tuesday: {...}, ... }
// or {} if nothing's been uploaded for this week.
export async function loadAvailability(deptId, weekStart) {
  const snap = await getDoc(doc(db, "departments", deptId, "availability", weekStart));
  return snap.exists() ? (snap.data().data || {}) : {};
}
