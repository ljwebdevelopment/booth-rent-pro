// Firebase initialization will be wired in Prompt 2.
// Keep one modular initialization entry point for the whole app.
export function initializeFirebase() {
  return {
    app: null,
    auth: null,
    db: null
  };
}
