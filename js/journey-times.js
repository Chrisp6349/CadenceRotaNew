// -----------------------------------------------------------------------
// journey-times.js
// Reads the weekly "Send and Start times" export (an .xlsx someone
// downloads and uploads themselves — nothing here fetches anything on
// its own) and turns it into the per-case journey durations the Journey
// Times report displays: Sent→Arrived, Started→Into theatre, and
// Into theatre→Knife to skin.
//
// The sheet is a print-style log: a "W/C DD/MM/YYYY" header, then one
// section per weekday, then one row per theatre per patient under that
// day, with Sent/Arrived/Started/Into Theatre/Knife to skin/End/Out
// columns typed as plain decimals (8.15 means 8:15, not 8.15 hours —
// see to_minutes() below) plus surgeon/anaesthetist initials and a
// free-text reasons column used for delays and cancellations.
// -----------------------------------------------------------------------

import { db, doc, getDoc, setDoc } from "./firebase-init.js";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SET = new Set(DAY_NAMES.map(d => d.toLowerCase()));

// "8.15" -> 495 (8h 15m in minutes since midnight). The decimal digits
// ARE the minutes, not a fraction of an hour — this is how the source
// spreadsheet types times, confirmed against its own "0.00" cell format
// (a plain number, not a real Excel time value).
function toMinutes(v) {
  if (v == null || typeof v !== "number") return null;
  const hour = Math.trunc(v);
  const minute = Math.round((v - hour) * 100);
  if (minute >= 60 || minute < 0 || hour < 0 || hour > 23) return null;
  return hour * 60 + minute;
}

function fmtHm(mins) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function cellVal(ws, r, c) {
  const addr = window.XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  return cell ? cell.v : undefined;
}

// workbook: the object from XLSX.read() (window.XLSX, loaded via
// js/vendor/xlsx.full.min.js — same vendored copy the HealthRoster
// import already uses).
export function parseWorkbook(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws || !ws["!ref"]) throw new Error("Couldn't find a sheet to read in that file.");
  const range = window.XLSX.utils.decode_range(ws["!ref"]);

  let week = null;
  const weekCell = cellVal(ws, range.s.r, range.s.c);
  if (typeof weekCell === "string" && /W\/?C/i.test(weekCell)) week = weekCell.trim();
  if (!week) throw new Error("Couldn't find the \"W/C\" week header in cell A1 — is this the right report?");

  const cases = [];
  let currentDay = null;
  for (let r = range.s.r; r <= range.e.r; r++) {
    const a = cellVal(ws, r, 0);
    if (typeof a === "string" && DAY_SET.has(a.trim().toLowerCase())) {
      currentDay = DAY_NAMES.find(d => d.toLowerCase() === a.trim().toLowerCase());
      continue;
    }
    const theatre = cellVal(ws, r, 0);
    const patient = cellVal(ws, r, 1);
    if (!theatre || !patient || !currentDay) continue;
    // TAVI cases are excluded from this report entirely, on request —
    // filtered out here at parse time (not just hidden in the UI) so
    // they never reach the averages or leaderboards either.
    if (/^tavi\b/i.test(String(theatre).trim())) continue;

    const raw = {
      sent: cellVal(ws, r, 2), arrived: cellVal(ws, r, 3), started: cellVal(ws, r, 4),
      into_theatre: cellVal(ws, r, 5), knife: cellVal(ws, r, 6), end: cellVal(ws, r, 7), out: cellVal(ws, r, 8)
    };
    const mins = {};
    Object.keys(raw).forEach(k => { mins[k] = toMinutes(raw[k]); });
    const cancelled = Object.values(mins).every(v => v == null);
    const surg = cellVal(ws, r, 9);
    const anaes = cellVal(ws, r, 10);
    const reason = cellVal(ws, r, 11);

    function delta(a_key, b_key) {
      const ma = mins[a_key], mb = mins[b_key];
      return (ma == null || mb == null) ? null : mb - ma;
    }

    cases.push({
      day: currentDay, theatre: String(theatre).trim(), patient: String(patient).trim(),
      sent: fmtHm(mins.sent), arrived: fmtHm(mins.arrived), started: fmtHm(mins.started),
      into: fmtHm(mins.into_theatre), knife: fmtHm(mins.knife),
      surg: surg != null ? String(surg).trim() : "", anaes: anaes != null ? String(anaes).trim() : "",
      reason: reason != null ? String(reason).trim() : "", cancelled,
      d_sa: delta("sent", "arrived"), d_si: delta("started", "into_theatre"), d_ik: delta("into_theatre", "knife")
    });
  }
  if (!cases.length) throw new Error("Couldn't find any case rows (expected a theatre in column A and a patient in column B) — is this the right report?");

  return { week, cases };
}

function percentile(vals, p) {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const k = (s.length - 1) * p, f = Math.floor(k), c = Math.min(f + 1, s.length - 1);
  return f === c ? s[f] : s[f] + (s[c] - s[f]) * (k - f);
}
function round1(n) { return Math.round(n * 10) / 10; }

// Headline stats exclude negative durations (the later timestamp came
// before the earlier one in the source — a data-entry issue, not a real
// duration) so one impossible number can't skew the average; those
// cases are still shown individually, flagged, never dropped from the
// case list itself. See journey-times.html's per-case table.
function metricStats(cases, key) {
  const clean = cases.map(c => c[key]).filter(v => v != null && v >= 0);
  const anomalies = cases.filter(c => c[key] != null && c[key] < 0).length;
  if (!clean.length) return { n: 0, mean: null, median: null, min: null, max: null, p75: null, anomaly_count: anomalies };
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
  const sorted = [...clean].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    n: clean.length, mean: round1(mean), median: round1(median),
    min: Math.min(...clean), max: Math.max(...clean),
    p75: round1(percentile(clean, 0.75)), anomaly_count: anomalies
  };
}

export function buildWeekPayload(parsed) {
  const summary = {
    sent_arrived: metricStats(parsed.cases, "d_sa"),
    started_into: metricStats(parsed.cases, "d_si"),
    into_knife: metricStats(parsed.cases, "d_ik")
  };
  const completed = parsed.cases.filter(c => !c.cancelled).length;
  const cancelled = parsed.cases.length - completed;
  return {
    week: parsed.week, cases: parsed.cases, summary,
    totals: { completed, cancelled, total: parsed.cases.length }
  };
}

// weekStart: the Monday (YYYY-MM-DD) this report belongs to — same
// week-keying convention as the rota (js/rota.js's loadWeek/saveWeek),
// so this and the rota naturally line up week-for-week.
export async function saveJourneyWeek(deptId, weekStart, payload, uploadedBy) {
  await setDoc(doc(db, "departments", deptId, "journeyTimes", weekStart), {
    ...payload, uploadedBy: uploadedBy || "", uploadedAt: new Date().toISOString()
  });
}

export async function loadJourneyWeek(deptId, weekStart) {
  const snap = await getDoc(doc(db, "departments", deptId, "journeyTimes", weekStart));
  return snap.exists() ? snap.data() : null;
}

// "W/C 07/09/2026" -> "2026-09-01" (that date's own Monday, in case the
// sheet's W/C date is ever typed as a mid-week date by mistake) — same
// Monday-anchored week-keying convention rota.js's own mondayOf() uses,
// so a week's journey-times data and its rota naturally line up.
export function weekStartFromHeader(weekText) {
  const m = (weekText || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const shift = (d.getDay() + 6) % 7; // Monday=0 .. Sunday=6
  d.setDate(d.getDate() - shift);
  const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}
