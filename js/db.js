// Database interface stubs. Real implementation will connect to Firebase later.

export async function fetchRentersForUser(uid) {
  return { uid, renters: [] };
}

export async function saveRenter(uid, renter) {
  return { uid, renter };
}

export async function fetchLedgerForRenter(uid, renterId, monthKey) {
  return { uid, renterId, monthKey, entries: [] };
}
