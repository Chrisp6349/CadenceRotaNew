// -----------------------------------------------------------------------
// pwa.js
// Registers the service worker (sw.js) so the app installs and keeps
// working with no signal. Called once per page load from every HTML
// file — browsers no-op a duplicate registration of the same worker,
// so there's no harm in it running on every page.
//
// Also actively pushes updates through, rather than waiting on the
// browser's own schedule for checking — iOS Safari in particular (both
// in-browser and as an installed home-screen app) is slow and
// inconsistent about surfacing a new service worker on its own, which is
// what "stuck on an old cached version" looks like from the outside.
//
// One extra wrinkle specific to installed home-screen apps on iOS:
// "closing and reopening" one from the home screen usually just RESUMES
// the app from where iOS suspended it, rather than truly restarting it —
// so a "check on page load" alone can go a long time without ever firing
// again. The pageshow/visibilitychange listeners below cover that: any
// time the app becomes visible again, whether that's a genuine reload or
// just a resume from the background, it re-checks for an update.
// -----------------------------------------------------------------------

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Once a new service worker actually takes control, reload the page
  // once so the tab is running the new version straight away, instead of
  // silently sitting on stale cached content until the person happens to
  // close and reopen the app themselves.
  //
  // On iOS, "resuming" a home-screen app is exactly when this tends to
  // fire (see checkForUpdate() below) — reloading right at that instant
  // yanks the screen out from under whoever just switched back to it,
  // which is what "the app randomly glitches" looks like from the
  // outside. If the page is actually visible when control changes, wait
  // until it's hidden again (they switch away, lock the screen, etc.)
  // before reloading — by the time they come back, it's already fresh,
  // with nothing visibly happening while they're looking at it.
  let reloadedAlready = false;
  function reloadOnceHidden() {
    if (reloadedAlready) return;
    reloadedAlready = true;
    if (document.visibilityState === "hidden") {
      window.location.reload();
      return;
    }
    document.addEventListener("visibilitychange", function onHide() {
      if (document.visibilityState !== "hidden") return;
      document.removeEventListener("visibilitychange", onHide);
      window.location.reload();
    });
  }
  navigator.serviceWorker.addEventListener("controllerchange", reloadOnceHidden);

  let registrationRef = null;
  function checkForUpdate() {
    if (!registrationRef) return;
    // Bypasses normal HTTP caching for the script itself (per the service
    // worker spec), so it reliably sees a freshly deployed version rather
    // than a stale cached copy of sw.js.
    registrationRef.update().catch(() => {});
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then((registration) => {
        registrationRef = registration;
        checkForUpdate();
      })
      .catch(() => {
        // Offline on first-ever visit, or served somewhere that doesn't
        // support service workers — the app still works, just without
        // the offline/installable extras.
      });
  });

  // Covers "reopened a home-screen app that iOS just resumed rather than
  // restarted" — both events can fire in that situation, so checking on
  // either (cheap, and registrationRef being null until first load makes
  // it a no-op before then) reliably catches it.
  window.addEventListener("pageshow", checkForUpdate);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
}
