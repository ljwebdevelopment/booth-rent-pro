import { formatMonthLabel, monthKeyNow } from './appConfig.js';
import { getUiState, updateUiState } from './uiStore.js';
import { createRenterCard } from './components/renterCard.js';
import { closeDrawer, mergeHistoryItems, renderRenterDrawer } from './components/drawer.js';
import { createDropdown } from './components/dropdown.js';
import { renderAuthView } from './views/authView.js';
import { listenToAuthChanges, signOutUser } from './auth.js';
import { firebaseReady } from './firebase-init.js';
import { billing, business, ledger, renters, summarizeCurrentMonth, events } from './db.js';

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

const openCreateChargeButton = document.getElementById('openCreateChargeButton');
const createChargePanel = document.getElementById('createChargePanel');
const createChargeOverlay = document.getElementById('createChargeOverlay');
const createChargeForm = document.getElementById('createChargeForm');
const createChargeAmount = document.getElementById('createChargeAmount');
const createChargeNote = document.getElementById('createChargeNote');
const createChargeMonthDropdown = document.getElementById('createChargeMonthDropdown');
const createChargeRenterSearch = document.getElementById('createChargeRenterSearch');
const createChargeRentersList = document.getElementById('createChargeRentersList');
const createChargeError = document.getElementById('createChargeError');
const createChargeResult = document.getElementById('createChargeResult');
const chargeSelectedCount = document.getElementById('chargeSelectedCount');
const selectAllChargeRenters = document.getElementById('selectAllChargeRenters');
const clearChargeRenters = document.getElementById('clearChargeRenters');
const cancelCreateCharge = document.getElementById('cancelCreateCharge');
const cancelCreateChargeTop = document.getElementById('cancelCreateChargeTop');
const submitCreateCharge = document.getElementById('submitCreateCharge');

let unsubscribeRentersListener = null;
let unsubscribeMonthLedgerListener = null;
let unsubscribeRemindersListener = null;
let historyUnsubscribers = [];
let createChargeMonthControl = null;

