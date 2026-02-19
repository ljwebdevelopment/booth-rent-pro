// Firebase initialization shim.
// Real Firebase config can replace these stubs later without changing callers.

let cachedServices = null;

export function getFirebaseServices() {
  if (cachedServices) {
    return cachedServices;
  }

  cachedServices = {
    app: null,
    auth: null,
    db: null,
    storage: null,
  };

  return cachedServices;
}
