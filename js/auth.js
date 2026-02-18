// Authentication interface stubs. No universal login codes.

export async function logInWithEmail(email, password) {
  return { email, password, uid: null };
}

export async function registerBusinessUser(payload) {
  return { ...payload, uid: null };
}

export async function logOutCurrentUser() {
  return true;
}
