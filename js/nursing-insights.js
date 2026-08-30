// -----------------------------------------------------------------------
// nursing-insights.js
// "Theatre Intelligence" for the nursing dashboard — same idea and same
// shape as insights.js's, but built against the nursing rota's own data
// model and Firestore path (departments/{deptId}/nursingWeeks, not
// .../weeks), so it counts nurses/HCAs/surgeons/coordinators instead of
// ODPs/anaesthetists. Kept as its own module rather than sharing code
// with insights.js — same reasoning as nursing-rota.js vs rota.js: the
// two data models diverge enough (more role types, a coordinator, two
// separate on-call surgeon specialties) that a shared "generic" engine
// would need almost as much per-domain configuration as just writing it
// twice, and this way each file stays readable on its own.
//
// Same accuracy rules as the ODP version: only PUBLISHED weeks count,
// nothing after the selected week, and only days up to today within the
// current week. The weekend waiting list counts as a Theatre 5 session,
// same as the ODP side's own wl_odp/wl_anaes — it always runs there.
// -----------------------------------------------------------------------

import { db, collection, getDocs, query, where } from "./firebase-init.js";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function localIso(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isoPlusDays(mondayIso, i) {
  const d = new Date(mondayIso + "T00:00:00");
  d.setDate(d.getDate() + i);
  return localIso(d);
}

async function listPublishedNursingWeeks(deptId) {
  const q = query(collection(db, "departments", deptId, "nursingWeeks"), where("published", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ weekStart: d.id, data: d.data().data || {} }));
}

// Turns a "<theatreId>_nurse1..4" / "_hca1..2" / "_surgeon" / "coordinator"
// etc. suffix into a structured type. Weekend waiting-list slots
// (wl_nurse.../wl_hca/wl_surgeon) resolve to Theatre 5 — that's always
// where the list runs — same as the ODP side's wl_odp/wl_anaes.
function theatre5(theatres) { return theatres.find(x => x.name === "Theatre 5"); }

export function classify(suffix, theatres) {
  let m = suffix.match(/^(.+)_nurse([1-4])$/);
  if (m) {
    const key = m[1];
    if (key === "oncall") return { kind: "oncall_nurse" };
    if (key === "wl") { const t5 = theatre5(theatres); return t5 ? { kind: "theatre_nurse", theatreId: t5.id, theatreName: t5.name } : null; }
    if (key === "support") return { kind: "support_nurse" };
    const t = theatres.find(x => x.id === key);
    return t ? { kind: "theatre_nurse", theatreId: t.id, theatreName: t.name } : null;
  }
  m = suffix.match(/^(.+)_hca[12]?$/);
  if (m) {
    const key = m[1];
    if (key === "oncall") return { kind: "oncall_hca" };
    if (key === "wl") { const t5 = theatre5(theatres); return t5 ? { kind: "theatre_hca", theatreId: t5.id, theatreName: t5.name } : null; }
    if (key === "support") return { kind: "support_hca" };
    const t = theatres.find(x => x.id === key);
    return t ? { kind: "theatre_hca", theatreId: t.id, theatreName: t.name } : null;
  }
  if (suffix === "oncall_surgeon_thoracic") return { kind: "oncall_surgeon_thoracic" };
  m = suffix.match(/^(.+)_surgeon[2]?$/);
  if (m) {
    const key = m[1];
    if (key === "oncall") return { kind: "oncall_surgeon_cardiac" };
    if (key === "wl") { const t5 = theatre5(theatres); return t5 ? { kind: "theatre_surgeon", theatreId: t5.id, theatreName: t5.name } : null; }
    const t = theatres.find(x => x.id === key);
    return t ? { kind: "theatre_surgeon", theatreId: t.id, theatreName: t.name } : null;
  }
  if (suffix === "coordinator") return { kind: "coordinator" };
  return null;
}

function collectEntries(weeksData, currentWeekStart, todayIso) {
  const entries = [];
  weeksData.forEach(({ weekStart, data }) => {
    if (weekStart > currentWeekStart) return;
    ALL_DAYS.forEach((day, i) => {
      if (weekStart === currentWeekStart && isoPlusDays(weekStart, i) > todayIso) return;
      Object.entries(data).forEach(([k, v]) => {
        if (!v || !k.startsWith(day + "_")) return;
        entries.push({ weekStart, day, suffix: k.slice(day.length + 1), value: v });
      });
    });
  });
  return entries;
}

