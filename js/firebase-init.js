// -----------------------------------------------------------------------
// firebase-init.js
// One place that boots Firebase and exports the pieces every other file
// needs. Uses the hosted modular SDK (no build step / npm required —
// works straight from GitHub Pages the same way the old apps did).
// -----------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp,
  enableMultiTabIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// europe-west2 matches the region the CADEX Cloud Functions deploy to
// (functions/index.js) — must stay in sync or callable invocations 404.
export const functions = getFunctions(app, "europe-west2");

// Lets already-loaded documents stay readable with no signal, and queues
// writes locally to sync automatically once back online — the actual
// substance of "offline-capable" for the data side of the app (sw.js
// handles the app-shell/installability side separately).
//
// Multi-tab variant specifically: this app is routinely used with more
// than one of its own pages open at once in the same browser (the
// corridor board left open in one tab while someone works in their own
// dashboard in another, or two staff dashboards open side by side) —
// single-tab persistence would let only the first tab hold the sync
// lock, leaving every other tab's live listeners (Team Board, rota
// grids) silently stuck until manually refreshed even though writes
// still succeed. Multi-tab persistence shares the lock across tabs
// instead, so live updates keep working in all of them.
//
// Skipped entirely on Safari: Safari's IndexedDB implementation has
// well-documented reliability problems with Firestore's persistence
// layer specifically — when it gets into a bad state, every subsequent
// Firestore read (including the very first one, fetching the signed-in
// user's own profile) can hang indefinitely instead of failing cleanly,
// which is exactly what "Taking longer than expected" on auth.js's
// timeout screen looks like. Firestore works completely normally
// without persistence — it just does a live network fetch each time
// instead of reading a local cache first — so on Safari that's the
// more reliable choice, not a degraded one. Elsewhere it still silently
// no-ops rather than breaking the app if it can't enable (very old/
// unusual browsers being the realistic remaining failure case there).
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
if (!isSafari) {
  enableMultiTabIndexedDbPersistence(db).catch(() => {});
}

export {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail,
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp,
  httpsCallable
};
