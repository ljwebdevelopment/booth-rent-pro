import {
  addDoc,
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from './firebase-init.js';
import { COLLECTIONS, monthKeyFromDate, monthKeyNow } from './appConfig.js';
import {
  createBusinessProfileShape,
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

function randomRenterColor() {
  const palette = ['#DDF3E6', '#F3E4DD', '#DEEAF9', '#EAE3F8', '#F8F0D8', '#DDEFF1'];
  return palette[Math.floor(Math.random() * palette.length)];
}

function usersDoc(uid) {
  return doc(db, COLLECTIONS.USERS, uid);
}

function rentersCollection(uid) {
  return collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.RENTERS);
}

function renterDoc(uid, renterId) {
  return doc(db, COLLECTIONS.USERS, uid, COLLECTIONS.RENTERS, renterId);
}

function ledgerCollection(uid) {
  return collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.LEDGER);
}

function renterEventsCollection(uid, renterId) {
  return collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.RENTERS, renterId, COLLECTIONS.EVENTS);
}

function invitesCollection(uid) {
  return collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.INVITES);
}

export const business = {
  async get(uid) {
    assertDbReady();
    const snapshot = await getDoc(usersDoc(uid));
    return snapshot.exists() ? snapshot.data() : null;
  },

  async update(uid, patch) {
    assertDbReady();
    const payload = { ...patch, updatedAt: serverTimestamp() };
    await updateDoc(usersDoc(uid), payload);
    return payload;
  },

  async ensureExists(uid, defaults = {}) {
    assertDbReady();
    const existing = await business.get(uid);
    if (existing) return existing;

    const payload = createBusinessProfileShape({
      ...defaults,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(usersDoc(uid), payload, { merge: true });
    return payload;
  },
};

// Backward-compatible helpers used by existing auth flow.
export async function createUserBusinessProfile(uid, profile) {
  return business.ensureExists(uid, profile);
}

export async function getUserBusinessProfile(uid) {
  return business.get(uid);
}

export const renters = {
  async list(uid, { status = 'active' } = {}) {
    assertDbReady();
    const colRef = rentersCollection(uid);
    const q = query(colRef, where('status', '==', status), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  },

  listen(uid, { status = 'active' } = {}, onChange) {
    assertDbReady();
    const colRef = rentersCollection(uid);
    const q = query(colRef, where('status', '==', status), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      onChange(rows);
    });
  },

  async create(uid, renter) {
    assertDbReady();
    const payload = createRenterShape({
      ...renter,
      status: renter.status || 'active',
      billingCycle: 'monthly',
      timezone: renter.timezone || 'America/Chicago',
      monthlyRent: Number.isFinite(renter.monthlyRent) ? Number(renter.monthlyRent) : 0,
      dueDayOfMonth: Number.isInteger(renter.dueDayOfMonth) ? renter.dueDayOfMonth : 1,
      gradeScore: Number.isFinite(renter.gradeScore) ? Number(renter.gradeScore) : 100,
      gradeLetter: renter.gradeLetter || 'A',
      color: renter.color || randomRenterColor(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const docRef = await addDoc(rentersCollection(uid), payload);
    return { id: docRef.id, ...payload };
  },

  async update(uid, renterId, patch) {
    assertDbReady();
    const payload = { ...patch, updatedAt: serverTimestamp() };
    await updateDoc(renterDoc(uid, renterId), payload);
    return payload;
  },

  async archive(uid, renterId) {
    return renters.update(uid, renterId, { status: 'archived' });
  },

  async restore(uid, renterId) {
    return renters.update(uid, renterId, { status: 'active' });
  },

  async remove(uid, renterId) {
    assertDbReady();
    await deleteDoc(renterDoc(uid, renterId));
    return { id: renterId, removed: true };
  },
};

export const ledger = {
  async list(uid, { renterId, monthKey, limitN = 200 } = {}) {
    assertDbReady();
    const colRef = ledgerCollection(uid);
    let q = query(colRef, orderBy('createdAt', 'desc'), limit(limitN));

    if (renterId && monthKey) {
      q = query(
        colRef,
        where('renterId', '==', renterId),
        where('appliesToMonthKey', '==', monthKey),
        orderBy('createdAt', 'desc'),
        limit(limitN)
      );
    } else if (renterId) {
      q = query(colRef, where('renterId', '==', renterId), orderBy('createdAt', 'desc'), limit(limitN));
    } else if (monthKey) {
      q = query(
        colRef,
        where('appliesToMonthKey', '==', monthKey),
        orderBy('createdAt', 'desc'),
        limit(limitN)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  },

  async createCharge(uid, { renterId, amount, note = '', dueDateISO = '', appliesToMonthKey }) {
    assertDbReady();
    const payload = createLedgerEntryShape({
      type: 'charge',
      renterId,
      amount: Number(amount) || 0,
      method: '',
      note,
      dueDate: dueDateISO,
      appliesToMonthKey: appliesToMonthKey || (dueDateISO ? monthKeyFromDate(dueDateISO) : monthKeyNow()),
      createdAt: serverTimestamp(),
      createdByUid: uid,
    });

    const docRef = await addDoc(ledgerCollection(uid), payload);
    return { id: docRef.id, ...payload };
  },

  async createPayment(uid, { renterId, amount, method, note = '', appliesToMonthKey }) {
    assertDbReady();
    if (!method || !String(method).trim()) {
      throw new Error('Payment method is required.');
    }

    const payload = createLedgerEntryShape({
      type: 'payment',
      renterId,
      amount: Number(amount) || 0,
      method: String(method).trim(),
      note,
      dueDate: '',
      appliesToMonthKey: appliesToMonthKey || monthKeyNow(),
      createdAt: serverTimestamp(),
      createdByUid: uid,
    });

    const docRef = await addDoc(ledgerCollection(uid), payload);
    return { id: docRef.id, ...payload };
  },
};

export const events = {
  async list(uid, renterId, { monthKey, limitN = 100 } = {}) {
    assertDbReady();
    const colRef = renterEventsCollection(uid, renterId);
    let q = query(colRef, orderBy('createdAt', 'desc'), limit(limitN));

    if (monthKey) {
      q = query(colRef, where('monthKey', '==', monthKey), orderBy('createdAt', 'desc'), limit(limitN));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  },

  async logReminderSent(uid, renterId, sentAt = new Date()) {
    assertDbReady();
    const sentDate = sentAt instanceof Date ? sentAt : new Date(sentAt);
    const payload = createRenterEventShape({
      type: 'reminder_marked_sent',
      monthKey: monthKeyFromDate(sentDate),
      sentAt: Timestamp.fromDate(sentDate),
      message: '',
      createdAt: serverTimestamp(),
    });

    const docRef = await addDoc(renterEventsCollection(uid, renterId), payload);
    return { id: docRef.id, ...payload };
  },
};

export const invites = {
  async create(uid, email) {
    assertDbReady();
    const payload = createInviteShape({
      email,
      status: 'pending',
      createdAt: serverTimestamp(),
      createdByUid: uid,
    });
    const docRef = await addDoc(invitesCollection(uid), payload);
    return { id: docRef.id, ...payload };
  },

  async list(uid) {
    assertDbReady();
    const q = query(invitesCollection(uid), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  },

  async revoke(uid, inviteId) {
    assertDbReady();
    const docRef = doc(db, COLLECTIONS.USERS, uid, COLLECTIONS.INVITES, inviteId);
    await updateDoc(docRef, { status: 'revoked', updatedAt: serverTimestamp() });
    return { id: inviteId, status: 'revoked' };
  },
};