// Groups theatre_nurse/theatre_hca/theatre_surgeon entries by (week, day,
// theatre) — "a session happened here" rather than "some field happened
// to be filled in", same purpose as the ODP side's version.
export function buildSessionGroups(entries, theatres) {
  const groups = {};
  entries.forEach(({ weekStart, day, suffix, value }) => {
    const c = classify(suffix, theatres);
    if (!c || (c.kind !== "theatre_nurse" && c.kind !== "theatre_hca" && c.kind !== "theatre_surgeon")) return;
    const gk = `${weekStart}|${day}|${c.theatreId}`;
    if (!groups[gk]) groups[gk] = { weekStart, day, theatreName: c.theatreName, nurses: [], hcas: [], surgeons: [] };
    if (c.kind === "theatre_nurse") groups[gk].nurses.push(value);
    else if (c.kind === "theatre_hca") groups[gk].hcas.push(value);
    else groups[gk].surgeons.push(value);
  });
  return Object.values(groups);
}

export async function loadEligibleEntries(deptId, theatres, currentWeekStart, todayIso) {
  const weeksData = await listPublishedNursingWeeks(deptId);
  const eligibleWeeks = weeksData.filter(w => w.weekStart <= currentWeekStart);
  return { entries: collectEntries(eligibleWeeks, currentWeekStart, todayIso), weeksUsed: eligibleWeeks.length };
}

function topPick(map, minCount = 2) {
  const arr = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (!arr.length || arr[0][1] < minCount) return null;
  return { name: arr[0][0], count: arr[0][1] };
}
function bottomPick(map) {
  const arr = Object.entries(map).sort((a, b) => a[1] - b[1]);
  return arr.length ? { name: arr[0][0], count: arr[0][1] } : null;
}

function weekSessionCounts(entries, theatres, currentWeekStart) {
  const byWeek = {};
  entries.forEach((e) => {
    if (e.weekStart >= currentWeekStart) return;
    (byWeek[e.weekStart] ||= []).push(e);
  });
  const counts = {};
  Object.keys(byWeek).forEach((ws) => { counts[ws] = buildSessionGroups(byWeek[ws], theatres).length; });
  return counts;
}

function buildStats(entries, theatres, currentWeekStart) {
  const tallies = {
    oncall_nurse: {}, oncall_hca: {}, oncall_surgeon_cardiac: {}, oncall_surgeon_thoracic: {},
    support_nurse: {}, support_hca: {}, coordinator: {}
  };
  entries.forEach(({ suffix, value }) => {
    const c = classify(suffix, theatres);
    if (c && tallies[c.kind]) tallies[c.kind][value] = (tallies[c.kind][value] || 0) + 1;
  });

  const theatreCounts = {};
  const dayCounts = {};
  const pairingCounts = {}; // the surgeon paired with that session's first-listed nurse
  const sessionGroups = buildSessionGroups(entries, theatres);
  sessionGroups.forEach(g => {
    theatreCounts[g.theatreName] = (theatreCounts[g.theatreName] || 0) + 1;
    dayCounts[g.day] = (dayCounts[g.day] || 0) + 1;
    if (g.surgeons.length && g.nurses.length) {
      g.surgeons.forEach(s => {
        const key = `${s}|||${g.nurses[0]}`;
        pairingCounts[key] = (pairingCounts[key] || 0) + 1;
      });
    }
  });

  const weekCounts = weekSessionCounts(entries, theatres, currentWeekStart);
  const weekStarts = Object.keys(weekCounts).sort().reverse();
  const weekTrend = weekStarts.length >= 2
    ? { latestCount: weekCounts[weekStarts[0]], prevCount: weekCounts[weekStarts[1]] }
    : null;

  return {
    totalSessions: sessionGroups.length, theatreCounts, dayCounts, pairingCounts, weekTrend,
    oncallNurseCounts: tallies.oncall_nurse, oncallHcaCounts: tallies.oncall_hca,
    oncallSurgeonCardiacCounts: tallies.oncall_surgeon_cardiac, oncallSurgeonThoracicCounts: tallies.oncall_surgeon_thoracic,
    supportNurseCounts: tallies.support_nurse, supportHcaCounts: tallies.support_hca, coordinatorCounts: tallies.coordinator,
    distinctOnCallNurses: Object.keys(tallies.oncall_nurse).length,
    distinctCoordinators: Object.keys(tallies.coordinator).length
  };
}

