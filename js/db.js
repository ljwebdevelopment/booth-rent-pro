// Database interface stubs.

export async function fetchRentersForUser(uid) {
  return { ok: true, uid, renters: [] };
}

export async function saveRenter(uid, renter) {
  return { ok: true, uid, renter };
}

export async function fetchLedgerEntries(uid, renterId) {
  return { ok: true, uid, renterId, entries: [] };
}
