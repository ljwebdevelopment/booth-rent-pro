import { db, serverTimestamp } from './firebase-init.js';
import { COLLECTIONS, monthKeyNow } from './appConfig.js';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
import {
  createInviteShape,
  createLedgerEntryShape,
  createRenterEventShape,
  createRenterShape,
} from './dataModel.js';

function assertDbReady() {
  if (!db) {
    throw new Error('Database is not ready. Add Firebase config values in js/appConfig.js.');
  }
}

export async function createUserBusinessProfile(uid, profile) {
  assertDbReady();

  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const payload = {
    businessName: profile.businessName,
    phone: profile.phone || '',
    address1: profile.address1 || '',
    address2: profile.address2 || '',
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

  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const snapshot = await getDoc(userRef);
  return snapshot.exists() ? snapshot.data() : null;
}

export const renters = {
  async list(uid, { status } = {}) {
    assertDbReady();
    const colRef = collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.RENTERS);
    const q = status ? query(colRef, where('status', '==', status), orderBy('name')) : query(colRef, orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  },

  async create(uid, renter) {
    assertDbReady();
    const colRef = collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.RENTERS);
    const payload = createRenterShape({
      ...renter,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const docRef = await addDoc(colRef, payload);
    return { id: docRef.id, ...payload };
  },

  async update(uid, renterId, patch) {
    assertDbReady();
    const docRef = doc(db, COLLECTIONS.USERS, uid, COLLECTIONS.RENTERS, renterId);
    const payload = { ...patch, updatedAt: serverTimestamp() };
    await updateDoc(docRef, payload);
    return payload;
  },
};

export const ledger = {
  async list(uid, { renterId, monthKey } = {}) {
    assertDbReady();
    const colRef = collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.LEDGER);
    let q = query(colRef, orderBy('createdAt', 'desc'));

    if (renterId && monthKey) {
      q = query(
        colRef,
        where('renterId', '==', renterId),
        where('appliesToMonthKey', '==', monthKey),
        orderBy('createdAt', 'desc')
      );
    } else if (renterId) {
      q = query(colRef, where('renterId', '==', renterId), orderBy('createdAt', 'desc'));
    } else if (monthKey) {
      q = query(colRef, where('appliesToMonthKey', '==', monthKey), orderBy('createdAt', 'desc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  },

  async createCharge(uid, data) {
    assertDbReady();
    const colRef = collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.LEDGER);
    const payload = createLedgerEntryShape({
      ...data,
      type: 'charge',
      appliesToMonthKey: data.appliesToMonthKey || monthKeyNow(),
      createdAt: serverTimestamp(),
      createdByUid: uid,
    });
    const docRef = await addDoc(colRef, payload);
    return { id: docRef.id, ...payload };
  },

  async createPayment(uid, data) {
    assertDbReady();
    const colRef = collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.LEDGER);
    const payload = createLedgerEntryShape({
      ...data,
      type: 'payment',
      appliesToMonthKey: data.appliesToMonthKey || monthKeyNow(),
      createdAt: serverTimestamp(),
      createdByUid: uid,
    });
    const docRef = await addDoc(colRef, payload);
    return { id: docRef.id, ...payload };
  },
};

export const events = {
  async list(uid, renterId, { monthKey } = {}) {
    assertDbReady();
    const colRef = collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.RENTERS, renterId, COLLECTIONS.EVENTS);
    const q = monthKey
      ? query(colRef, where('monthKey', '==', monthKey), orderBy('createdAt', 'desc'))
      : query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  },

  async logReminderSent(uid, renterId, sentAt = serverTimestamp()) {
    assertDbReady();
    const colRef = collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.RENTERS, renterId, COLLECTIONS.EVENTS);
    const payload = createRenterEventShape({
      type: 'reminder_marked_sent',
      sentAt,
      monthKey: monthKeyNow(),
      createdAt: serverTimestamp(),
      message: '',
    });
    const docRef = await addDoc(colRef, payload);
    return { id: docRef.id, ...payload };
  },
};

export const invites = {
  async create(uid, email) {
    assertDbReady();
    const colRef = collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.INVITES);
    const payload = createInviteShape({
      email,
      status: 'pending',
      createdAt: serverTimestamp(),
      createdByUid: uid,
    });
    const docRef = await addDoc(colRef, payload);
    return { id: docRef.id, ...payload };
  },

  async list(uid) {
    assertDbReady();
    const colRef = collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.INVITES);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  },

  async revoke(uid, inviteId) {
    assertDbReady();
    const docRef = doc(db, COLLECTIONS.USERS, uid, COLLECTIONS.INVITES, inviteId);
    await updateDoc(docRef, { status: 'revoked' });
    return { id: inviteId, status: 'revoked' };
  },
};
