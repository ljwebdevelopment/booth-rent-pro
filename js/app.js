import { formatMonthLabel, monthKeyNow } from './appConfig.js';
import { getUiState, updateUiState } from './uiStore.js';
import { createRenterCard } from './components/renterCard.js';
import { closeDrawer, renderRenterDrawer } from './components/drawer.js';
import { renderAuthView } from './views/authView.js';
import { listenToAuthChanges, signOutUser } from './auth.js';
import { firebaseReady } from './firebase-init.js';
import { business, ledger, renters } from './db.js';

const historyByRenterId = {
  sample: {
    'January 2026': [{ date: '2026-01-05', type: 'Payment', amount: 900, note: 'Paid in full' }],
  },
};

const authViewElement = document.getElementById('authView');
const dashboardViewElement = document.getElementById('dashboardView');
const rentersListElement = document.getElementById('rentersList');
const searchInput = document.getElementById('searchInput');
const drawerElement = document.getElementById('renterDrawer');
const overlayElement = document.getElementById('drawerOverlay');
const menuButton = document.getElementById('menuButton');
const menuPopover = document.getElementById('menuPopover');
const logoutMenuItem = document.getElementById('logoutMenuItem');
const openCreateRenterButton = document.getElementById('openCreateRenterButton');
const createRenterPanel = document.getElementById('createRenterPanel');
const createRenterOverlay = document.getElementById('createRenterOverlay');
const createRenterForm = document.getElementById('createRenterForm');
const createRenterError = document.getElementById('createRenterError');
const cancelCreateRenter = document.getElementById('cancelCreateRenter');
const cancelCreateRenterTop = document.getElementById('cancelCreateRenterTop');
const submitCreateRenter = document.getElementById('submitCreateRenter');

let unsubscribeRentersListener = null;
let unsubscribePaymentsListener = null;

function getFilteredRenters() {
  const { searchQuery, renters: renterRows } = getUiState();
  const queryText = searchQuery.trim().toLowerCase();

  if (!queryText) return renterRows;

  return renterRows.filter((renter) => {
    const searchable = [renter.name, renter.phone, renter.email].join(' ').toLowerCase();
    return searchable.includes(queryText);
  });
}

function getRenterById(renterId) {
  return getUiState().renters.find((renter) => renter.id === renterId) || null;
}

function renderRenters() {
  const visibleRenters = getFilteredRenters();

  rentersListElement.innerHTML = '';

  if (!visibleRenters.length) {
    const empty = document.createElement('div');
    empty.className = 'renter-empty';
    empty.textContent = 'No renters match your search yet.';
    rentersListElement.appendChild(empty);
    return;
  }

  visibleRenters.forEach((renter) => {
    const card = createRenterCard(renter, openRenterDrawer);
    rentersListElement.appendChild(card);
  });
}

async function savePaymentForSelectedRenter(paymentData) {
  const { currentUser } = getUiState();
  if (!currentUser) throw new Error('You must be signed in to save a payment.');
  await ledger.createPayment(currentUser.uid, paymentData);
}

async function saveNotesForSelectedRenter(notesDraft) {
  const { currentUser, selectedRenterId } = getUiState();
  if (!currentUser || !selectedRenterId) throw new Error('No renter selected.');
  await renters.updateNotes(currentUser.uid, selectedRenterId, notesDraft);
}

async function archiveSelectedRenter() {
  const { currentUser, selectedRenterId } = getUiState();
  if (!currentUser || !selectedRenterId) return;

  await renters.archive(currentUser.uid, selectedRenterId);
  closeDrawer(drawerElement, overlayElement);
  stopPaymentsListener();
}

function renderSelectedRenterDrawer() {
  const { selectedRenterId, selectedRenterPayments, currentMonthKey } = getUiState();
  if (!selectedRenterId) return;

  const renter = getRenterById(selectedRenterId);
  if (!renter) {
    closeDrawer(drawerElement, overlayElement);
    stopPaymentsListener();
    return;
  }

  renderRenterDrawer({
    drawerElement,
    overlayElement,
    renter,
    currentMonthLabel: formatMonthLabel(currentMonthKey),
    currentMonthKey,
    paymentsThisMonth: selectedRenterPayments,
    onArchiveRenter: archiveSelectedRenter,
    onSavePayment: savePaymentForSelectedRenter,
    onSaveNotes: saveNotesForSelectedRenter,
    historyByMonth: historyByRenterId[renter.id] || historyByRenterId.sample || {},
  });
}

