export const appConfig = {
  appName: 'BoothRent Pro',
  timezone: 'America/Chicago',
  currency: 'USD',
};

export const COLLECTIONS = {
  USERS: 'users',
  RENTERS: 'renters',
  LEDGER: 'ledger',
  EVENTS: 'events',
  INVITES: 'invites',
};

/**
 * Keep Firebase config in one place.
 * Replace these placeholders with your project values.
 */
export const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export function monthKeyFromDate(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function monthKeyNow() {
  // Lightweight timezone handling for America/Chicago.
  const chicagoDateString = new Date().toLocaleString('en-US', { timeZone: appConfig.timezone });
  return monthKeyFromDate(new Date(chicagoDateString));
}

export function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split('-');
  if (!year || !month) return monthKey;
  const date = new Date(`${year}-${month}-01T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
