const state = {
  selectedRenterId: null,
  searchQuery: '',
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
  createRenterPanelOpen: false,
  createRenterLoading: false,
  createRenterError: '',
  pendingOpenRenterId: null,
  currentMonthKey: '',
  selectedRenterPayments: [],
  selectedRenterMonthLedgerEntries: [],
  renterMonthSummaries: {},
  remindersByRenterForCurrentMonth: {},
  reminderPopoverOpenForRenterId: null,
  historyMonthKeys: [],
  historyExpandedMonthKey: '',
  historyByMonth: {},
  historyLoadingByMonth: {},
  historyErrorByMonth: {},
  notesDraft: '',
  notesSaved: '',
  notesDirty: false,
  notesSaving: false,
  notesSaveError: null,
  notesSaveSuccess: '',
  createChargeOpen: false,
  createChargeAmount: '',
  createChargeNote: '',
  createChargeMonthKey: '',
  createChargeSelectedRenterIds: [],
  createChargeRenterSearch: '',
  createChargeSaving: false,
  createChargeError: null,
  createChargeResult: null,
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
