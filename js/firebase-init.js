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

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

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
// instead, so live updates keep working in all of them. Still silently
// no-ops rather than breaking the app if it can't enable (very old/
// unusual browsers being the realistic remaining failure case) — that
// just means no offline read/write cache, same as today.
enableMultiTabIndexedDbPersistence(db).catch(() => {});

export {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail,
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp
};
