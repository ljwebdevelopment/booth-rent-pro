const state = {
  selectedRenterId: null,
  searchText: '',
  drawerOpen: false,
  paymentMethod: 'Cash',
  paymentOtherMethod: '',
  noteDraftByRenterId: {},
  currentUser: null,
  authReady: false,
  authViewMode: 'signin', // "signin" | "signup"
  authLoading: false,
  authError: '',
  renters: [],
  businessProfile: null,
};

const listeners = new Set();

export function getUiState() {
  return state;
}

export function updateUiState(partialState) {
  Object.assign(state, partialState);
  listeners.forEach((listener) => listener(state));
}

export function subscribeToUiState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
