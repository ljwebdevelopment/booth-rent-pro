/**
 * Canonical data shapes for BoothRent Pro.
 * These are source-of-truth interfaces while the app is scaffolded.
 */

/** users/{uid} */
export const createBusinessProfileShape = () => ({
  businessName: '',
  phone: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  logoUrl: '',
});

/** users/{uid}/renters/{renterId} */
export const createRenterShape = (overrides = {}) => ({
  name: '',
  email: '',
  phone: '',
  status: 'active', // "active" | "archived"
  color: '#E5EFE9',
  billingCycle: 'monthly',
  monthlyRent: 0,
  dueDayOfMonth: 1, // 1-28, chosen in renter profile
  timezone: 'America/Chicago',
  nextDueDate: null,
  gradeScore: 0,
  gradeLetter: 'A',
  ...overrides,
});

/** Future ledger entry shape */
export const createLedgerEntryShape = (overrides = {}) => ({
  type: 'payment', // "charge" | "payment"
  amount: 0,
  method: '',
  note: '',
  createdAt: null,
  appliesToMonthKey: '', // "YYYY-MM"
  ...overrides,
});

// Hook for future feature: Update amount due at the start of each due date.
// Hook for future feature: Statuses: paid/partial/overdue.
