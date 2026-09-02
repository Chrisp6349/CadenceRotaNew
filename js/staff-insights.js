// -----------------------------------------------------------------------
// staff-insights.js
// Shared per-person and per-group stats behind staff.html (individual
// profiles) and staff-leaderboard.html (department leaderboards) — both
// pages need the exact same "how many sessions/on-calls/etc. did this
// person do" numbers, so that logic lives here once instead of twice.
// -----------------------------------------------------------------------

import { getDepartment, listTheatres, listStaff } from "./department.js";
import { mondayOfCurrentWeek } from "./rota.js";
import { loadEligibleEntries as loadOdpEntries, classify as classifyOdp, buildSessionGroups as buildOdpSessionGroups } from "./insights.js";
import { loadEligibleEntries as loadNursingEntries, classify as classifyNursing, buildSessionGroups as buildNursingSessionGroups } from "./nursing-insights.js";

// Every role in the department shows up here — ODPs and anaesthetists
// pull their history from the ODP rota, everyone else (nurses, HCAs,
// surgeons) from the nursing rota. Display name follows the same
// convention department.js's splitStaff() uses when building the rota's
// own dropdowns, since that's what's actually stored in the rota data
// this matches names against: rotaName-or-name for ODPs/nurses/HCAs,
// always the full name for anaesthetists/surgeons.
export const TYPE_LABELS = {
  odp: "SODP", anaesthetist: "Anaesthetist",
  nurse: "Nurse", nurse_band5: "Band 5 Nurse", nurse_band6: "Band 6 Nurse", nurse_aptap: "AP/TAP",
  hca: "HCA", surgeon: "Surgeon"
};
export const NURSE_LIKE_TYPES = ["nurse", "nurse_band5", "nurse_band6", "nurse_aptap"];
export const NURSING_TYPES = [...NURSE_LIKE_TYPES, "hca", "surgeon"];
export function isNursingType(type) { return NURSING_TYPES.includes(type); }
export function shownName(s) { return (s.type === "anaesthetist" || s.type === "surgeon") ? s.name : (s.rotaName || s.name); }

