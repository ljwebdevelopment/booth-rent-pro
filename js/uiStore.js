const state = {
  selectedRenterId: null,
  searchText: '',
  drawerOpen: false,
  paymentMethod: 'Cash',
  paymentOtherMethod: '',
  noteDraftByRenterId: {},
  remindersByRenterForCurrentMonth: {},
  reminderPopoverOpenForRenterId: null,
  archiveOpen: false,
  archivedRenters: [],
  archiveLoading: false,
  archiveError: null,
  deleteConfirmOpen: false,
  deleteTargetRenterId: null,
  deleteConfirmText: '',
  deleteWorking: false,
  deleteError: null,
  deleteProgress: 0,
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
