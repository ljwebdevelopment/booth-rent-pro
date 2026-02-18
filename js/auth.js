import { auth } from './firebase-init.js';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { createUserBusinessProfile } from './db.js';

function makeFriendlyError(error) {
  const code = error?.code || '';

  if (code.includes('auth/email-already-in-use')) return 'This email is already in use.';
  if (code.includes('auth/invalid-email')) return 'Please enter a valid email address.';
  if (code.includes('auth/weak-password')) return 'Password should be at least 6 characters.';
  if (code.includes('auth/invalid-credential')) return 'Email or password is incorrect.';
  if (code.includes('auth/missing-password')) return 'Please enter your password.';

  return 'Something went wrong. Please try again.';
}

function assertAuthReady() {
  if (!auth) {
    throw new Error('Authentication is not ready. Add Firebase config values in js/appConfig.js.');
  }
}

export function listenToAuthChanges(onUserChanged) {
  if (!auth) {
    onUserChanged(null);
    return () => {};
  }

  return onAuthStateChanged(auth, (user) => onUserChanged(user));
}

export async function signUpUser({ email, password, businessProfile }) {
  assertAuthReady();

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await createUserBusinessProfile(credential.user.uid, businessProfile);
    return { ok: true, user: credential.user, error: '' };
  } catch (error) {
    return { ok: false, user: null, error: makeFriendlyError(error) };
  }
}

export async function signInUser({ email, password }) {
  assertAuthReady();

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, user: credential.user, error: '' };
  } catch (error) {
    return { ok: false, user: null, error: makeFriendlyError(error) };
  }
}

export async function signOutUser() {
  assertAuthReady();

  try {
    await signOut(auth);
    return { ok: true, error: '' };
  } catch (error) {
    return { ok: false, error: makeFriendlyError(error) };
  }
}
