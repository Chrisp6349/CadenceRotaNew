// -----------------------------------------------------------------------
// nav.js
// Renders the shared top nav bar into #navRoot on every signed-in page.
// -----------------------------------------------------------------------

import { logout } from "./household.js";

const LINKS = [
  { key: "planner", label: "This Week", href: "planner.html" },
  { key: "shopping", label: "Shopping List", href: "shopping-list.html" },
  { key: "recipes", label: "Recipes", href: "recipes.html" },
  { key: "history", label: "History", href: "history.html" }
];

export function renderNav({ activePage, user, household }) {
  const root = document.getElementById("navRoot");
  if (!root) return;

  const linksHtml = LINKS.map(l =>
    `<a class="nav-link ${l.key === activePage ? "active" : ""}" href="${l.href}">${l.label}</a>`
  ).join("");

  root.innerHTML = `
    <nav class="topnav">
      <a class="brand" href="planner.html"><span class="mark">🍽️</span>${escapeHtml((household && household.name) || "Meal Planner")}</a>
      <div class="nav-links">${linksHtml}</div>
      <div class="nav-right">
        <span class="who">${escapeHtml((user && user.email) || "")}</span>
        <button class="btn btn-ghost btn-sm" id="navLogoutBtn">Sign out</button>
      </div>
    </nav>`;

  document.getElementById("navLogoutBtn").addEventListener("click", logout);
}

export function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
