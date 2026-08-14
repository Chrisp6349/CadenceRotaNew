// -----------------------------------------------------------------------
// PASTE YOUR FIREBASE CONFIG HERE
// -----------------------------------------------------------------------
// This is a SEPARATE Firebase project from the hospital rota app in the
// rest of this repo — see meals/README.md for the full setup steps
// (create project, enable Auth + Firestore, add your two accounts,
// deploy the rules in this folder).
//
// Firebase console -> Project settings -> your web app -> "SDK setup and
// configuration" -> Config. Copy the whole object and replace the one
// below.
// -----------------------------------------------------------------------

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Set to true automatically once the placeholder above has been replaced.
export const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";