function localIso(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// One-stop load: department, theatres, staff list, and both rotas'
// published history, flattened into session groups. Everything else in
// this module (and both pages) works off this bundle.
export async function loadStaffInsights(departmentId) {
  const deptPromise = getDepartment(departmentId);
  const theatresPromise = listTheatres(departmentId);
  const staffListPromise = listStaff(departmentId);
  const [dept, theatres, staffList] = await Promise.all([deptPromise, theatresPromise, staffListPromise]);

  const todayIso = localIso(new Date());
  const [odpResult, nursingResult] = await Promise.all([
    loadOdpEntries(departmentId, theatres, mondayOfCurrentWeek(), todayIso),
    loadNursingEntries(departmentId, theatres, mondayOfCurrentWeek(), todayIso)
  ]);
  const odpEntries = odpResult.entries;
  const odpSessionGroups = buildOdpSessionGroups(odpEntries, theatres);
  const nurEntries = nursingResult.entries;
  const nurSessionGroups = buildNursingSessionGroups(nurEntries, theatres);

  // The full set of published weeks (across everyone, not just one
  // person) — this is the trend chart's x-axis, so a week where someone
  // did zero sessions still shows up as a real zero bar rather than a
  // gap, instead of only ever listing weeks that person actually worked.
  const ALL_ODP_WEEKS = [...new Set(odpSessionGroups.map(g => g.weekStart))].sort();
  const ALL_NUR_WEEKS = [...new Set(nurSessionGroups.map(g => g.weekStart))].sort();

  return { dept, theatres, staffList, odpEntries, odpSessionGroups, nurEntries, nurSessionGroups, ALL_ODP_WEEKS, ALL_NUR_WEEKS };
}

export function buildWeeklyTrend(mySessions, allWeeks) {
  const counts = {};
  mySessions.forEach(g => { counts[g.weekStart] = (counts[g.weekStart] || 0) + 1; });
  return allWeeks.slice(-8).map(w => ({ weekStart: w, count: counts[w] || 0 }));
}

function buildOdpProfile(name, insights) {
  const { odpSessionGroups, odpEntries, theatres, ALL_ODP_WEEKS } = insights;
  const mySessions = odpSessionGroups.filter(g => g.odps.includes(name) || g.anaes === name);
  const theatreCounts = {};
  const dayCounts = {};
  const partnerCounts = {};

  mySessions.forEach(g => {
    theatreCounts[g.theatreName] = (theatreCounts[g.theatreName] || 0) + 1;
    dayCounts[g.day] = (dayCounts[g.day] || 0) + 1;
    if (g.anaes === name) {
      g.odps.forEach(odp => { partnerCounts[odp] = (partnerCounts[odp] || 0) + 1; });
    } else if (g.anaes) {
      partnerCounts[g.anaes] = (partnerCounts[g.anaes] || 0) + 1;
    }
  });

  let onCallCount = 0, supportCount = 0;
  odpEntries.forEach(({ suffix, value }) => {
    if (value !== name) return;
    const c = classifyOdp(suffix, theatres);
    if (c?.kind === "oncall_odp" || c?.kind === "oncall_anaes") onCallCount++;
    else if (c?.kind === "support") supportCount++;
  });

  const favouriteTheatre = Object.entries(theatreCounts).sort((a, b) => b[1] - a[1])[0] || null;
  const topPartner = Object.entries(partnerCounts).sort((a, b) => b[1] - a[1])[0] || null;

  const badges = [];
  if (mySessions.length >= 20) badges.push("Regular — 20+ sessions");
  if (onCallCount >= 10) badges.push("On-call veteran — 10+ shifts");
  if (Object.keys(partnerCounts).length >= 5) badges.push("Team player — worked with 5+ colleagues");
  if (favouriteTheatre && favouriteTheatre[1] >= 10) badges.push(`${favouriteTheatre[0]} regular`);

  return { sessionsWorked: mySessions.length, theatreCounts, dayCounts, onCallCount, supportCount, coordinatorCount: 0, favouriteTheatre, topPartner, badges, weeklyTrend: buildWeeklyTrend(mySessions, ALL_ODP_WEEKS) };
}

// Nursing sessions don't pair an ODP with an anaesthetist — they pair a
// surgeon with that session's nurses. "Most frequent colleague" for a
// surgeon is their most-worked-with nurse; for a nurse/HCA, it's their
// most-worked-with surgeon.
function buildNursingProfile(name, insights) {
  const { nurSessionGroups, nurEntries, theatres, ALL_NUR_WEEKS } = insights;
  const mySessions = nurSessionGroups.filter(g => g.nurses.includes(name) || g.hcas.includes(name) || g.surgeons.includes(name));
  const theatreCounts = {};
  const dayCounts = {};
  const partnerCounts = {};

  mySessions.forEach(g => {
    theatreCounts[g.theatreName] = (theatreCounts[g.theatreName] || 0) + 1;
    dayCounts[g.day] = (dayCounts[g.day] || 0) + 1;
    if (g.surgeons.includes(name)) {
      if (g.nurses[0]) partnerCounts[g.nurses[0]] = (partnerCounts[g.nurses[0]] || 0) + 1;
    } else {
      g.surgeons.forEach(s => { partnerCounts[s] = (partnerCounts[s] || 0) + 1; });
    }
  });

  let onCallCount = 0, supportCount = 0, coordinatorCount = 0;
  nurEntries.forEach(({ suffix, value }) => {
    if (value !== name) return;
    const c = classifyNursing(suffix, theatres);
    if (!c) return;
    if (c.kind.startsWith("oncall_")) onCallCount++;
    else if (c.kind.startsWith("support_")) supportCount++;
    else if (c.kind === "coordinator") coordinatorCount++;
  });

  const favouriteTheatre = Object.entries(theatreCounts).sort((a, b) => b[1] - a[1])[0] || null;
  const topPartner = Object.entries(partnerCounts).sort((a, b) => b[1] - a[1])[0] || null;

  const badges = [];
  if (mySessions.length >= 20) badges.push("Regular — 20+ sessions");
  if (onCallCount >= 10) badges.push("On-call veteran — 10+ shifts");
  if (coordinatorCount >= 10) badges.push("Coordination veteran — 10+ shifts");
  if (Object.keys(partnerCounts).length >= 5) badges.push("Team player — worked with 5+ colleagues");
  if (favouriteTheatre && favouriteTheatre[1] >= 10) badges.push(`${favouriteTheatre[0]} regular`);

  return { sessionsWorked: mySessions.length, theatreCounts, dayCounts, onCallCount, supportCount, coordinatorCount, favouriteTheatre, topPartner, badges, weeklyTrend: buildWeeklyTrend(mySessions, ALL_NUR_WEEKS) };
}

export function buildProfile(name, type, insights) {
  const stats = isNursingType(type) ? buildNursingProfile(name, insights) : buildOdpProfile(name, insights);
  return { type, ...stats };
}

// Broad groups rather than one board per exact role — a department's
// Band 6 Nurses or AP/TAPs alone can be only a handful of people, and a
// "top 3" of 4 people isn't a leaderboard. This mirrors the two rotas
// the app already splits everyone into, just with anaesthetists and
// surgeons pulled out as their own boards since they're a clearly
// distinct group either way.
export const LEADERBOARD_GROUPS = [
  { label: "SODP", types: ["odp"] },
  { label: "Anaesthetists", types: ["anaesthetist"] },
  { label: "Nursing", types: ["nurse", "nurse_band5", "nurse_band6", "nurse_aptap", "hca"] },
  { label: "Surgeons", types: ["surgeon"] }
];

export function buildLeaderboardHtml(insights) {
  const { staffList } = insights;
  const sections = LEADERBOARD_GROUPS.map(group => {
    const members = staffList.filter(s => group.types.includes(s.type));
    if (!members.length) return "";

    const profiles = members.map(s => {
      const name = shownName(s);
      return { name, ...buildProfile(name, s.type, insights) };
    }).filter(p => p.sessionsWorked > 0 || p.onCallCount > 0 || p.supportCount > 0 || p.coordinatorCount > 0);

    // Same rule the individual profile card grid uses: on-call and
    // sessions apply to everyone, support/coordinator only to the roles
    // that can actually be assigned those rota slots.
    const showSupport = group.types.some(t => t !== "anaesthetist" && t !== "surgeon");
    const showCoordinator = group.types.some(t => NURSE_LIKE_TYPES.includes(t));
    const categories = [
      { key: "sessionsWorked", label: "Theatre sessions" },
      { key: "onCallCount", label: "On call" },
      ...(showSupport ? [{ key: "supportCount", label: "Support duty" }] : []),
      ...(showCoordinator ? [{ key: "coordinatorCount", label: "Coordinated" }] : [])
    ];

    const bodyHtml = !profiles.length
      ? `<p class="lb-empty">No published history yet for this group.</p>`
      : `<div class="lb-grid">${categories.map(cat => {
          const ranked = profiles.filter(p => p[cat.key] > 0).sort((a, b) => b[cat.key] - a[cat.key]).slice(0, 5);
          if (!ranked.length) return `<div class="lb-card"><div class="lb-cat">${cat.label}</div><p class="lb-empty" style="padding:0;">No data yet</p></div>`;
          return `<div class="lb-card">
            <div class="lb-cat">${cat.label}</div>
            <ol class="lb-list">
              ${ranked.map((p, i) => `<li class="lb-row"><span class="lb-rank">${i + 1}</span><span class="lb-name">${p.name}</span><span class="lb-value">${p[cat.key]}</span></li>`).join("")}
            </ol>
          </div>`;
        }).join("")}</div>`;

    return `<details class="lb-group" open>
      <summary class="lb-group-title">${group.label}</summary>
      ${bodyHtml}
    </details>`;
  }).filter(Boolean).join("");

  return sections || `<p class="empty-note">No staff set up yet.</p>`;
}
