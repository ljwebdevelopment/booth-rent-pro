import { db, serverTimestamp } from './firebase-init.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

function assertDbReady() {
  if (!db) {
    throw new Error('Database is not ready. Add Firebase config values in js/appConfig.js.');
  }
}

export async function createUserBusinessProfile(uid, profile) {
  assertDbReady();

  const userRef = doc(db, 'users', uid);
  const payload = {
    businessName: profile.businessName,
    phone: profile.phone || '',
    address1: profile.address1 || '',
    city: profile.city || '',
    state: profile.state || '',
    zip: profile.zip || '',
    logoUrl: '',
    createdAt: serverTimestamp(),
    membersEnabled: true,
    ownerUid: uid,
  };

  await setDoc(userRef, payload, { merge: true });
  return payload;
}

export async function getUserBusinessProfile(uid) {
  assertDbReady();

  const userRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userRef);
  return snapshot.exists() ? snapshot.data() : null;
}