function stopPaymentsListener() {
  if (unsubscribePaymentsListener) {
    unsubscribePaymentsListener();
    unsubscribePaymentsListener = null;
  }
  updateUiState({ selectedRenterPayments: [] });
}

function startPaymentsListenerForRenter(renterId) {
  stopPaymentsListener();

  const { currentUser, currentMonthKey } = getUiState();
  if (!currentUser || !renterId) return;

  unsubscribePaymentsListener = ledger.listenPaymentsForMonth(currentUser.uid, renterId, currentMonthKey, (payments) => {
    updateUiState({ selectedRenterPayments: payments });
    renderSelectedRenterDrawer();
  });
}

function openRenterDrawer(renter) {
  const savedNotes = renter.notes || '';
  updateUiState({
    selectedRenterId: renter.id,
    notesDraft: savedNotes,
    notesSaved: savedNotes,
    notesDirty: false,
    notesSaving: false,
    notesSaveError: null,
    notesSaveSuccess: '',
  });
  startPaymentsListenerForRenter(renter.id);
  renderSelectedRenterDrawer();
}

function openCreateRenterPanel() {
  updateUiState({ createRenterPanelOpen: true, createRenterError: '' });
  createRenterPanel.classList.add('open');
  createRenterOverlay.classList.add('open');
  createRenterPanel.setAttribute('aria-hidden', 'false');
}

function closeCreateRenterPanel() {
  updateUiState({ createRenterPanelOpen: false, createRenterError: '' });
  createRenterPanel.classList.remove('open');
  createRenterOverlay.classList.remove('open');
  createRenterPanel.setAttribute('aria-hidden', 'true');
  createRenterForm.reset();
  createRenterError.classList.add('hidden');
}

function showCreateRenterError(message) {
  createRenterError.textContent = message;
  createRenterError.classList.remove('hidden');
}

function setCreateRenterLoading(loading) {
  updateUiState({ createRenterLoading: loading });
  submitCreateRenter.disabled = loading;
  submitCreateRenter.textContent = loading ? 'Creating...' : 'Create Renter';
}

async function handleCreateRenterSubmit(event) {
  event.preventDefault();

  const { currentUser } = getUiState();
  if (!currentUser) {
    showCreateRenterError('You must be signed in to create a renter.');
    return;
  }

  const formData = new FormData(createRenterForm);
  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const monthlyRentInput = String(formData.get('monthlyRent') || '').trim();
  const dueDayInput = String(formData.get('dueDayOfMonth') || '').trim();

  if (!name) {
    showCreateRenterError('Renter Name is required.');
    return;
  }

  const dueDayOfMonth = dueDayInput ? Number(dueDayInput) : 1;
  if (!Number.isInteger(dueDayOfMonth) || dueDayOfMonth < 1 || dueDayOfMonth > 28) {
    showCreateRenterError('Due day must be a whole number between 1 and 28.');
    return;
  }

  const monthlyRent = monthlyRentInput ? Number(monthlyRentInput) : 0;
  if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
    showCreateRenterError('Monthly rent must be a number greater than or equal to 0.');
    return;
  }

  createRenterError.classList.add('hidden');
  setCreateRenterLoading(true);

  try {
    const created = await renters.create(currentUser.uid, {
      name,
      phone,
      email,
      monthlyRent,
      dueDayOfMonth,
    });

    updateUiState({ pendingOpenRenterId: created.id });
    closeCreateRenterPanel();
  } catch (error) {
    showCreateRenterError(error?.message || 'Could not create renter. Please try again.');
  } finally {
    setCreateRenterLoading(false);
  }
}

function maybeOpenPendingRenter() {
  const { pendingOpenRenterId, renters: renterRows } = getUiState();
  if (!pendingOpenRenterId) return;

  const renterToOpen = renterRows.find((row) => row.id === pendingOpenRenterId);
  if (!renterToOpen) return;

  updateUiState({ pendingOpenRenterId: null });
  openRenterDrawer(renterToOpen);
}

function showAuthView() {
  authViewElement.classList.remove('hidden');
  dashboardViewElement.classList.add('hidden');
  dashboardViewElement.setAttribute('aria-hidden', 'true');
  renderAuthView(authViewElement);
}

