// -----------------------------------------------------------------------
// admin.js
// Renders the add/edit/delete UI for a department's theatres and staff,
// replacing hand-editing Firestore documents. Only ever loaded for
// admins (admin.html checks the role before importing anything here).
// -----------------------------------------------------------------------

import {
  listTheatres, saveTheatre, deleteTheatre,
  listStaff, saveStaff, deleteStaff,
  updateDepartment, listRecentAuditLog
} from "./department.js";
import { listUsers, createUserAccount, updateUserRole, revokeUserAccess } from "./users.js";
import { loadWeek, saveWeek } from "./rota.js";
import { loadNursingWeek, saveNursingWeek } from "./nursing-rota.js";
import { getCadexConfig, saveCadexConfig, getCadexStatus, cadexManualSync, cadexTestConnection, generateApiKey } from "./cadex.js";

const DEFAULT_LIST_OPTIONS = ["ROUTINE", "EMERGENCY", "URGENT"];

// Every staff "type" the department can add, in the order their admin
// boxes appear. `type` is the value stored on the staff doc (used to
// filter listStaff() results client-side — the Firestore collection
// itself stays one flat "staff" list, same as before the nursing
// module existed). Adding a new role later just means adding a row
// here, no schema change.
//
// `hasRotaName`: everyone except anaesthetists and surgeons also gets a
// second "how this appears on the rota" field, since a full legal name
// like "Chris Parrish" is what you look someone up by, but "Chris" is
// what actually fits in a rota box and is faster to scan. Full name
// stays the doc's identity (used for the doc ID and the admin list);
// rotaName is only ever a display override, falling back to the full
// name when left blank — see splitStaff() in department.js. Two people
// sharing the same rota name would show as indistinguishable on the
// rota itself, so it's worth keeping short names reasonably unique.
//
// The three nurse_* types are separate admin boxes (so banding is
// tracked) but all count as "nurse" for rota purposes — department.js's
// splitStaff() merges them into one combined nurses list, so anyone
// added under any of the three shows up in the same Nurse dropdowns on
// the nursing rota. A pre-existing plain "nurse" type (from before
// banding existed) is also still merged in, so nobody already added
// disappears — they just won't have a band until re-added/edited under
// one of the three boxes below.
// `hasInitials`: anaesthetists only — the initials The Atrium identifies
// them by (e.g. "PJ"), used to auto-resolve CADEX-imported consultant
// data to the right person. See buildAnaesthetistInitialsMap() in
// department.js.
const STAFF_TYPES = [
  { type: "odp",          label: "SODPs",            singular: "SODP",         hasRotaName: true },
  { type: "anaesthetist", label: "Anaesthetists",    singular: "Anaesthetist", hasRotaName: false, hasInitials: true },
  { type: "nurse_band5",  label: "Band 5 Nurses",     singular: "Band 5 Nurse", hasRotaName: true },
  { type: "nurse_band6",  label: "Band 6 Nurses",     singular: "Band 6 Nurse", hasRotaName: true },
  { type: "nurse_aptap",  label: "Band 4 AP/TAP",     singular: "AP/TAP",       hasRotaName: true },
  { type: "hca",          label: "HCAs",              singular: "HCA",          hasRotaName: true },
  { type: "surgeon",      label: "Surgeons",          singular: "Surgeon",      hasRotaName: false }
];

function slugId(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    || ("id-" + Date.now());
}

function suffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return n + "th";
  switch (n % 10) { case 1: return n + "st"; case 2: return n + "nd"; case 3: return n + "rd"; default: return n + "th"; }
}
function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]} ${suffix(d.getDate())} ${d.toLocaleString("en-GB",{month:"long"})} ${d.getFullYear()}`;
}

function generateTempPassword() {
  const words = ["harbor","cedar","meadow","copper","willow","quartz","ember","falcon","granite","maple"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}-${num}`;
}

const EMPTY_ICONS = {
  theatre: `<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M14 11.5v1"/>`,
  staff: `<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>`,
  tag: `<path d="M4 4h8l8 8-8 8-8-8V4z"/><circle cx="8.5" cy="8.5" r="1.2"/>`,
  calendar: `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  key: `<circle cx="8" cy="15" r="4"/><path d="M10.5 12.5L20 3M17 6l3 3M14 9l2.5 2.5"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>`
};

function emptyState(icon, title, sub) {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${EMPTY_ICONS[icon]}</svg>
    <div class="es-title">${title}</div>
    <div class="es-sub">${sub}</div>
  </div>`;
}

// Lists longer than this default to collapsed (just a count + "Show"
// link) so the page reads as a set of settings, not a wall of names.
// State persists for the rest of this visit to the page, so toggling
// a list open survives adding/removing an item from it.
const COLLAPSE_THRESHOLD = 6;
const collapseState = {};

function applyListCollapse(key, listEl, toggleBtn, countEl, count, noun) {
  countEl.textContent = `${count} ${noun}${count === 1 ? "" : "s"}`;
  if (count <= COLLAPSE_THRESHOLD) {
    listEl.classList.remove("collapsed");
    toggleBtn.style.display = "none";
    return;
  }
  toggleBtn.style.display = "";
  if (!(key in collapseState)) collapseState[key] = true; // long lists start collapsed
  const collapsed = collapseState[key];
  listEl.classList.toggle("collapsed", collapsed);
  toggleBtn.textContent = collapsed ? "Show" : "Hide";
  toggleBtn.onclick = () => {
    collapseState[key] = !collapseState[key];
    listEl.classList.toggle("collapsed", collapseState[key]);
    toggleBtn.textContent = collapseState[key] ? "Show" : "Hide";
  };
}