function buildFactPool(stats, weeksUsed) {
  const facts = [];

  if (stats.totalSessions > 0) {
    facts.push(`${stats.totalSessions} theatre session${stats.totalSessions === 1 ? "" : "s"} recorded across ${weeksUsed} published week${weeksUsed === 1 ? "" : "s"}.`);
  }

  const busiestTheatre = topPick(stats.theatreCounts);
  if (busiestTheatre) facts.push(`${busiestTheatre.name} has been the busiest theatre, with ${busiestTheatre.count} sessions.`);

  const quietestTheatre = bottomPick(stats.theatreCounts);
  if (quietestTheatre && busiestTheatre && quietestTheatre.name !== busiestTheatre.name) {
    facts.push(`${quietestTheatre.name} has had the fewest sessions of any theatre, with just ${quietestTheatre.count}.`);
  }

  const busiestDay = topPick(stats.dayCounts);
  if (busiestDay) facts.push(`${busiestDay.name}s have been the busiest day of the week.`);

  const quietestDay = bottomPick(stats.dayCounts);
  if (quietestDay && busiestDay && quietestDay.name !== busiestDay.name) {
    facts.push(`${quietestDay.name}s have consistently been the quietest day of the week.`);
  }

  if (weeksUsed >= 2 && busiestTheatre) {
    const pct = Math.round((busiestTheatre.count / (weeksUsed * 5)) * 100);
    facts.push(`${busiestTheatre.name} has been running on ${pct}% of the weekdays covered by published rotas.`);
  }

  if (stats.weekTrend) {
    const { latestCount, prevCount } = stats.weekTrend;
    if (latestCount !== prevCount) {
      const diff = Math.abs(latestCount - prevCount);
      facts.push(`Last week saw ${latestCount} session${latestCount === 1 ? "" : "s"} — ${diff} ${latestCount > prevCount ? "more" : "fewer"} than the week before.`);
    }
  }

  const topCoordinator = topPick(stats.coordinatorCounts);
  if (topCoordinator) facts.push(`${topCoordinator.name} has coordinated more than anyone else — ${topCoordinator.count} times.`);

  const topOnCallNurse = topPick(stats.oncallNurseCounts);
  if (topOnCallNurse) facts.push(`${topOnCallNurse.name} has covered on-call more than any other nurse — ${topOnCallNurse.count} times.`);

  const topOnCallHca = topPick(stats.oncallHcaCounts);
  if (topOnCallHca) facts.push(`${topOnCallHca.name} has covered on-call HCA duty ${topOnCallHca.count} times, more than anyone else.`);

  const topSupportNurse = topPick(stats.supportNurseCounts);
  if (topSupportNurse) facts.push(`${topSupportNurse.name} has covered Support duty ${topSupportNurse.count} times, more than anyone else.`);

  const topSurgeonCardiac = topPick(stats.oncallSurgeonCardiacCounts);
  if (topSurgeonCardiac) facts.push(`${topSurgeonCardiac.name} has covered on-call cardiac surgery more than anyone else — ${topSurgeonCardiac.count} times.`);

  const topSurgeonThoracic = topPick(stats.oncallSurgeonThoracicCounts);
  if (topSurgeonThoracic) facts.push(`${topSurgeonThoracic.name} has covered on-call thoracic surgery more than anyone else — ${topSurgeonThoracic.count} times.`);

  const topPairing = topPick(stats.pairingCounts);
  if (topPairing) {
    const [surgeon, nurse] = topPairing.name.split("|||");
    facts.push(`${surgeon} and ${nurse} have worked together ${topPairing.count} times.`);
  }

  if (stats.distinctCoordinators >= 3) {
    facts.push(`${stats.distinctCoordinators} different nurses have coordinated across the published rota history.`);
  }
  if (stats.distinctOnCallNurses >= 3) {
    facts.push(`${stats.distinctOnCallNurses} different nurses have covered on-call across the published rota history.`);
  }

  return facts;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function loadNursingTheatreIntelligence(deptId, theatres, currentWeekStart, todayIso) {
  const { entries, weeksUsed } = await loadEligibleEntries(deptId, theatres, currentWeekStart, todayIso);
  const stats = buildStats(entries, theatres, currentWeekStart);
  const pool = buildFactPool(stats, weeksUsed);

  return {
    hasData: pool.length > 0,
    pickFacts(count = 4) {
      return shuffle(pool).slice(0, count);
    }
  };
}
