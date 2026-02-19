import { getFirebaseServices } from './firebase-init.js';

const dbState = {
  rentersByUid: {},
  eventsByUidAndRenter: {},
  ledgerByUid: {},
  usersByUid: {},
  invitesByUid: {},
};

const rentersListeners = new Set();
const reminderMonthListeners = new Set();
const inviteListeners = new Set();

function uidRenters(uid) {
  if (!dbState.rentersByUid[uid]) {
    dbState.rentersByUid[uid] = [];
  }
  return dbState.rentersByUid[uid];
}

function uidLedger(uid) {
  if (!dbState.ledgerByUid[uid]) {
    dbState.ledgerByUid[uid] = [];
  }
  return dbState.ledgerByUid[uid];
}

function uidEventsMap(uid) {
  if (!dbState.eventsByUidAndRenter[uid]) {
    dbState.eventsByUidAndRenter[uid] = {};
  }
  return dbState.eventsByUidAndRenter[uid];
}

function uidEvents(uid, renterId) {
  const eventsMap = uidEventsMap(uid);
  if (!eventsMap[renterId]) {
    eventsMap[renterId] = [];
  }
  return eventsMap[renterId];
}

function uidUserDoc(uid) {
  if (!dbState.usersByUid[uid]) {
    dbState.usersByUid[uid] = {
      businessName: '',
      phone: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      zip: '',
      logoUrl: '',
      updatedAt: null,
    };
  }
  return dbState.usersByUid[uid];
}

function uidInvites(uid) {
  if (!dbState.invitesByUid[uid]) {
    dbState.invitesByUid[uid] = [];
  }
  return dbState.invitesByUid[uid];
}

function toMonthKey(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function toSerializableDate(value) {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function loadUserDocFromLocalStorage(uid) {
  try {
    const raw = localStorage.getItem(`brp_user_${uid}`);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    dbState.usersByUid[uid] = { ...uidUserDoc(uid), ...parsed };
  } catch (error) {
    console.warn('Unable to load user profile from localStorage.', error);
  }
}

function saveUserDocToLocalStorage(uid) {
  try {
    localStorage.setItem(`brp_user_${uid}`, JSON.stringify(uidUserDoc(uid)));
  } catch (error) {
    console.warn('Unable to persist user profile in localStorage.', error);
  }
}

function loadInvitesFromLocalStorage(uid) {
  try {
    const raw = localStorage.getItem(`brp_invites_${uid}`);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    dbState.invitesByUid[uid] = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to load invites from localStorage.', error);
  }
}

function saveInvitesToLocalStorage(uid) {
  try {
    localStorage.setItem(`brp_invites_${uid}`, JSON.stringify(uidInvites(uid)));
  } catch (error) {
    console.warn('Unable to persist invites in localStorage.', error);
  }
}

function notifyRentersListeners(uid) {
  rentersListeners.forEach((listener) => {
    if (listener.uid !== uid) {
      return;
    }

    const renters = uidRenters(uid)
      .filter((renter) => {
        if (!listener.filters?.status) {
          return true;
        }
        return renter.status === listener.filters.status;
      })
      .map((renter) => ({ ...renter }));

    listener.onChange(renters);
  });
}

function getReminderEventsForMonth(uid, monthKey) {
  const allEvents = Object.values(uidEventsMap(uid)).flat();

  return allEvents.filter((eventData) => {
    return (
      eventData.userUid === uid
      && eventData.type === 'reminder_marked_sent'
      && eventData.monthKey === monthKey
    );
  });
}

function notifyReminderListeners(uid) {
  reminderMonthListeners.forEach((listener) => {
    if (listener.uid !== uid) {
      return;
    }
    listener.onChange(getReminderEventsForMonth(uid, listener.monthKey));
  });
}

function notifyInviteListeners(uid) {
  const sortedInvites = [...uidInvites(uid)].sort((a, b) => {
    return toSerializableDate(b.createdAt) - toSerializableDate(a.createdAt);
  });

  inviteListeners.forEach((listener) => {
    if (listener.uid !== uid) {
      return;
    }
    listener.onChange(sortedInvites.map((invite) => ({ ...invite })));
  });
}

export function seedInMemoryDb(uid, { renters = [], eventsByRenterId = {}, ledger = [], userDoc = null, invites = [] }) {
  dbState.rentersByUid[uid] = renters.map((renter) => ({ ...renter, status: renter.status || 'active' }));
  dbState.eventsByUidAndRenter[uid] = {};
  dbState.ledgerByUid[uid] = ledger.map((entry) => ({ ...entry }));
  dbState.invitesByUid[uid] = invites.map((invite) => ({ ...invite }));

  Object.entries(eventsByRenterId).forEach(([renterId, eventList]) => {
    dbState.eventsByUidAndRenter[uid][renterId] = eventList.map((eventData) => ({ ...eventData }));
  });

  loadUserDocFromLocalStorage(uid);
  loadInvitesFromLocalStorage(uid);

  if (userDoc) {
    dbState.usersByUid[uid] = { ...uidUserDoc(uid), ...userDoc };
    saveUserDocToLocalStorage(uid);
  }

  if (invites.length > 0) {
    saveInvitesToLocalStorage(uid);
  }
}

export const business = {
  async get(uid) {
    loadUserDocFromLocalStorage(uid);
    return { ...uidUserDoc(uid) };
  },

  async update(uid, patch) {
    const userDoc = uidUserDoc(uid);
    Object.assign(userDoc, patch, { updatedAt: new Date() });
    saveUserDocToLocalStorage(uid);
    return { ...userDoc };
  },
};

export const branding = {
  async uploadLogo(uid, file, onProgress) {
    const services = getFirebaseServices();
    const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'png';
    const storagePath = `users/${uid}/branding/logo.${extension}`;

    if (!services.storage) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadstart = () => onProgress?.(5);
        reader.onprogress = () => onProgress?.(55);
        reader.onerror = () => reject(new Error('Could not read the logo file.'));

        reader.onload = async () => {
          onProgress?.(100);
          const logoUrl = String(reader.result || '');
          await business.update(uid, { logoUrl, logoStoragePath: storagePath });
          resolve({ logoUrl });
        };

        reader.readAsDataURL(file);
      });
    }

    // TODO (later prompt): replace this block with uploadBytesResumable/getDownloadURL once Firebase config is active.
    return { logoUrl: '' };
  },
};

