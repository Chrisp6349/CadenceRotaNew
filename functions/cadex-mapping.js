// -----------------------------------------------------------------------
// cadex-mapping.js
// Pure functions that translate between Cadence's flat rota key/value
// shape (see js/rota.js) and the CADEX wire format described in the
// CADEX proposal (Part 3, section 18 "Consultant Mapping" and section 19
// "Cadence Export"). Kept dependency-free and side-effect-free so both
// the Provider export and the Consumer import can share it.
// -----------------------------------------------------------------------

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const WEEKENDS = ["Saturday", "Sunday"];
const ALL_DAYS = [...WEEKDAYS, ...WEEKENDS];

// The five theatres CADEX cares about, matched against a department's
// own theatre list by name (case-insensitive) since theatre IDs are
// per-department slugs, not a fixed set. A department missing one of
// these (e.g. no Cath Lab) simply has that theatre omitted everywhere.
const CADEX_THEATRE_NAMES = ["Theatre 1", "Theatre 2", "Theatre 4", "Theatre 5", "Cath Lab"];

function findTheatreId(theatres, name) {
  const t = (theatres || []).find(x => (x.name || "").trim().toLowerCase() === name.toLowerCase());
  return t ? t.id : null;
}

// { "Theatre 1": "theatre-1", "Cath Lab": "cath-lab", ... } — only the
// names that actually exist for this department are included.
function resolveCadexTheatreIds(theatres) {
  const out = {};
  CADEX_THEATRE_NAMES.forEach(name => {
    const id = findTheatreId(theatres, name);
    if (id) out[name] = id;
  });
  return out;
}

// ---- Provider side: Cadence's own data -> CADEX /api/v1/odp shape -----
// `rota` is the flat `data` map from departments/{deptId}/weeks/{weekId}.
function buildOdpExport(weekId, weekDoc, theatres) {
  const theatreIds = resolveCadexTheatreIds(theatres);
  const rota = (weekDoc && weekDoc.data) || {};
  const out = { weekCommencing: weekId, lastUpdated: weekDoc?.updatedAt || null, published: !!weekDoc?.published };

  WEEKDAYS.forEach(day => {
    const theatresOut = {};
    Object.entries(theatreIds).forEach(([name, id]) => {
      theatresOut[name] = { odp1: rota[`${day}_${id}_odp1`] || "", odp2: rota[`${day}_${id}_odp2`] || "" };
    });
    out[day.toLowerCase()] = {
      theatres: theatresOut,
      onCallOdp: rota[`${day}_oncall_odp`] || "",
      onCallFromHome: !!rota[`${day}_oncall_home`],
      onCallExtra: rota[`${day}_oncall_extra`] || ""
    };
  });

  WEEKENDS.forEach(day => {
    out[day.toLowerCase()] = {
      onCallOdp1: rota[`${day}_oncall_odp1`] || "",
      onCallSession1: rota[`${day}_oncall_session1`] || "",
      onCallOdp2: rota[`${day}_oncall_odp2`] || "",
      onCallSession2: rota[`${day}_oncall_session2`] || "",
      waitingListOdp: rota[`${day}_wl_odp`] || ""
    };
  });

  return out;
}

// ---- Provider side: surgeon on-call -> CADEX /api/v1/surgeons shape ---
// `nursingWeekDoc` is departments/{deptId}/nursingWeeks/{weekId}.
function buildSurgeonsExport(weekId, nursingWeekDoc) {
  const rota = (nursingWeekDoc && nursingWeekDoc.data) || {};
  const out = { weekCommencing: weekId, lastUpdated: nursingWeekDoc?.updatedAt || null, published: !!nursingWeekDoc?.published };
  ALL_DAYS.forEach(day => {
    out[day.toLowerCase()] = {
      cardiacOnCall: rota[`${day}_oncall_surgeon`] || "",
      thoracicOnCall: rota[`${day}_oncall_surgeon_thoracic`] || ""
    };
  });
  return out;
}

// ---- Consumer side: Atrium's /api/v1/consultants -> CADEX imports -----
// Applies the section 18 mapping table. Returns { monday: {...}, ... }
// keyed the same way the rota grid can look values up by theatre name —
// plus "On Call", "CICU" and (weekends only) "Waiting List".
//
// CT3 is special-cased: it only feeds Cath Lab on Thursdays (the
// department's one thoracic list day at Cath Lab); every other weekday
// Cath Lab comes from Atrium's own "cl" field.
function mapAtriumConsultants(atriumPayload) {
  const days = {};
  WEEKDAYS.forEach(day => {
    const src = atriumPayload?.[day.toLowerCase()] || {};
    const entry = {};
    if (src.ct1) entry["Theatre 1"] = src.ct1;
    if (src.ct2) entry["Theatre 2"] = src.ct2;
    if (src.ct4) entry["Theatre 4"] = src.ct4;
    if (src.ct5) entry["Theatre 5"] = src.ct5;
    const cathLab = (day === "Thursday" && src.ct3) ? src.ct3 : src.cl;
    if (cathLab) entry["Cath Lab"] = cathLab;
    if (src.onCall) entry["On Call"] = src.onCall;
    if (src.cicu) entry["CICU"] = src.cicu;
    days[day.toLowerCase()] = entry;
  });
  WEEKENDS.forEach(day => {
    const src = atriumPayload?.[day.toLowerCase()] || {};
    const entry = {};
    if (src.ct5) entry["Waiting List"] = src.ct5;
    if (src.onCall) entry["On Call"] = src.onCall;
    if (src.cicu) entry["CICU"] = src.cicu;
    days[day.toLowerCase()] = entry;
  });
  return days;
}

module.exports = {
  WEEKDAYS, WEEKENDS, ALL_DAYS, CADEX_THEATRE_NAMES,
  findTheatreId, resolveCadexTheatreIds,
  buildOdpExport, buildSurgeonsExport, mapAtriumConsultants
};
