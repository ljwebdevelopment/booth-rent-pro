// Database interface with reminder event helpers.
// In this prototype we keep data in memory, but the event shape and
// filter logic mirror the Firestore schema/query plan used in production.

const inMemoryReminderEvents = [];
const reminderMonthListeners = new Set();

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

function notifyReminderListeners() {
  reminderMonthListeners.forEach((listener) => {
    const filteredEvents = inMemoryReminderEvents.filter((event) => {
      return (
        event.userUid === listener.uid
        && event.type === 'reminder_marked_sent'
        && event.monthKey === listener.monthKey
      );
    });

    listener.onChange(filteredEvents);
  });
}

export async function fetchRentersForUser(uid) {
  return { ok: true, uid, renters: [] };
}

export async function saveRenter(uid, renter) {
  return { ok: true, uid, renter };
}

export async function fetchLedgerEntries(uid, renterId) {
  return { ok: true, uid, renterId, entries: [] };
}

export const events = {
  async logReminderSent(uid, renterId, sentAt = new Date()) {
    const sentAtDate = toSerializableDate(sentAt);

    const reminderEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      // Canonical Firestore path:
      // users/{uid}/renters/{renterId}/events/{eventId}
      userUid: uid,
      renterId,
      type: 'reminder_marked_sent',
      monthKey: toMonthKey(sentAtDate),
      sentAt: sentAtDate,
      createdAt: new Date(),
      message: 'Marked sent',
    };

    inMemoryReminderEvents.push(reminderEvent);
    notifyReminderListeners();

    return { ok: true, event: reminderEvent };
  },

  // This listener mirrors a Firestore collectionGroup('events') query with:
  // where('userUid', '==', uid)
  // where('type', '==', 'reminder_marked_sent')
  // where('monthKey', '==', monthKey)
  listenRemindersForMonth(uid, monthKey, onChange) {
    const listener = { uid, monthKey, onChange };
    reminderMonthListeners.add(listener);

    const initialEvents = inMemoryReminderEvents.filter((event) => {
      return (
        event.userUid === uid
        && event.type === 'reminder_marked_sent'
        && event.monthKey === monthKey
      );
    });

    onChange(initialEvents);

    return () => {
      reminderMonthListeners.delete(listener);
    };
  },
};