function showDashboardView() {
  authViewElement.classList.add('hidden');
  dashboardViewElement.classList.remove('hidden');
  dashboardViewElement.setAttribute('aria-hidden', 'false');
  renderRenters();
}

function renderAppShell() {
  const { authReady, currentUser, authError } = getUiState();

  if (!authReady) return;

  if (authError && !firebaseReady) {
    authViewElement.innerHTML = `<div class="auth-card"><p class="auth-error">${authError}</p></div>`;
    authViewElement.classList.remove('hidden');
    dashboardViewElement.classList.add('hidden');
    return;
  }

  if (currentUser) {
    showDashboardView();
  } else {
    showAuthView();
  }
}

async function startBusinessAndRenterDataFlow(user) {
  if (unsubscribeRentersListener) {
    unsubscribeRentersListener();
    unsubscribeRentersListener = null;
  }

  const userProfile = await business.get(user.uid);
  updateUiState({ businessProfile: userProfile });

  unsubscribeRentersListener = renters.listen(user.uid, { status: 'active' }, (renterRows) => {
    const selectedRenterId = getUiState().selectedRenterId;
    updateUiState({ renters: renterRows });
    renderRenters();
    maybeOpenPendingRenter();

    if (selectedRenterId) {
      const selectedExists = renterRows.some((r) => r.id === selectedRenterId);
      if (selectedExists) {
        const selectedRenter = renterRows.find((r) => r.id === selectedRenterId);
        const currentState = getUiState();
        if (selectedRenter && !currentState.notesDirty) {
          const savedNotes = selectedRenter.notes || '';
          updateUiState({ notesSaved: savedNotes, notesDraft: savedNotes, notesSaveError: null });
        }
        renderSelectedRenterDrawer();
      } else {
        closeDrawer(drawerElement, overlayElement);
        stopPaymentsListener();
      }
    }
  });
}

function clearSignedOutDataFlow() {
  if (unsubscribeRentersListener) {
    unsubscribeRentersListener();
    unsubscribeRentersListener = null;
  }
  stopPaymentsListener();

  updateUiState({
    renters: [],
    businessProfile: null,
    selectedRenterId: null,
    searchQuery: '',
    pendingOpenRenterId: null,
  });
}

function closeRenterDrawerFromUi() {
  closeDrawer(drawerElement, overlayElement);
  stopPaymentsListener();
}

function setupEvents() {
  searchInput.addEventListener('input', (event) => {
    updateUiState({ searchQuery: event.target.value });
    renderRenters();
  });

  overlayElement.addEventListener('click', closeRenterDrawerFromUi);

  menuButton.addEventListener('click', () => {
    menuPopover.classList.toggle('open');
  });

  openCreateRenterButton.addEventListener('click', openCreateRenterPanel);
  cancelCreateRenter.addEventListener('click', closeCreateRenterPanel);
  cancelCreateRenterTop.addEventListener('click', closeCreateRenterPanel);
  createRenterOverlay.addEventListener('click', closeCreateRenterPanel);
  createRenterForm.addEventListener('submit', handleCreateRenterSubmit);

  logoutMenuItem.addEventListener('click', async () => {
    await signOutUser();
    menuPopover.classList.remove('open');
  });

  document.addEventListener('click', (event) => {
    const clickWasInsideMenu = menuPopover.contains(event.target) || menuButton.contains(event.target);
    if (!clickWasInsideMenu) {
      menuPopover.classList.remove('open');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menuPopover.classList.remove('open');
      closeRenterDrawerFromUi();
      closeCreateRenterPanel();
    }
  });
}

function startApp() {
  setupEvents();

  updateUiState({ currentMonthKey: monthKeyNow(), selectedRenterPayments: [] });

  if (!firebaseReady) {
    updateUiState({
      authReady: true,
      authError: 'Firebase config is missing. Update js/appConfig.js with your project values to use sign in.',
    });
    renderAppShell();
    return;
  }

  listenToAuthChanges(async (user) => {
    updateUiState({
      currentUser: user,
      authReady: true,
      authError: '',
    });

    if (user) {
      await startBusinessAndRenterDataFlow(user);
    } else {
      clearSignedOutDataFlow();
    }

    renderAppShell();
  });
}

startApp();
