import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { getFirestore, serverTimestamp as firestoreServerTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
import { firebaseConfig } from './appConfig.js';

function hasFirebaseConfigValues(config) {
  return Object.values(config).every((value) => typeof value === 'string' && value && value !== 'REPLACE_ME');
}

export const firebaseReady = hasFirebaseConfigValues(firebaseConfig);

const app = firebaseReady
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const serverTimestamp = () => firestoreServerTimestamp();
