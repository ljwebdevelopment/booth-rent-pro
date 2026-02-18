/**
 * Canonical data model shapes for BoothRent Pro.
 */

export const userBusinessProfileShape = {
  businessName: '',
  phone: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  logoUrl: ''
};

export const renterShape = {
  name: '',
  email: '',
  phone: '',
  status: 'active', // "active" | "archived"
  color: '#e2f2ea',
  billingCycle: 'monthly',
  monthlyRent: 0,
  dueDayOfMonth: 1, // chosen in renter profile later (1-28)
  timezone: 'America/Chicago',
  nextDueDate: null,
  gradeScore: 0,
  gradeLetter: 'C'
};

export const ledgerEntryShape = {
  type: 'payment', // "charge" | "payment"
  amount: 0,
  method: '',
  note: '',
  createdAt: null,
  appliesToMonthKey: '' // format: YYYY-MM
};

// Hook for future billing engine: Update amount due at the start of each due date.
// Hook for future status engine: statuses paid/partial/overdue.
