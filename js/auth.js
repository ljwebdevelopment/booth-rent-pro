// Authentication interface stubs.
// No universal login codes are used or supported.

export async function signInWithEmail(email, password) {
  return { ok: false, message: 'Auth wiring not implemented yet.', email, password };
}

export async function signOutCurrentUser() {
  return { ok: true, message: 'Sign-out stub called.' };
}

export function getCurrentUser() {
  return null;
}