function monthKeyOffset(monthKey, offset) {
  const [yearText, monthText] = monthKey.split('-');
  const date = new Date(Number(yearText), Number(monthText) - 1 + offset, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getDefaultHistoryMonthKeys() {
  const current = getUiState().currentMonthKey;
  return [current, monthKeyOffset(current, -1), monthKeyOffset(current, -2)];
}

function getCreateChargeMonthOptions() {
  const current = getUiState().currentMonthKey;
  return [monthKeyOffset(current, -1), current, monthKeyOffset(current, 1)].map((monthKey) => ({
    label: formatMonthLabel(monthKey),
    value: monthKey,
  }));
}

function getFilteredRenters() {
  const { searchQuery, renters: renterRows } = getUiState();
  const queryText = searchQuery.trim().toLowerCase();
  if (!queryText) return renterRows;

  return renterRows.filter((renter) => {
    const searchable = [renter.name, renter.phone, renter.email].join(' ').toLowerCase();
    return searchable.includes(queryText);
  });
}

function getChargeSearchFilteredRenters() {
  const { createChargeRenterSearch, renters: renterRows } = getUiState();
  const queryText = createChargeRenterSearch.trim().toLowerCase();
  if (!queryText) return renterRows;

  return renterRows.filter((renter) => {
    const searchable = [renter.name, renter.phone, renter.email].join(' ').toLowerCase();
    return searchable.includes(queryText);
  });
}

function getRenterById(renterId) {
  return getUiState().renters.find((renter) => renter.id === renterId) || null;
}

function getRenterMonthSummary(renterId) {
  return getUiState().renterMonthSummaries[renterId] || null;
}


function getRemindersForRenter(renterId) {
  return getUiState().remindersByRenterForCurrentMonth[renterId] || [];
}

function toggleReminderPopover(renterId) {
  const { reminderPopoverOpenForRenterId } = getUiState();
  updateUiState({
    reminderPopoverOpenForRenterId: reminderPopoverOpenForRenterId === renterId ? null : renterId,
  });
  renderRenters();
}

function closeReminderPopover() {
  if (!getUiState().reminderPopoverOpenForRenterId) return;
  updateUiState({ reminderPopoverOpenForRenterId: null });
  renderRenters();
}

function renderRenters() {
  const visibleRenters = getFilteredRenters();
  rentersListElement.innerHTML = '';

  updateCreateChargeSubmitState();

  if (!visibleRenters.length) {
    const empty = document.createElement('div');
    empty.className = 'renter-empty';
    empty.textContent = 'No renters match your search yet.';
    rentersListElement.appendChild(empty);
    return;
  }

  const selectedId = getUiState().selectedRenterId;

  visibleRenters.forEach((renter) => {
    const summary = getRenterMonthSummary(renter.id);
    const computedStatus = renter.id === selectedId ? (summary?.status || 'due') : 'unknown';
    rentersListElement.appendChild(createRenterCard(
      { ...renter, computedStatus },
      openRenterDrawer,
      {
        reminders: getRemindersForRenter(renter.id),
        reminderPopoverOpen: getUiState().reminderPopoverOpenForRenterId === renter.id,
        onToggleReminderPopover: toggleReminderPopover,
      }
    ));
  });
}

function renderCreateChargeRenterList() {
  const { createChargeSelectedRenterIds } = getUiState();
  const selectedIds = new Set(createChargeSelectedRenterIds);
  const visibleRenters = getChargeSearchFilteredRenters();

  createChargeRentersList.innerHTML = '';
  chargeSelectedCount.textContent = `Selected: ${selectedIds.size}`;
  updateCreateChargeSubmitState();

  if (!visibleRenters.length) {
    const empty = document.createElement('div');
    empty.className = 'charge-renter-empty';
    empty.textContent = 'No active renters found.';
    createChargeRentersList.appendChild(empty);
    return;
  }

  visibleRenters.forEach((renter) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `charge-renter-row${selectedIds.has(renter.id) ? ' selected' : ''}`;
    row.setAttribute('aria-pressed', selectedIds.has(renter.id) ? 'true' : 'false');

    const left = document.createElement('div');
    left.className = 'charge-renter-meta';

    const title = document.createElement('strong');
    title.textContent = renter.name;
    const subtitle = document.createElement('span');
    subtitle.textContent = [renter.phone || '', renter.email || ''].filter(Boolean).join(' • ') || 'No contact info';

    left.append(title, subtitle);

    const badge = document.createElement('span');
    badge.className = 'charge-renter-check';
    badge.textContent = selectedIds.has(renter.id) ? 'Selected' : 'Select';

    row.append(left, badge);
    row.addEventListener('click', () => {
      const next = new Set(getUiState().createChargeSelectedRenterIds);
      if (next.has(renter.id)) next.delete(renter.id);
      else next.add(renter.id);
      updateUiState({ createChargeSelectedRenterIds: [...next] });
      renderCreateChargeRenterList();
    });

    createChargeRentersList.appendChild(row);
  });
}

function setCreateChargeError(message = '') {
  createChargeError.textContent = message;
  createChargeError.classList.toggle('hidden', !message);
}

function setCreateChargeResult(message = '') {
  createChargeResult.textContent = message;
  createChargeResult.classList.toggle('success', Boolean(message));
}

function setCreateChargeSaving(isSaving) {
  updateUiState({ createChargeSaving: isSaving });
  submitCreateCharge.textContent = isSaving ? 'Creating...' : 'Create Charges';
  updateCreateChargeSubmitState();
}


function updateCreateChargeSubmitState() {
  const { createChargeSelectedRenterIds, createChargeSaving } = getUiState();
  const amount = Number(createChargeAmount.value || 0);
  const note = String(createChargeNote.value || '').trim();
  const valid = Number.isFinite(amount) && amount > 0 && Boolean(note) && createChargeSelectedRenterIds.length > 0;
  submitCreateCharge.disabled = createChargeSaving || !valid;
}

function mountCreateChargeMonthDropdown() {
  createChargeMonthDropdown.innerHTML = '';
  const state = getUiState();
  const options = getCreateChargeMonthOptions();
  const values = options.map((option) => option.value);
  const selectedMonth = values.includes(state.createChargeMonthKey) ? state.createChargeMonthKey : state.currentMonthKey;

  createChargeMonthControl = createDropdown({
    label: 'Choose month',
    options: options.map((option) => option.label),
    value: formatMonthLabel(selectedMonth),
    onChange: (label) => {
      const selectedOption = options.find((option) => option.label === label);
      if (selectedOption) {
        updateUiState({ createChargeMonthKey: selectedOption.value });
        updateCreateChargeSubmitState();
      }
    },
  });

  createChargeMonthDropdown.appendChild(createChargeMonthControl.element);
}

function openCreateChargePanel() {
  updateUiState({
    createChargeOpen: true,
    createChargeError: null,
    createChargeResult: null,
    createChargeMonthKey: getUiState().currentMonthKey,
    createChargeSelectedRenterIds: [],
    createChargeRenterSearch: '',
  });

  createChargeRenterSearch.value = '';
  createChargeAmount.value = '';
  createChargeNote.value = '';
  createChargePanel.classList.add('open');
  createChargeOverlay.classList.add('open');
  createChargePanel.setAttribute('aria-hidden', 'false');
  mountCreateChargeMonthDropdown();
  renderCreateChargeRenterList();
  setCreateChargeError('');
  setCreateChargeResult('');
  updateCreateChargeSubmitState();
}

function closeCreateChargePanel() {
  updateUiState({
    createChargeOpen: false,
    createChargeSaving: false,
    createChargeError: null,
    createChargeResult: null,
    createChargeSelectedRenterIds: [],
    createChargeRenterSearch: '',
  });

  createChargePanel.classList.remove('open');
  createChargeOverlay.classList.remove('open');
  createChargePanel.setAttribute('aria-hidden', 'true');
  createChargeForm.reset();
  setCreateChargeError('');
  setCreateChargeResult('');
  updateCreateChargeSubmitState();
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


async function markReminderSentForSelectedRenter(renterId) {
  const { currentUser } = getUiState();
  if (!currentUser || !renterId) throw new Error('No renter selected.');
  await events.logReminderSent(currentUser.uid, renterId, new Date());
}

async function archiveSelectedRenter() {
  const { currentUser, selectedRenterId } = getUiState();
  if (!currentUser || !selectedRenterId) return;

  await renters.archive(currentUser.uid, selectedRenterId);
  closeDrawer(drawerElement, overlayElement);
  stopMonthLedgerListener();
  stopHistoryListeners();
}

function renderSelectedRenterDrawer() {
  const {
    selectedRenterId,
    currentMonthKey,
    selectedRenterPayments,
    historyByMonth,
    historyLoadingByMonth,
    historyErrorByMonth,
    historyExpandedMonthKey,
    historyMonthKeys,
  } = getUiState();

  if (!selectedRenterId) return;

  const renter = getRenterById(selectedRenterId);
  if (!renter) {
    closeDrawer(drawerElement, overlayElement);
    stopMonthLedgerListener();
    stopHistoryListeners();
    return;
  }

  const summary = getRenterMonthSummary(selectedRenterId) || {
    monthKey: currentMonthKey,
    chargesTotal: 0,
    paymentsTotal: 0,
    remaining: 0,
    status: 'upcoming',
    dueDate: '',
    upcomingCharge: true,
    hasCharge: false,
  };

  renderRenterDrawer({
    drawerElement,
    overlayElement,
    renter: { ...renter, computedStatus: summary.status },
    currentMonthLabel: formatMonthLabel(currentMonthKey),
    currentMonthKey,
    monthSummary: summary,
    paymentsThisMonth: selectedRenterPayments,
    historyMonthKeys,
    historyByMonth,
    historyLoadingByMonth,
    historyErrorByMonth,
    historyExpandedMonthKey,
    monthLabelForKey: formatMonthLabel,
    onToggleHistoryMonth: (monthKey) => {
      updateUiState({
        historyExpandedMonthKey:
          getUiState().historyExpandedMonthKey === monthKey ? '' : monthKey,
      });
      renderSelectedRenterDrawer();
    },
    onArchiveRenter: archiveSelectedRenter,
    onSavePayment: savePaymentForSelectedRenter,
    onSaveNotes: saveNotesForSelectedRenter,
    onMarkReminderSent: markReminderSentForSelectedRenter,
  });
}

function stopMonthLedgerListener() {
  if (unsubscribeMonthLedgerListener) {
    unsubscribeMonthLedgerListener();
    unsubscribeMonthLedgerListener = null;
  }
  updateUiState({ selectedRenterPayments: [] });
}

function stopHistoryListeners() {
  historyUnsubscribers.forEach((unsubscribe) => unsubscribe());
  historyUnsubscribers = [];
}


function stopRemindersListener() {
  if (unsubscribeRemindersListener) {
    unsubscribeRemindersListener();
    unsubscribeRemindersListener = null;
  }

  updateUiState({ remindersByRenterForCurrentMonth: {}, reminderPopoverOpenForRenterId: null });
}

function startRemindersListener(uid) {
  stopRemindersListener();

  const monthKey = getUiState().currentMonthKey;
  unsubscribeRemindersListener = events.listenRemindersForMonth(uid, monthKey, (items) => {
    const grouped = items.reduce((acc, item) => {
      if (!item.renterId) return acc;
      if (!acc[item.renterId]) acc[item.renterId] = [];
      acc[item.renterId].push(item.sentAt || item.createdAt);
      return acc;
    }, {});

    updateUiState({ remindersByRenterForCurrentMonth: grouped });
    renderRenters();
  });
}

function startHistoryListenersForRenter(renterId) {
  stopHistoryListeners();

  const { currentUser, historyMonthKeys } = getUiState();
  if (!currentUser || !renterId) return;

  historyMonthKeys.forEach((monthKey) => {
    updateUiState({
      historyLoadingByMonth: { ...getUiState().historyLoadingByMonth, [monthKey]: true },
      historyErrorByMonth: { ...getUiState().historyErrorByMonth, [monthKey]: null },
    });

    let ledgerItems = [];
    let eventItems = [];

    const publishMerged = () => {
      const merged = mergeHistoryItems(ledgerItems, eventItems);
      updateUiState({
        historyByMonth: { ...getUiState().historyByMonth, [monthKey]: merged },
        historyLoadingByMonth: { ...getUiState().historyLoadingByMonth, [monthKey]: false },
      });
      renderSelectedRenterDrawer();
    };

    const ledgerUnsub = ledger.listenForRenterMonth(currentUser.uid, renterId, monthKey, (items) => {
      ledgerItems = items;
      publishMerged();
    });

    const eventsUnsub = events.listenForRenterMonth(currentUser.uid, renterId, monthKey, (items) => {
      eventItems = items;
      publishMerged();
    });

    historyUnsubscribers.push(ledgerUnsub, eventsUnsub);
  });
}

async function ensureMonthlyChargesForRenters(uid, renterRows) {
  await Promise.all(renterRows.map((renter) => billing.ensureMonthlyCharge(uid, renter)));
}

async function startMonthLedgerListenerForRenter(renterId) {
  stopMonthLedgerListener();

  const { currentUser, currentMonthKey } = getUiState();
  if (!currentUser || !renterId) return;

  const renter = getRenterById(renterId);
  if (renter) {
    await billing.ensureMonthlyCharge(currentUser.uid, renter);
  }

  unsubscribeMonthLedgerListener = ledger.listenForMonth(currentUser.uid, renterId, currentMonthKey, (entries) => {
    const renter = getRenterById(renterId);
    if (!renter) return;

    const monthSummary = summarizeCurrentMonth(renter, currentMonthKey, entries);
    const payments = entries.filter((entry) => entry.type === 'payment');

    updateUiState({
      selectedRenterMonthLedgerEntries: entries,
      selectedRenterPayments: payments,
      renterMonthSummaries: {
        ...getUiState().renterMonthSummaries,
        [renterId]: monthSummary,
      },
    });

    renderRenters();
    renderSelectedRenterDrawer();
  });
}

async function openRenterDrawer(renter) {
  const savedNotes = renter.notes || '';
  const historyMonthKeys = getDefaultHistoryMonthKeys();

  updateUiState({
    selectedRenterId: renter.id,
    notesDraft: savedNotes,
    notesSaved: savedNotes,
    notesDirty: false,
    notesSaving: false,
    notesSaveError: null,
    notesSaveSuccess: '',
    historyMonthKeys,
    historyExpandedMonthKey: historyMonthKeys[0],
    historyByMonth: {},
    historyLoadingByMonth: {},
    historyErrorByMonth: {},
  });

  await startMonthLedgerListenerForRenter(renter.id);
  startHistoryListenersForRenter(renter.id);
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

async function handleCreateChargeSubmit(event) {
  event.preventDefault();

  const state = getUiState();
  const { currentUser, createChargeSelectedRenterIds } = state;
  if (!currentUser) {
    setCreateChargeError('You must be signed in to create charges.');
    return;
  }

  const amount = Number(createChargeAmount.value || 0);
  const note = String(createChargeNote.value || '').trim();
  const appliesToMonthKey = state.createChargeMonthKey || state.currentMonthKey;

  if (!Number.isFinite(amount) || amount <= 0) {
    setCreateChargeError('Amount must be greater than 0.');
    return;
  }

  if (!note) {
    setCreateChargeError('Description / Note is required.');
    return;
  }

  if (!createChargeSelectedRenterIds.length) {
    setCreateChargeError('Select at least one renter.');
    return;
  }

  setCreateChargeError('');
  setCreateChargeResult('');
  setCreateChargeSaving(true);

  try {
    const result = await ledger.createChargeBulk(currentUser.uid, {
      renterIds: createChargeSelectedRenterIds,
      amount,
      note,
      appliesToMonthKey,
    });

    const createdMessage = `Charges created for ${result.created} renter${result.created === 1 ? '' : 's'}.`;
    const skippedMessage = result.skipped.length
      ? ` Skipped ${result.skipped.length}: ${result.skipped.map((item) => item.reason).join(' ')}`
      : '';

    setCreateChargeResult(`${createdMessage}${skippedMessage}`);
    updateUiState({
      createChargeResult: result,
      createChargeSelectedRenterIds: [],
      createChargeAmount: '',
      createChargeNote: '',
    });
    createChargeAmount.value = '';
    createChargeNote.value = '';
    renderCreateChargeRenterList();

    renderRenters();
  } catch (error) {
    setCreateChargeError(error?.message || 'Could not create charges. Please try again.');
  } finally {
    setCreateChargeSaving(false);
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

  if (currentUser) showDashboardView();
  else showAuthView();
}

async function startBusinessAndRenterDataFlow(user) {
  if (unsubscribeRentersListener) {
    unsubscribeRentersListener();
    unsubscribeRentersListener = null;
  }

  const userProfile = await business.get(user.uid);
  updateUiState({ businessProfile: userProfile });

  startRemindersListener(user.uid);

  unsubscribeRentersListener = renters.listen(user.uid, { status: 'active' }, async (renterRows) => {
    const selectedRenterId = getUiState().selectedRenterId;
    updateUiState({ renters: renterRows });

    await ensureMonthlyChargesForRenters(user.uid, renterRows);
    renderRenters();
    if (getUiState().createChargeOpen) renderCreateChargeRenterList();
    maybeOpenPendingRenter();

    if (selectedRenterId) {
      const selectedExists = renterRows.some((row) => row.id === selectedRenterId);
      if (selectedExists) {
        const selectedRenter = renterRows.find((row) => row.id === selectedRenterId);
        const currentState = getUiState();
        if (selectedRenter && !currentState.notesDirty) {
          const savedNotes = selectedRenter.notes || '';
          updateUiState({ notesSaved: savedNotes, notesDraft: savedNotes, notesSaveError: null });
        }
        renderSelectedRenterDrawer();
      } else {
        closeDrawer(drawerElement, overlayElement);
        stopMonthLedgerListener();
        stopHistoryListeners();
      }
    }
  });
}

function clearSignedOutDataFlow() {
  if (unsubscribeRentersListener) {
    unsubscribeRentersListener();
    unsubscribeRentersListener = null;
  }
  stopMonthLedgerListener();
  stopHistoryListeners();
  stopRemindersListener();

  updateUiState({
    renters: [],
    renterMonthSummaries: {},
    remindersByRenterForCurrentMonth: {},
    reminderPopoverOpenForRenterId: null,
    businessProfile: null,
    selectedRenterId: null,
    searchQuery: '',
    pendingOpenRenterId: null,
    historyExpandedMonthKey: '',
    historyByMonth: {},
    historyLoadingByMonth: {},
    historyErrorByMonth: {},
  });
}

function closeRenterDrawerFromUi() {
  closeDrawer(drawerElement, overlayElement);
  stopMonthLedgerListener();
  stopHistoryListeners();
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

  openCreateChargeButton.addEventListener('click', openCreateChargePanel);
  cancelCreateCharge.addEventListener('click', closeCreateChargePanel);
  cancelCreateChargeTop.addEventListener('click', closeCreateChargePanel);
  createChargeOverlay.addEventListener('click', closeCreateChargePanel);
  createChargeForm.addEventListener('submit', handleCreateChargeSubmit);
  createChargeRenterSearch.addEventListener('input', (event) => {
    updateUiState({ createChargeRenterSearch: event.target.value });
    renderCreateChargeRenterList();
  });

  createChargeAmount.addEventListener('input', () => {
    updateUiState({ createChargeAmount: createChargeAmount.value });
    updateCreateChargeSubmitState();
  });

  createChargeNote.addEventListener('input', () => {
    updateUiState({ createChargeNote: createChargeNote.value });
    updateCreateChargeSubmitState();
  });

  selectAllChargeRenters.addEventListener('click', () => {
    const ids = getChargeSearchFilteredRenters().map((renter) => renter.id);
    updateUiState({ createChargeSelectedRenterIds: ids });
    renderCreateChargeRenterList();
  });

  clearChargeRenters.addEventListener('click', () => {
    updateUiState({ createChargeSelectedRenterIds: [] });
    renderCreateChargeRenterList();
  });

  logoutMenuItem.addEventListener('click', async () => {
    await signOutUser();
    menuPopover.classList.remove('open');
  });

  document.addEventListener('click', (event) => {
    const clickWasInsideMenu = menuPopover.contains(event.target) || menuButton.contains(event.target);
    if (!clickWasInsideMenu) menuPopover.classList.remove('open');

    const clickedReminderUi = event.target.closest('.renter-reminder-wrap');
    if (!clickedReminderUi) closeReminderPopover();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menuPopover.classList.remove('open');
      closeRenterDrawerFromUi();
      closeCreateRenterPanel();
      closeCreateChargePanel();
      closeReminderPopover();
    }
  });
}

function startApp() {
  setupEvents();

  const currentMonth = monthKeyNow();
  updateUiState({
    currentMonthKey: currentMonth,
    selectedRenterPayments: [],
    selectedRenterMonthLedgerEntries: [],
    renterMonthSummaries: {},
    remindersByRenterForCurrentMonth: {},
    reminderPopoverOpenForRenterId: null,
    historyMonthKeys: [currentMonth, monthKeyOffset(currentMonth, -1), monthKeyOffset(currentMonth, -2)],
    createChargeMonthKey: currentMonth,
  });

  if (!firebaseReady) {
    updateUiState({
      authReady: true,
      authError: 'Firebase config is missing. Update js/appConfig.js with your project values to use sign in.',
    });
    renderAppShell();
    return;
  }

  listenToAuthChanges(async (user) => {
    updateUiState({ currentUser: user, authReady: true, authError: '' });

    if (user) await startBusinessAndRenterDataFlow(user);
    else clearSignedOutDataFlow();

    renderAppShell();
  });
}

startApp();