export function renderAdmin(container, deptId, dept, myUid, myDisplayName = "") {
  // Local working copies — saved back to the department doc as a whole
  // array/object each time something changes, same pattern as the rest
  // of this screen.
  let listOptions = (dept.listOptions && dept.listOptions.length) ? [...dept.listOptions] : [...DEFAULT_LIST_OPTIONS];
  let bankHolidays = { ...(dept.bankHolidays || {}) };
  // If the department has never had list types set, seed the defaults
  // into Firestore now so the rota page (which reads dept.listOptions
  // directly) shows ROUTINE/EMERGENCY/URGENT from the start.
  if (!dept.listOptions || !dept.listOptions.length) {
    updateDepartment(deptId, { listOptions }).catch(() => {});
  }

  container.innerHTML = `
    <div class="admin-grid">
      <section>
        <h4 class="admin-h">Department details</h4>
        <p class="empty-note" style="margin:-6px 0 10px;">Shown on the printed rota.</p>
        <form id="detailsForm" class="inline-form">
          <input type="text" id="hospitalName" placeholder="Hospital / Trust name" value="${dept.hospitalName || ""}">
          <input type="text" id="deptName" placeholder="Department name" value="${dept.name || ""}">
          <button class="btn btn-primary btn-sm" type="submit">Save details</button>
        </form>
        <p class="empty-note" style="margin:14px 0 10px;">Optional: a link to an educational slideshow staff
          can play on the Theatre Board, taking over that screen temporarily with a button to return to the
          live rota. Leave blank to not show the option at all. The site it points to must allow itself to
          be embedded — most slide tools do (e.g. Google Slides' own "Publish to the web" link), but some
          plain websites block it for security and won't display.</p>
        <form id="slideshowForm" class="inline-form">
          <input type="url" id="slideshowUrl" placeholder="https://…" value="${dept.slideshowUrl || ""}">
          <button class="btn btn-primary btn-sm" type="submit">Save link</button>
        </form>
      </section>

      <section>
        <h4 class="admin-h">CADEX — Atrium integration</h4>
        <p class="empty-note" style="margin:-6px 0 10px;">Cadence-Atrium Data Exchange. Automatically shares ODP and surgeon
          on-call information with The Atrium, and imports consultant anaesthetist allocations back — see the CADEX proposal
          for the full spec. Nothing here is enabled until you fill it in and save.</p>
        <p class="empty-note" id="cadexLockNote" style="margin:0 0 10px;">🔒 Connection details are locked — tap <strong>Edit connection details</strong> below to change them. This is on purpose: these fields control a live integration, and locking them by default means nobody can change something here by an accidental tap or keystroke.</p>
        <form id="cadexForm" class="inline-form" style="flex-direction:column;align-items:stretch;gap:10px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
            <input type="checkbox" id="cadexEnabled" disabled> Enabled
          </label>
          <input type="url" id="cadexAtriumUrl" placeholder="The Atrium's base URL, e.g. https://atrium.example.com" disabled>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" id="cadexAtriumKey" placeholder="API key Cadence sends to The Atrium" style="flex:1;" disabled>
            <button class="btn btn-ghost btn-sm" type="button" id="cadexGenAtriumKey" disabled>Generate</button>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" id="cadexProviderKey" placeholder="API key The Atrium must send to Cadence" style="flex:1;" disabled>
            <button class="btn btn-ghost btn-sm" type="button" id="cadexGenProviderKey" disabled>Generate</button>
          </div>
          <input type="url" id="cadexCadenceUrl" placeholder="Cadence's own base URL for The Atrium to call, e.g. https://europe-west2-cadence-theatre-rota.cloudfunctions.net/cadex" disabled>
          <p class="empty-note" style="margin:0;">This is the Cloud Functions URL from your Firebase deploy — not this app's own web address, since
            they're hosted separately. Firebase Console → Functions → <code>cadex</code> → Trigger URL.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" type="button" id="cadexEditBtn">Edit connection details</button>
            <button class="btn btn-primary btn-sm" type="submit" id="cadexSaveBtn" disabled>Save connection</button>
            <button class="btn btn-ghost btn-sm" type="button" id="cadexCancelBtn" style="display:none;">Cancel</button>
            <button class="btn btn-secondary btn-sm" type="button" id="cadexTestBtn">Test connection</button>
            <button class="btn btn-secondary btn-sm" type="button" id="cadexSyncBtn">Sync now</button>
          </div>
        </form>
        <div id="cadexMsg" class="empty-note" style="display:none;margin-top:8px;"></div>
        <div id="cadexStatus" class="empty-note" style="margin-top:10px;"></div>
      </section>

      <section>
        <h4 class="admin-h">Theatres</h4>
        <form id="theatreForm" class="inline-form">
          <input type="text" id="theatreName" placeholder="Theatre name, e.g. Theatre 3" required>
          <button class="btn btn-primary btn-sm" type="submit">Add theatre</button>
        </form>
        <div class="section-list-head">
          <span class="count" id="theatreCount"></span>
          <input type="text" class="list-filter" id="theatreFilter" placeholder="Filter…">
          <button class="list-toggle-btn" id="theatreToggleBtn" style="display:none;">Show</button>
        </div>
        <div id="theatreList" class="admin-list"></div>
      </section>

      ${STAFF_TYPES.map(st => `
      <section>
        <h4 class="admin-h">${st.label}</h4>
        <form id="staffForm_${st.type}" class="inline-form">
          <input type="text" id="staffName_${st.type}" placeholder="Full name" required>
          ${st.hasRotaName ? `<input type="text" id="staffRotaName_${st.type}" placeholder="How it shows on the rota, e.g. Chris (optional)">` : ""}
          ${st.hasInitials ? `<input type="text" id="staffInitials_${st.type}" placeholder="CADEX initials, e.g. PJ (optional)" maxlength="6" style="text-transform:uppercase;width:100px;">` : ""}
          <button class="btn btn-primary btn-sm" type="submit">Add ${st.singular}</button>
        </form>
        <div class="section-list-head">
          <span class="count" id="staffCount_${st.type}"></span>
          <input type="text" class="list-filter" id="staffFilter_${st.type}" placeholder="Filter…">
          <button class="list-toggle-btn" id="staffToggleBtn_${st.type}" style="display:none;">Show</button>
        </div>
        <div id="staffList_${st.type}" class="admin-list"></div>
      </section>`).join("")}

      <section>
        <h4 class="admin-h">Theatre list types</h4>
        <p class="empty-note" style="margin:-6px 0 10px;">Shown as options throughout both the SODP rota and the nursing rota — e.g. ROUTINE, EMERGENCY, CARDIAC, NO LIST, or your own.</p>
        <form id="listForm" class="inline-form">
          <input type="text" id="listValue" placeholder="e.g. NO LIST, THORACIC" required>
          <button class="btn btn-primary btn-sm" type="submit">Add value</button>
        </form>
        <div class="section-list-head">
          <span class="count" id="listOptionsCount"></span>
          <button class="list-toggle-btn" id="listOptionsToggleBtn" style="display:none;">Show</button>
        </div>
        <div id="listOptionsList" class="admin-list"></div>
      </section>

      <section>
        <h4 class="admin-h">Copy a week's rota</h4>
        <p class="empty-note" style="margin:-6px 0 10px;">Filled in the wrong week by mistake? Move (or copy) one week's saved data onto another week — pick any date that falls within each week, it'll snap to that week's Monday.</p>
        <form id="copyWeekForm" class="inline-form">
          <select id="copyWeekRotaType">
            <option value="odp">SODP rota</option>
            <option value="nursing">Nursing rota</option>
          </select>
          <input type="date" id="copyWeekFrom" required title="Any date in the week you want to copy FROM">
          <span style="align-self:center;color:var(--ink-500);">→</span>
          <input type="date" id="copyWeekTo" required title="Any date in the week you want to copy TO">
          <select id="copyWeekAction">
            <option value="move">Move (clears the original)</option>
            <option value="copy">Copy (keeps the original too)</option>
          </select>
          <button class="btn btn-primary btn-sm" type="submit">Go</button>
        </form>
        <div id="copyWeekMsg" class="empty-note" style="display:none;"></div>
      </section>

      <section>
        <h4 class="admin-h">Bank holidays</h4>
        <p class="empty-note" style="margin:-6px 0 10px;">Marked on the rota for the week they fall in.</p>
        <form id="bhForm" class="inline-form">
          <input type="date" id="bhDate" required>
          <button class="btn btn-primary btn-sm" type="submit">Add date</button>
        </form>
        <div class="section-list-head">
          <span class="count" id="bhCount"></span>
          <button class="list-toggle-btn" id="bhToggleBtn" style="display:none;">Show</button>
        </div>
        <div id="bhList" class="admin-list"></div>
      </section>

      <section>
        <h4 class="admin-h">User accounts</h4>
        <p class="empty-note" style="margin:-6px 0 10px;">Logins for this app — separate from the Staff list above,
          which is just names shown on the rota. Give the new person their email and temporary password directly.</p>
        <form id="userForm" class="inline-form">
          <input type="text" id="userName" placeholder="Full name" required>
          <input type="email" id="userEmail" placeholder="Email address" required>
          <input type="text" id="userPassword" placeholder="Temporary password" required>
          <button class="btn btn-ghost btn-sm" type="button" id="genPasswordBtn">Generate</button>
          <select id="userRole">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
            <option value="board">Board only (kiosk login)</option>
          </select>
          <button class="btn btn-primary btn-sm" type="submit">Create account</button>
        </form>
        <div id="userFormError" class="empty-note" style="display:none;color:var(--status-oncall);"></div>
        <div class="section-list-head">
          <span class="count" id="userCount"></span>
          <input type="text" class="list-filter" id="userFilter" placeholder="Filter…">
          <button class="list-toggle-btn" id="userToggleBtn" style="display:none;">Show</button>
        </div>
        <div id="userList" class="admin-list"></div>
      </section>

      <section>
        <h4 class="admin-h">Change log</h4>
        <p class="empty-note" style="margin:-6px 0 10px;">The most recent rota changes, for auditing — who changed what, and when.</p>
        <div class="section-list-head">
          <span class="count" id="auditLogCount"></span>
          <button class="list-toggle-btn" id="auditLogToggleBtn" style="display:none;">Show</button>
        </div>
        <div id="auditLogList" class="admin-list"></div>
      </section>
    </div>
  `;

  const theatreListEl = container.querySelector("#theatreList");
  const theatreCountEl = container.querySelector("#theatreCount");
  const theatreToggleBtn = container.querySelector("#theatreToggleBtn");
  const theatreFilterEl = container.querySelector("#theatreFilter");

  // Filters an already-rendered list by plain text match. Called once on
  // every keystroke, and again after any refresh*() rebuild so a typed
  // query survives adding/removing an item. Typing anything also forces
  // the list open, since a collapsed-but-matching result would be
  // confusing.
  function applyFilter(inputEl, listEl) {
    const q = inputEl.value.trim().toLowerCase();
    [...listEl.children].forEach(row => {
      if (!row.classList || !row.classList.contains("admin-row")) return;
      row.classList.toggle("filtered-out", !(!q || row.textContent.toLowerCase().includes(q)));
    });
    if (q) listEl.classList.remove("collapsed");
  }
  theatreFilterEl.addEventListener("input", () => applyFilter(theatreFilterEl, theatreListEl));

  async function refreshTheatres() {
    const theatres = await listTheatres(deptId);
    theatreListEl.innerHTML = theatres.length ? "" :
      emptyState("theatre", "No theatres yet", "Add your first theatre above to start building the rota.");
    theatres.forEach(t => {
      const row = document.createElement("div");
      row.className = "admin-row";
      row.innerHTML = `<span>${t.name}</span><button class="btn btn-ghost btn-sm" data-id="${t.id}">Remove</button>`;
      row.querySelector("button").addEventListener("click", async () => {
        if (!confirm(`Remove ${t.name}? This won't delete past rota data.`)) return;
        await deleteTheatre(deptId, t.id);
        refreshTheatres();
      });
      theatreListEl.appendChild(row);
    });
    applyListCollapse("theatres", theatreListEl, theatreToggleBtn, theatreCountEl, theatres.length, "theatre");
    applyFilter(theatreFilterEl, theatreListEl);
  }

  // One refresh function + one form handler per staff type (ODP,
  // Anaesthetist, Nurse, HCA, Surgeon). All five read/write the same
  // "staff" collection via listStaff/saveStaff/deleteStaff, just
  // filtered/tagged by `type` — so a new role is one line in
  // STAFF_TYPES, not a new collection or new department.js function.
   const refreshStaffFns = [];
  // All 7 role sections read the exact same "staff" collection, just
  // filtered client-side by type — fetching it fresh per section (7
  // reads for what's really one) was the single biggest reason
  // Administration felt slow to load. One shared, invalidatable cache:
  // populated on first use, wiped whenever any type's own add/edit/
  // remove happens so that type's next refresh re-fetches, everyone
  // else keeps using the still-accurate cached copy.
  let staffCache = null;
  async function getAllStaff() {
    if (!staffCache) staffCache = await listStaff(deptId);
    return staffCache;
  }

  // Two anaesthetists sharing the same CADEX initials would mean a CADEX
  // import can't tell them apart (buildAnaesthetistInitialsMap() in
  // department.js just lets the last one win) — a soft warning here,
  // not a hard block, since it's still fine to save if that's genuinely
  // what they want to happen for now.
  async function warnIfDuplicateInitials(initials, excludeId) {
    if (!initials) return true;
    const clash = (await getAllStaff()).find(s =>
      s.type === "anaesthetist" && s.id !== excludeId && (s.initials || "").trim().toUpperCase() === initials);
    if (!clash) return true;
    return confirm(`${clash.name} already uses the CADEX initials "${initials}" — a CADEX import won't be able to tell them apart. Save anyway?`);
  }
  STAFF_TYPES.forEach(st => {
    const listEl = container.querySelector(`#staffList_${st.type}`);
    const countEl = container.querySelector(`#staffCount_${st.type}`);
    const toggleBtn = container.querySelector(`#staffToggleBtn_${st.type}`);
    const filterEl = container.querySelector(`#staffFilter_${st.type}`);
    filterEl.addEventListener("input", () => applyFilter(filterEl, listEl));

    async function refresh() {
      const staff = (await getAllStaff()).filter(s => s.type === st.type);

      listEl.innerHTML = staff.length ? "" :
        emptyState("staff", `No ${st.label.toLowerCase()} yet`, `Add your first ${st.singular.toLowerCase()} above — they'll appear as options throughout the rota.`);
      staff.sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
        const row = document.createElement("div");
        row.className = "admin-row";

        function renderView() {
          row.innerHTML = `<span>${s.name}${s.rotaName ? ` <span class="tag-mini">shows as: ${s.rotaName}</span>` : ""}${s.initials ? ` <span class="tag-mini">CADEX: ${s.initials}</span>` : ""}</span>
            <span style="display:flex;gap:6px;flex-shrink:0;">
              <button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button>
              <button class="btn btn-ghost btn-sm" data-remove="${s.id}">Remove</button>
            </span>`;
          row.querySelector("[data-edit]").addEventListener("click", renderEdit);
                   row.querySelector("[data-remove]").addEventListener("click", async () => {
            if (!confirm(`Remove ${s.name}?`)) return;
            await deleteStaff(deptId, s.id);
            staffCache = null;
            refresh();
          });

        }

        // Saves back to the SAME doc ID (s.id) rather than creating a new
        // one — so a name change (e.g. a surname change after marriage)
        // updates this person's existing record in place instead of
        // starting a fresh one. Doesn't touch anything already published
        // on past rotas — those keep showing whatever name was picked at
        // the time, since the rota stores the name as plain text, not a
        // reference back to this record.
        function renderEdit() {
          row.innerHTML = `
            <input type="text" class="edit-name" value="${s.name}" placeholder="Full name" style="flex:1;min-width:120px;">
            ${st.hasRotaName ? `<input type="text" class="edit-rotaname" value="${s.rotaName || ""}" placeholder="How it shows on the rota" style="flex:1;min-width:120px;">` : ""}
            ${st.hasInitials ? `<input type="text" class="edit-initials" value="${s.initials || ""}" placeholder="CADEX initials" style="width:90px;text-transform:uppercase;">` : ""}
            <span style="display:flex;gap:6px;flex-shrink:0;">
              <button class="btn btn-primary btn-sm" data-save="${s.id}">Save</button>
              <button class="btn btn-ghost btn-sm" data-cancel="${s.id}">Cancel</button>
            </span>`;
          row.querySelector("[data-save]").addEventListener("click", async () => {
            const newName = row.querySelector(".edit-name").value.trim();
            if (!newName) return;
            const rotaNameInput = row.querySelector(".edit-rotaname");
            const newRotaName = rotaNameInput ? rotaNameInput.value.trim() : "";
            const initialsInput = row.querySelector(".edit-initials");
            const newInitials = initialsInput ? initialsInput.value.trim().toUpperCase() : "";
            if (!(await warnIfDuplicateInitials(newInitials, s.id))) return;
            await saveStaff(deptId, s.id, { name: newName, type: st.type, rotaName: newRotaName, initials: newInitials });
            s.name = newName;
            s.rotaName = newRotaName;
            s.initials = newInitials;
            renderView();
            applyFilter(filterEl, listEl);
          });
          row.querySelector("[data-cancel]").addEventListener("click", renderView);
        }

        renderView();
        listEl.appendChild(row);
      });
      applyListCollapse(`staff_${st.type}`, listEl, toggleBtn, countEl, staff.length, st.singular.toLowerCase());
      applyFilter(filterEl, listEl);
    }
    refreshStaffFns.push(refresh);

    container.querySelector(`#staffForm_${st.type}`).addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameInput = container.querySelector(`#staffName_${st.type}`);
      const name = nameInput.value.trim();
      if (!name) return;
      const rotaNameInput = st.hasRotaName ? container.querySelector(`#staffRotaName_${st.type}`) : null;
      const rotaName = rotaNameInput ? rotaNameInput.value.trim() : "";
      const initialsInput = st.hasInitials ? container.querySelector(`#staffInitials_${st.type}`) : null;
      const initials = initialsInput ? initialsInput.value.trim().toUpperCase() : "";
      if (!(await warnIfDuplicateInitials(initials, null))) return;
      await saveStaff(deptId, slugId(name), { name, type: st.type, rotaName, initials });
      nameInput.value = "";
      if (rotaNameInput) rotaNameInput.value = "";
      if (initialsInput) initialsInput.value = "";
      staffCache = null;
      refresh();

    });
  });
  function refreshAllStaff() { refreshStaffFns.forEach(fn => fn()); }

  container.querySelector("#theatreForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = container.querySelector("#theatreName");
    const name = input.value.trim();
    if (!name) return;
    const existing = await listTheatres(deptId);
    await saveTheatre(deptId, slugId(name), { name, order: existing.length });
    input.value = "";
    refreshTheatres();
  });

  // ---- List types -----------------------------------------------------
  const listOptionsEl = container.querySelector("#listOptionsList");
  const listOptionsCountEl = container.querySelector("#listOptionsCount");
  const listOptionsToggleBtn = container.querySelector("#listOptionsToggleBtn");
  function refreshListOptions() {
    listOptionsEl.innerHTML = listOptions.length ? "" :
      emptyState("tag", "No list types yet", "Add ROUTINE, EMERGENCY, or your own values above.");
    listOptions.forEach(val => {
      const row = document.createElement("div");
      row.className = "admin-row";
      row.innerHTML = `<span>${val}</span><button class="btn btn-ghost btn-sm">Remove</button>`;
      row.querySelector("button").addEventListener("click", async () => {
        listOptions = listOptions.filter(v => v !== val);
        await updateDepartment(deptId, { listOptions });
        refreshListOptions();
      });
      listOptionsEl.appendChild(row);
    });
    applyListCollapse("listOptions", listOptionsEl, listOptionsToggleBtn, listOptionsCountEl, listOptions.length, "list type");
  }

  container.querySelector("#listForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = container.querySelector("#listValue");
    const val = input.value.trim().toUpperCase();
    if (!val || listOptions.includes(val)) return;
    listOptions = [...listOptions, val];
    await updateDepartment(deptId, { listOptions });
    input.value = "";
    refreshListOptions();
  });

  // ---- Copy a week's rota -------------------------------------------------
  // Fixes "I filled in the wrong week" without hand-retyping every box.
  // Reuses the exact same load/save functions the rota pages themselves
  // use, so a copied/moved week goes through the normal audit log too.
   function mondayOf(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const offset = (d.getDay() + 6) % 7; // Mon=0..Sun=6
    d.setDate(d.getDate() - offset);
    // Never .toISOString() a locally-constructed date — it converts to
    // UTC first and silently shifts the date back a day during British
    // Summer Time. Building the string from local getFullYear/getMonth/
    // getDate instead (same pattern used everywhere else in this app).
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }


  container.querySelector("#copyWeekForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msgEl = container.querySelector("#copyWeekMsg");
    msgEl.style.display = "none";

    const rotaType = container.querySelector("#copyWeekRotaType").value;
    const fromRaw = container.querySelector("#copyWeekFrom").value;
    const toRaw = container.querySelector("#copyWeekTo").value;
    if (!fromRaw || !toRaw) return;
    const fromWeek = mondayOf(fromRaw);
    const toWeek = mondayOf(toRaw);
    if (fromWeek === toWeek) { alert("Those two dates fall in the same week."); return; }

    const action = container.querySelector("#copyWeekAction").value;
    const label = rotaType === "odp" ? "SODP" : "Nursing";
    const load = rotaType === "odp" ? loadWeek : loadNursingWeek;
    const save = rotaType === "odp" ? saveWeek : saveNursingWeek;

    const verb = action === "move" ? "Move" : "Copy";
    const warning = action === "move"
      ? "The original week will be cleared afterwards."
      : "Any existing data already saved on the destination week will be overwritten.";
    if (!confirm(`${verb} the ${label} rota from week commencing ${fromWeek} to week commencing ${toWeek}?\n\n${warning}`)) return;

    const submitBtn = e.target.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      const sourceWeek = await load(deptId, fromWeek);
      const sourceData = sourceWeek.data || {};
      if (!Object.keys(sourceData).length) {
        alert("That source week doesn't have any saved data to copy.");
        return;
      }
      const theatres = await listTheatres(deptId);
      await save(deptId, toWeek, sourceData, sourceWeek.published, myUid, theatres, myDisplayName);
      if (action === "move") {
        await save(deptId, fromWeek, {}, false, myUid, theatres, myDisplayName);
      }
      msgEl.textContent = `Done — ${label} rota ${action === "move" ? "moved" : "copied"} from week commencing ${fromWeek} to week commencing ${toWeek}.`;
      msgEl.style.display = "block";
      e.target.reset();
      refreshAuditLog();
    } catch (err) {
      alert("Something went wrong — please try again.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ---- Bank holidays ----------------------------------------------------
  const bhListEl = container.querySelector("#bhList");
  const bhCountEl = container.querySelector("#bhCount");
  const bhToggleBtn = container.querySelector("#bhToggleBtn");
  function refreshBankHolidays() {
    const dates = Object.keys(bankHolidays).sort();
    bhListEl.innerHTML = dates.length ? "" :
      emptyState("calendar", "No bank holidays added yet", "Add a date above and it'll show automatically on the rota and calendar.");
    dates.forEach(iso => {
      const row = document.createElement("div");
      row.className = "admin-row";
      row.innerHTML = `<span>${formatDate(iso)}</span><button class="btn btn-ghost btn-sm">Remove</button>`;
      row.querySelector("button").addEventListener("click", async () => {
        delete bankHolidays[iso];
        await updateDepartment(deptId, { bankHolidays });
        refreshBankHolidays();
      });
      bhListEl.appendChild(row);
    });
    applyListCollapse("bankHolidays", bhListEl, bhToggleBtn, bhCountEl, dates.length, "bank holiday");
  }

  container.querySelector("#bhForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = container.querySelector("#bhDate");
    if (!input.value) return;
    bankHolidays[input.value] = true;
    await updateDepartment(deptId, { bankHolidays });
    input.value = "";
    refreshBankHolidays();
  });

  container.querySelector("#detailsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const hospitalName = container.querySelector("#hospitalName").value.trim();
    const deptName = container.querySelector("#deptName").value.trim();
    await updateDepartment(deptId, { hospitalName, name: deptName });
    dept.hospitalName = hospitalName;
    dept.name = deptName;
  });

  container.querySelector("#slideshowForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const slideshowUrl = container.querySelector("#slideshowUrl").value.trim();
    await updateDepartment(deptId, { slideshowUrl });
    dept.slideshowUrl = slideshowUrl;
  });

  // ---- User accounts -----------------------------------------------------
  const userListEl = container.querySelector("#userList");
  const userFormError = container.querySelector("#userFormError");
  const userCountEl = container.querySelector("#userCount");
  const userToggleBtn = container.querySelector("#userToggleBtn");
  const userFilterEl = container.querySelector("#userFilter");
  userFilterEl.addEventListener("input", () => applyFilter(userFilterEl, userListEl));
  const ROLE_LABELS = { viewer: "Viewer", editor: "Editor", admin: "Admin", board: "Board only" };

  async function refreshUsers() {
    const users = (await listUsers(deptId)).sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
    userListEl.innerHTML = users.length ? "" :
      emptyState("key", "No accounts yet", "Create the first login above.");
    users.forEach(u => {
      const isMe = u.uid === myUid;
      const row = document.createElement("div");
      row.className = "admin-row";
      row.innerHTML = `
        <span>${u.displayName || u.email || "(unnamed)"}${isMe ? ` <span class="tag-mini">you</span>` : ""}
          ${u.email ? `<span class="tag-mini">${u.email}</span>` : ""}
        </span>
        <span style="display:flex;align-items:center;gap:8px;">
          <select data-role-for="${u.uid}" ${isMe ? "disabled title=\"You can't change your own role here\"" : ""}>
            ${Object.entries(ROLE_LABELS).map(([val, label]) =>
              `<option value="${val}" ${u.role === val ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <button class="btn btn-ghost btn-sm" data-revoke-for="${u.uid}" ${isMe ? "disabled title=\"You can't revoke your own access\"" : ""}>Revoke access</button>
        </span>`;
      row.querySelector("select").addEventListener("change", async (e) => {
        await updateUserRole(u.uid, e.target.value);
      });
      const revokeBtn = row.querySelector("button[data-revoke-for]");
      revokeBtn.addEventListener("click", async () => {
        if (!confirm(`Revoke ${u.displayName || u.email}'s access to this department? Their login will no longer work here.`)) return;
        await revokeUserAccess(u.uid);
        refreshUsers();
      });
      userListEl.appendChild(row);
    });
    applyListCollapse("users", userListEl, userToggleBtn, userCountEl, users.length, "account");
    applyFilter(userFilterEl, userListEl);
  }

  container.querySelector("#genPasswordBtn").addEventListener("click", () => {
    container.querySelector("#userPassword").value = generateTempPassword();
  });

  container.querySelector("#userForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    userFormError.style.display = "none";
    const displayName = container.querySelector("#userName").value.trim();
    const email = container.querySelector("#userEmail").value.trim();
    const password = container.querySelector("#userPassword").value;
    const role = container.querySelector("#userRole").value;
    if (!displayName || !email || !password) return;

    const submitBtn = e.target.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      await createUserAccount({ email, password, displayName, role, departmentId: deptId });
      e.target.reset();
      container.querySelector("#userRole").value = "viewer";
      refreshUsers();
    } catch (err) {
      const messages = {
        "auth/email-already-in-use": "That email already has an account.",
        "auth/invalid-email": "That doesn't look like a valid email address.",
        "auth/weak-password": "Password needs to be at least 6 characters."
      };
      userFormError.textContent = messages[err.code] || "Couldn't create the account — please try again.";
      userFormError.style.display = "block";
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ---- Change log -----------------------------------------------------
  const auditLogEl = container.querySelector("#auditLogList");
  const auditLogCountEl = container.querySelector("#auditLogCount");
  const auditLogToggleBtn = container.querySelector("#auditLogToggleBtn");

  function formatTimestamp(ts) {
    if (!ts?.toDate) return "";
    return ts.toDate().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  async function refreshAuditLog() {
    const entries = await listRecentAuditLog(deptId, 20);
    auditLogEl.innerHTML = entries.length ? "" :
      emptyState("clock", "No changes recorded yet", "Every rota save and publish will show up here.");
    entries.forEach(e => {
      const row = document.createElement("div");
      row.className = "audit-entry";
      const changesPreview = (e.changes || []).slice(0, 3)
        .map(c => `<div>${c.field}: ${c.from || "(empty)"} → ${c.to || "(empty)"}</div>`).join("");
      const moreCount = (e.changeCount || 0) - Math.min(3, (e.changes || []).length);
      const headline = e.rota === "CADEX"
        ? `<strong>${e.displayName || "Someone"}</strong> ${e.action || "changed"} the CADEX connection — ${e.changeCount || 0} change${e.changeCount === 1 ? "" : "s"}`
        : `<strong>${e.displayName || "Someone"}</strong> ${e.action || "updated"} the ${e.rota || "SODP"} rota, week commencing ${e.weekStart} — ${e.changeCount || 0} change${e.changeCount === 1 ? "" : "s"}`;
      row.innerHTML = `
        <span class="audit-time">${formatTimestamp(e.timestamp)}</span>
        <div class="audit-headline">${headline}</div>
        <div class="audit-changes">${changesPreview}${moreCount > 0 ? `<div>+${moreCount} more</div>` : ""}</div>
      `;
      auditLogEl.appendChild(row);
    });
    applyListCollapse("auditLog", auditLogEl, auditLogToggleBtn, auditLogCountEl, entries.length, "change");
  }

  // ---- CADEX — Atrium integration ----------------------------------------
  const cadexMsgEl = container.querySelector("#cadexMsg");
  const cadexStatusEl = container.querySelector("#cadexStatus");

  function cadexMsg(text, isError) {
    cadexMsgEl.textContent = text;
    cadexMsgEl.style.color = isError ? "var(--status-oncall)" : "";
    cadexMsgEl.style.display = "block";
  }

  function formatCadexTimestamp(ts) {
    if (!ts?.toDate) return "never";
    return ts.toDate().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  // The form loads locked (every field disabled) every time — including
  // right after a save — so nothing here can be changed by an accidental
  // tap/keystroke while just looking at the page. `lastLoadedCfg` is what
  // Cancel reverts to, and what the submit handler compares against to
  // know whether a save is actually changing a connection that's
  // currently live.
  let lastLoadedCfg = null;

  function fillCadexForm(cfg) {
    container.querySelector("#cadexEnabled").checked = !!cfg.enabled;
    container.querySelector("#cadexAtriumUrl").value = cfg.atriumBaseUrl || "";
    container.querySelector("#cadexAtriumKey").value = cfg.atriumApiKey || "";
    container.querySelector("#cadexProviderKey").value = cfg.providerApiKey || "";
    container.querySelector("#cadexCadenceUrl").value = cfg.cadenceBaseUrl || "";
  }

  function setCadexLocked(locked) {
    ["cadexEnabled", "cadexAtriumUrl", "cadexAtriumKey", "cadexGenAtriumKey", "cadexProviderKey", "cadexGenProviderKey", "cadexCadenceUrl"]
      .forEach(id => { container.querySelector(`#${id}`).disabled = locked; });
    container.querySelector("#cadexSaveBtn").disabled = locked;
    container.querySelector("#cadexEditBtn").style.display = locked ? "" : "none";
    container.querySelector("#cadexCancelBtn").style.display = locked ? "none" : "";
    container.querySelector("#cadexLockNote").style.display = locked ? "" : "none";
  }

  async function loadCadexForm() {
    lastLoadedCfg = await getCadexConfig(deptId);
    fillCadexForm(lastLoadedCfg);
    setCadexLocked(true);
  }

  async function refreshCadexStatus() {
    const status = await getCadexStatus(deptId);
    const imp = status.import, exp = status.export;
    const importLine = imp
      ? `Import from Atrium: ${imp.lastImportOk ? "OK" : "FAILED"} — last successful ${formatCadexTimestamp(imp.lastImportAt)}${!imp.lastImportOk ? `, last failure ${formatCadexTimestamp(imp.lastFailureAt)} (${imp.lastError || "unknown error"})` : ""}`
      : "Import from Atrium: no sync has run yet.";
    const exportLine = exp
      ? `Export to Atrium: last request ${formatCadexTimestamp(exp.lastRequestAt)} — ${exp.lastRequestOk ? "OK" : `failed (${exp.lastError || "unknown error"})`}`
      : "Export to Atrium: not yet called.";
    cadexStatusEl.innerHTML = `<div>${importLine}</div><div>${exportLine}</div><div>Poll interval: ~60 seconds</div>`;
  }

  container.querySelector("#cadexEditBtn").addEventListener("click", () => {
    setCadexLocked(false);
  });
  container.querySelector("#cadexCancelBtn").addEventListener("click", () => {
    fillCadexForm(lastLoadedCfg); // discard whatever was typed
    setCadexLocked(true);
    cadexMsgEl.style.display = "none";
  });

  // Regenerating a key that's already in use silently breaks the other
  // side's calls until they're given the new one — worth a beat before
  // overwriting something that might currently be working.
  container.querySelector("#cadexGenAtriumKey").addEventListener("click", () => {
    const el = container.querySelector("#cadexAtriumKey");
    if (el.value && !confirm("This replaces the key already in this box. If The Atrium is already using the current one, its calls will fail until you send them the new key. Generate a new one anyway?")) return;
    el.value = generateApiKey();
  });
  container.querySelector("#cadexGenProviderKey").addEventListener("click", () => {
    const el = container.querySelector("#cadexProviderKey");
    if (el.value && !confirm("This replaces the key already in this box. If The Atrium is already using the current one, its calls to Cadence will start failing until you send them the new key. Generate a new one anyway?")) return;
    el.value = generateApiKey();
  });

  container.querySelector("#cadexForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    cadexMsgEl.style.display = "none";
    const fields = {
      enabled: container.querySelector("#cadexEnabled").checked,
      atriumBaseUrl: container.querySelector("#cadexAtriumUrl").value.trim(),
      atriumApiKey: container.querySelector("#cadexAtriumKey").value.trim(),
      providerApiKey: container.querySelector("#cadexProviderKey").value.trim(),
      cadenceBaseUrl: container.querySelector("#cadexCadenceUrl").value.trim()
    };
    // The connection was already enabled before this edit, and something
    // about it is actually changing — that's the one case genuinely
    // worth a confirm, since it could break a connection currently in
    // use rather than just setting one up for the first time.
    const changedSomething = Object.keys(fields).some(k => fields[k] !== (lastLoadedCfg?.[k] ?? (k === "enabled" ? false : "")));
    if (lastLoadedCfg?.enabled && changedSomething) {
      if (!confirm("This connection is currently enabled and may be live. Saving these changes could break it until both sides match again. Save anyway?")) return;
    }
    try {
      await saveCadexConfig(deptId, fields, myUid, myDisplayName, lastLoadedCfg);
      cadexMsg("Connection details saved.");
      await loadCadexForm(); // re-locks and reloads from what was actually saved
    } catch (err) {
      cadexMsg("Couldn't save — please try again.", true);
    }
  });

  container.querySelector("#cadexTestBtn").addEventListener("click", async (e) => {
    cadexMsgEl.style.display = "none";
    e.target.disabled = true;
    try {
      const result = await cadexTestConnection(deptId);
      cadexMsg(result.ok ? `Connected — ${result.latencyMs}ms.` : `Couldn't connect: ${result.error}`, !result.ok);
    } catch (err) {
      cadexMsg(err.message || "Couldn't reach The Atrium — please try again.", true);
    } finally {
      e.target.disabled = false;
    }
  });

  container.querySelector("#cadexSyncBtn").addEventListener("click", async (e) => {
    cadexMsgEl.style.display = "none";
    e.target.disabled = true;
    try {
      const result = await cadexManualSync(deptId);
      cadexMsg(result.ok
        ? `Synced ${result.weekIds.length} week${result.weekIds.length === 1 ? "" : "s"} (commencing ${result.weekIds[0]}${result.weekIds.length > 1 ? ` to ${result.weekIds[result.weekIds.length - 1]}` : ""}).`
        : `Sync failed: ${result.errors?.[0]?.error || "unknown error"}`, !result.ok);
      refreshCadexStatus();
    } catch (err) {
      cadexMsg(err.message || "Couldn't sync — please try again.", true);
    } finally {
      e.target.disabled = false;
    }
  });

  loadCadexForm();
  refreshCadexStatus();

  refreshTheatres();
  refreshAllStaff();
  refreshListOptions();
  refreshBankHolidays();
  refreshUsers();
  refreshAuditLog();
}
