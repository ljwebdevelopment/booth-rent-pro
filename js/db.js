import {
  addDoc,
  collection,
  collectionGroup,
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
import { COLLECTIONS, formatMonthLabel, monthKeyFromDate, monthKeyNow } from './appConfig.js';
import {
  createBusinessProfileShape,
  createInviteShape,
  createLedgerEntryShape,
  createRenterEventShape,
  createRenterShape,
} from './dataModel.js';

function assertDbReady() {
  if (!db) throw new Error('Database is not ready. Add Firebase config values in js/appConfig.js.');
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

export function computeDueDateForMonth(monthKey, dueDayOfMonth = 1, timezone = 'America/Chicago') {
  // timezone is reserved for deeper timezone handling later.
  void timezone;
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const safeDueDay = Math.min(28, Math.max(1, Number(dueDayOfMonth) || 1));
  return new Date(year, monthIndex, safeDueDay, 0, 0, 0, 0);
}

export function computeDueDateISO(monthKey, dueDayOfMonth = 1, timezone = 'America/Chicago') {
  return computeDueDateForMonth(monthKey, dueDayOfMonth, timezone).toISOString();
}

function isLikelyMonthlyCharge({ monthKey, note, amount, renter }) {
  const isCurrentMonth = monthKey === monthKeyNow();
  const hasMonthlyWord = String(note || '').toLowerCase().includes('monthly');
  const amountMatchesRent = Math.abs(Number(amount || 0) - Number(renter?.monthlyRent || 0)) < 0.0001;
  return isCurrentMonth && hasMonthlyWord && amountMatchesRent;
}

export function computeMonthTotals(ledgerItemsForMonth = []) {
  const chargesTotal = ledgerItemsForMonth
    .filter((entry) => entry.type === 'charge')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const paymentsTotal = ledgerItemsForMonth
    .filter((entry) => entry.type === 'payment')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const remaining = Math.max(0, chargesTotal - paymentsTotal);

  return { chargesTotal, paymentsTotal, remaining };
}

export function computeStatus({ today, dueDate, chargesTotal, paymentsTotal, remaining, hasCharge }) {
  if (hasCharge && remaining <= 0) return 'paid';
  if (hasCharge && paymentsTotal > 0 && remaining > 0) return 'partial';
  if (hasCharge && remaining > 0 && today > dueDate) return 'overdue';
  if (hasCharge && remaining > 0 && today <= dueDate) return 'due';
  if (!hasCharge && today < dueDate) return 'upcoming';
  if (!hasCharge && today >= dueDate) return 'due';
  return 'due';
}

export function summarizeCurrentMonth(renter, monthKey, ledgerEntriesForCurrentMonth, now = new Date()) {
  const dueDate = computeDueDateForMonth(monthKey, renter.dueDayOfMonth, renter.timezone);
  const { chargesTotal, paymentsTotal, remaining } = computeMonthTotals(ledgerEntriesForCurrentMonth);
  const hasCharge = chargesTotal > 0;
  const status = computeStatus({
    today: now,
    dueDate,
    chargesTotal,
    paymentsTotal,
    remaining,
    hasCharge,
  });
  const payments = ledgerEntriesForCurrentMonth.filter((entry) => entry.type === 'payment');

  return {
    monthKey,
    dueDate: dueDate.toISOString(),
    chargesTotal,
    paymentsTotal,
    payments,
    remaining,
    status,
    hasCharge,
    upcomingCharge: !hasCharge && now < dueDate,
  };
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

export async function createUserBusinessProfile(uid, profile) {
  return business.ensureExists(uid, profile);
}

export async function getUserBusinessProfile(uid) {
  return business.get(uid);
}

export const renters = {
  async list(uid, { status = 'active' } = {}) {
    assertDbReady();
    const q = query(rentersCollection(uid), where('status', '==', status), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  },

  listen(uid, { status = 'active' } = {}, onChange) {
    assertDbReady();
    const q = query(rentersCollection(uid), where('status', '==', status), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
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

  async updateNotes(uid, renterId, notes) {
    assertDbReady();
    const payload = { notes: String(notes || ''), updatedAt: serverTimestamp() };
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
  listenForRenterMonth(uid, renterId, monthKey, onChange) {
    assertDbReady();
    const q = query(
      ledgerCollection(uid),
      where('renterId', '==', renterId),
      where('appliesToMonthKey', '==', monthKey),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });
  },

  listenForMonth(uid, renterId, monthKey, onChange) {
    assertDbReady();
    const q = query(
      ledgerCollection(uid),
      where('renterId', '==', renterId),
      where('appliesToMonthKey', '==', monthKey),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });
  },

  listenPaymentsForMonth(uid, renterId, monthKey, onChange) {
    assertDbReady();
    const q = query(
      ledgerCollection(uid),
      where('type', '==', 'payment'),
      where('renterId', '==', renterId),
      where('appliesToMonthKey', '==', monthKey),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });
  },

  async list(uid, { renterId, monthKey, limitN = 200, type } = {}) {
    assertDbReady();
    const filters = [];
    if (renterId) filters.push(where('renterId', '==', renterId));
    if (monthKey) filters.push(where('appliesToMonthKey', '==', monthKey));
    if (type) filters.push(where('type', '==', type));
    const q = query(ledgerCollection(uid), ...filters, orderBy('createdAt', 'desc'), limit(limitN));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  },

  async createCharge(uid, { renterId, amount, note = '', dueDateISO = '', appliesToMonthKey }) {
    assertDbReady();
    const payload = createLedgerEntryShape({
      type: 'charge',
      renterId,
      amount: Number(amount) || 0,
      method: null,
      note,
      dueDate: dueDateISO,
      appliesToMonthKey: appliesToMonthKey || (dueDateISO ? monthKeyFromDate(dueDateISO) : monthKeyNow()),
      createdAt: serverTimestamp(),
      createdByUid: uid,
    });

    const docRef = await addDoc(ledgerCollection(uid), payload);
    return { id: docRef.id, ...payload };
  },

  async createChargeBulk(uid, { renterIds, amount, note, dueDateISO = '', appliesToMonthKey }) {
    assertDbReady();

    const ids = Array.isArray(renterIds) ? renterIds.filter(Boolean) : [];
    const monthKey = appliesToMonthKey || monthKeyNow();
    const createdEntries = [];
    const skipped = [];

    for (const renterId of ids) {
      const renterSnapshot = await getDoc(renterDoc(uid, renterId));
      if (!renterSnapshot.exists()) {
        skipped.push({ renterId, reason: 'Renter does not exist.' });
        continue;
      }

      const renterData = renterSnapshot.data();

      if (isLikelyMonthlyCharge({ monthKey, note, amount, renter: renterData })) {
        const existingMonthlyCharges = await ledger.list(uid, {
          renterId,
          monthKey,
          type: 'charge',
          limitN: 50,
        });

        const hasMonthlyCharge = existingMonthlyCharges.some((entry) =>
          String(entry.note || '').toLowerCase().includes('monthly')
        );

        if (hasMonthlyCharge) {
          skipped.push({
            renterId,
            reason: `Monthly rent charge already exists for ${formatMonthLabel(monthKey)} for ${renterData.name || 'this renter'}.`,
          });
          continue;
        }
      }

      const computedDueDate = dueDateISO
        || computeDueDateISO(monthKey, renterData.dueDayOfMonth, renterData.timezone);

      const created = await ledger.createCharge(uid, {
        renterId,
        amount,
        note,
        dueDateISO: computedDueDate,
        appliesToMonthKey: monthKey,
      });

      createdEntries.push(created);
    }

    return {
      created: createdEntries.length,
      skipped,
      entries: createdEntries,
    };
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

export const billing = {
  async ensureMonthlyCharge(uid, renter) {
    assertDbReady();
    const monthKey = monthKeyNow();
    const dueDate = computeDueDateForMonth(monthKey, renter.dueDayOfMonth, renter.timezone);
    const now = new Date();

    if (now < dueDate) {
      return { created: false, reason: 'before_due_date', monthKey, dueDate: dueDate.toISOString() };
    }

    const existingCharges = await ledger.list(uid, {
      renterId: renter.id,
      monthKey,
      type: 'charge',
      limitN: 1,
    });

    if (existingCharges.length > 0) {
      return { created: false, reason: 'already_exists', monthKey, dueDate: dueDate.toISOString() };
    }

    const note = `Monthly rent - ${formatMonthLabel(monthKey)}`;
    await ledger.createCharge(uid, {
      renterId: renter.id,
      amount: Number(renter.monthlyRent || 0),
      note,
      dueDateISO: dueDate.toISOString(),
      appliesToMonthKey: monthKey,
    });

    return { created: true, reason: 'generated', monthKey, dueDate: dueDate.toISOString() };
  },
};

export const events = {
  listenReminderCountsForMonth(uid, monthKey, onChange) {
    return events.listenRemindersForMonth(uid, monthKey, onChange);
  },

  listenRemindersForMonth(uid, monthKey, onChange) {
    assertDbReady();
    const q = query(
      collectionGroup(db, COLLECTIONS.EVENTS),
      where('userUid', '==', uid),
      where('type', '==', 'reminder_marked_sent'),
      where('monthKey', '==', monthKey),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });
  },

  listenForRenterMonth(uid, renterId, monthKey, onChange) {
    assertDbReady();
    const q = query(
      renterEventsCollection(uid, renterId),
      where('monthKey', '==', monthKey),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });
  },

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
      renterId,
      userUid: uid,
      monthKey: monthKeyFromDate(sentDate),
      sentAt: Timestamp.fromDate(sentDate),
      message: 'Reminder marked sent',
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