export const invites = {
  async create(uid, email) {
    const normalizedEmail = normalizeEmail(email);

    const existingPending = uidInvites(uid).find((invite) => {
      return invite.email === normalizedEmail && invite.status === 'pending';
    });

    if (existingPending) {
      return { ok: false, reason: 'duplicate' };
    }

    const inviteId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    uidInvites(uid).push({
      id: inviteId,
      email: normalizedEmail,
      status: 'pending',
      createdAt: new Date(),
      createdByUid: uid,
      updatedAt: null,
    });

    saveInvitesToLocalStorage(uid);
    notifyInviteListeners(uid);

    return { ok: true, inviteId };
  },

  listen(uid, onChange) {
    loadInvitesFromLocalStorage(uid);

    const listener = { uid, onChange };
    inviteListeners.add(listener);
    notifyInviteListeners(uid);

    return () => {
      inviteListeners.delete(listener);
    };
  },

  async revoke(uid, inviteId) {
    const invite = uidInvites(uid).find((entry) => entry.id === inviteId);
    if (!invite) {
      return { ok: false, reason: 'not_found' };
    }

    invite.status = 'revoked';
    invite.updatedAt = new Date();
    saveInvitesToLocalStorage(uid);
    notifyInviteListeners(uid);

    return { ok: true };
  },
};

export async function fetchRentersForUser(uid) {
  return { ok: true, uid, renters: uidRenters(uid).map((renter) => ({ ...renter })) };
}

export async function saveRenter(uid, renter) {
  const rentersList = uidRenters(uid);
  const existingIndex = rentersList.findIndex((item) => item.id === renter.id);

  if (existingIndex >= 0) {
    rentersList[existingIndex] = { ...rentersList[existingIndex], ...renter, updatedAt: new Date() };
  } else {
    rentersList.push({ ...renter, status: renter.status || 'active', updatedAt: new Date() });
  }

  notifyRentersListeners(uid);
  return { ok: true, uid, renter };
}

export async function fetchLedgerEntries(uid, renterId) {
  const entries = uidLedger(uid).filter((entry) => entry.renterId === renterId);
  return { ok: true, uid, renterId, entries };
}

