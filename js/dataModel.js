import { appConfig, monthKeyFromDate } from './appConfig.js';

export const STATUS_VALUES = ['active', 'archived'];
export const GRADE_VALUES = ['A', 'B', 'C', 'D', 'F'];
export const LEDGER_TYPES = ['charge', 'payment'];
export const EVENT_TYPES = ['reminder_marked_sent', 'status_changed', 'note_updated'];
export const INVITE_STATUSES = ['pending', 'revoked', 'accepted'];

/** users/{uid} */
export function createBusinessProfileShape(overrides = {}) {
  return {
    businessName: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    logoUrl: '',
    ownerUid: '',
    membersEnabled: true,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

/** users/{uid}/renters/{renterId} */
export function createRenterShape(overrides = {}) {
  return {
    name: '',
    email: '',
    phone: '',
    status: 'active',
    color: '#E5EFE9',
    billingCycle: 'monthly',
    monthlyRent: 0,
    dueDayOfMonth: 1,
    timezone: appConfig.timezone,
    nextDueDate: '',
    gradeScore: 0,
    gradeLetter: 'A',
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

/** users/{uid}/ledger/{entryId} */
export function createLedgerEntryShape(overrides = {}) {
  return {
    type: 'payment',
    renterId: '',
    amount: 0,
    method: '',
    note: '',
    createdAt: null,
    appliesToMonthKey: monthKeyFromDate(new Date()),
    dueDate: '',
    statusSnapshot: '',
    createdByUid: '',
    ...overrides,
  };
}

/** users/{uid}/renters/{renterId}/events/{eventId} */
export function createRenterEventShape(overrides = {}) {
  return {
    type: 'reminder_marked_sent',
    monthKey: monthKeyFromDate(new Date()),
    sentAt: null,
    message: '',
    createdAt: null,
    ...overrides,
  };
}

/** users/{uid}/invites/{inviteId} */
export function createInviteShape(overrides = {}) {
  return {
    email: '',
    status: 'pending',
    createdAt: null,
    createdByUid: '',
    ...overrides,
  };
}

export { monthKeyFromDate };

export function isValidMonthKey(monthKey) {
  return /^\d{4}-\d{2}$/.test(String(monthKey));
}

export function isValidRenter(renter) {
  return (
    !!renter &&
    typeof renter.name === 'string' &&
    renter.name.trim().length > 0 &&
    STATUS_VALUES.includes(renter.status) &&
    Number.isFinite(renter.monthlyRent) &&
    Number.isInteger(renter.dueDayOfMonth) &&
    renter.dueDayOfMonth >= 1 &&
    renter.dueDayOfMonth <= 28 &&
    Number.isFinite(renter.gradeScore) &&
    renter.gradeScore >= 0 &&
    renter.gradeScore <= 100 &&
    GRADE_VALUES.includes(renter.gradeLetter)
  );
}

export function isValidLedgerEntry(entry) {
  return (
    !!entry &&
    LEDGER_TYPES.includes(entry.type) &&
    typeof entry.renterId === 'string' &&
    entry.renterId.length > 0 &&
    Number.isFinite(entry.amount) &&
    isValidMonthKey(entry.appliesToMonthKey)
  );
}

export function isValidRenterEvent(event) {
  return (
    !!event && EVENT_TYPES.includes(event.type) && isValidMonthKey(event.monthKey)
  );
}

export function isValidInvite(invite) {
  return !!invite && typeof invite.email === 'string' && INVITE_STATUSES.includes(invite.status);
}

// Hook for future feature: Update amount due at the start of each due date.
// Hook for future feature: Statuses: paid/partial/overdue.