export const renters = {
  listen(uid, filters, onChange) {
    const listener = { uid, filters, onChange };
    rentersListeners.add(listener);
    notifyRentersListeners(uid);

    return () => {
      rentersListeners.delete(listener);
    };
  },

  async archive(uid, renterId) {
    const renter = uidRenters(uid).find((item) => item.id === renterId);
    if (!renter) {
      return { ok: false, error: 'Renter not found.' };
    }

    renter.status = 'archived';
    renter.updatedAt = new Date();
    notifyRentersListeners(uid);
    return { ok: true };
  },

  async restore(uid, renterId) {
    const renter = uidRenters(uid).find((item) => item.id === renterId);
    if (!renter) {
      return { ok: false, error: 'Renter not found.' };
    }

    renter.status = 'active';
    renter.updatedAt = new Date();
    delete renter.pendingPermanentDeleteAt;
    notifyRentersListeners(uid);
    return { ok: true };
  },

  async permanentlyDelete(uid, renterId) {
    let deletedEvents = 0;
    let deletedLedger = 0;
    const chunkSize = 200;

    const renter = uidRenters(uid).find((item) => item.id === renterId);
    if (renter) {
      renter.pendingPermanentDeleteAt = new Date();
      renter.updatedAt = new Date();
    }

    const eventsMap = uidEventsMap(uid);
    const renterEvents = eventsMap[renterId] ? [...eventsMap[renterId]] : [];
    let eventCursor = 0;

    while (eventCursor < renterEvents.length) {
      const chunk = renterEvents.slice(eventCursor, eventCursor + chunkSize);
      deletedEvents += chunk.length;
      eventCursor += chunkSize;
    }

    if (eventsMap[renterId]) {
      delete eventsMap[renterId];
    }

    const ledgerEntries = uidLedger(uid);
    let remainingMatches = true;

    while (remainingMatches) {
      const chunkIndexes = [];

      for (let index = 0; index < ledgerEntries.length; index += 1) {
        if (ledgerEntries[index].renterId === renterId) {
          chunkIndexes.push(index);
        }

        if (chunkIndexes.length === chunkSize) {
          break;
        }
      }

      if (chunkIndexes.length === 0) {
        remainingMatches = false;
      } else {
        for (let i = chunkIndexes.length - 1; i >= 0; i -= 1) {
          ledgerEntries.splice(chunkIndexes[i], 1);
          deletedLedger += 1;
        }
      }
    }

    const rentersList = uidRenters(uid);
    const renterIndex = rentersList.findIndex((item) => item.id === renterId);
    const deletedRenter = renterIndex >= 0;

    if (deletedRenter) {
      rentersList.splice(renterIndex, 1);
    }

    notifyRentersListeners(uid);
    notifyReminderListeners(uid);

    return { deletedRenter, deletedEvents, deletedLedger };
  },
};

export const ledger = {
  async listByRenter(uid, renterId) {
    return uidLedger(uid)
      .filter((entry) => entry.renterId === renterId)
      .map((entry) => ({ ...entry }));
  },
};

export const billing = {
  async ensureMonthlyCharge(uid, renter, atDate = new Date()) {
    const monthKey = toMonthKey(atDate);
    const entries = uidLedger(uid);

    const hasChargeForMonth = entries.some((entry) => {
      return (
        entry.renterId === renter.id
        && entry.type === 'charge'
        && entry.appliesToMonthKey === monthKey
      );
    });

    if (hasChargeForMonth) {
      return { created: false, monthKey };
    }

    entries.push({
      id: `led_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userUid: uid,
      renterId: renter.id,
      type: 'charge',
      amount: Number(renter.monthlyRent || 0),
      appliesToMonthKey: monthKey,
      createdAt: new Date(),
      date: toSerializableDate(atDate),
      note: 'Monthly rent charge',
    });

    return { created: true, monthKey };
  },
};

export const events = {
  async logReminderSent(uid, renterId, sentAt = new Date()) {
    const sentAtDate = toSerializableDate(sentAt);

    const reminderEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userUid: uid,
      renterId,
      type: 'reminder_marked_sent',
      monthKey: toMonthKey(sentAtDate),
      sentAt: sentAtDate,
      createdAt: new Date(),
      message: 'Marked sent',
    };

    uidEvents(uid, renterId).push(reminderEvent);
    notifyReminderListeners(uid);

    return { ok: true, event: reminderEvent };
  },

  listenRemindersForMonth(uid, monthKey, onChange) {
    const listener = { uid, monthKey, onChange };
    reminderMonthListeners.add(listener);
    onChange(getReminderEventsForMonth(uid, monthKey));

    return () => {
      reminderMonthListeners.delete(listener);
    };
  },

  async listByRenter(uid, renterId) {
    return uidEvents(uid, renterId).map((eventData) => ({ ...eventData }));
  },
};
