import { createRenterShape } from './dataModel.js';
import { billing, events as eventDb, ledger as ledgerDb, renters as renterDb, seedInMemoryDb } from './db.js';
import { getUiState, updateUiState } from './uiStore.js';
import { createRenterCard } from './components/renterCard.js';
import { closeDrawer, renderRenterDrawer } from './components/drawer.js';

const CURRENT_USER_UID = 'demo-user-1';

const initialRenters = [
  createRenterShape({
    id: 'r1',
    name: 'Ari Johnson',
    email: 'ari@example.com',
    phone: '312-555-1111',
    monthlyRent: 900,
    dueDayOfMonth: 5,
    color: '#DDF3E6',
    gradeScore: 94,
    gradeLetter: 'A',
    status: 'active',
  }),
  createRenterShape({
    id: 'r2',
    name: 'Mina Patel',
    email: 'mina@example.com',
    phone: '312-555-2222',
    monthlyRent: 1050,
    dueDayOfMonth: 12,
    color: '#F3E4DD',
    gradeScore: 84,
    gradeLetter: 'B',
    status: 'active',
  }),
  createRenterShape({
    id: 'r3',
    name: 'Jules Carter',
    email: 'jules@example.com',
    phone: '312-555-3333',
    monthlyRent: 780,
    dueDayOfMonth: 20,
    color: '#DEEAF9',
    gradeScore: 72,
    gradeLetter: 'C',
    status: 'active',
  }),
];

const seededLedgerEntries = [
  { id: 'l1', userUid: CURRENT_USER_UID, renterId: 'r1', type: 'payment', amount: 300, appliesToMonthKey: '2026-02', date: '2026-02-02', note: 'Card payment' },
  { id: 'l2', userUid: CURRENT_USER_UID, renterId: 'r1', type: 'payment', amount: 250, appliesToMonthKey: '2026-02', date: '2026-02-10', note: 'Cash App payment' },
  { id: 'l3', userUid: CURRENT_USER_UID, renterId: 'r2', type: 'payment', amount: 400, appliesToMonthKey: '2026-02', date: '2026-02-06', note: 'Partial payment' },
  { id: 'l4', userUid: CURRENT_USER_UID, renterId: 'r3', type: 'payment', amount: 180, appliesToMonthKey: '2026-02', date: '2026-02-01', note: 'Weekly payment' },
  { id: 'l5', userUid: CURRENT_USER_UID, renterId: 'r3', type: 'payment', amount: 180, appliesToMonthKey: '2026-02', date: '2026-02-08', note: 'Weekly payment' },
];

const reminderEventsByRenterId = {};
const ledgerByRenterId = {};
let activeRenters = [];

const rentersListElement = document.getElementById('rentersList');
const searchInput = document.getElementById('searchInput');
const drawerElement = document.getElementById('renterDrawer');
const overlayElement = document.getElementById('drawerOverlay');
const menuButton = document.getElementById('menuButton');
const menuPopover = document.getElementById('menuPopover');
const railArchiveButton = document.getElementById('railArchiveButton');
const menuArchiveButton = document.getElementById('menuArchiveButton');
const archivePanelElement = document.getElementById('archivePanel');
const archiveContentElement = document.getElementById('archiveContent');
const closeArchivePanelButton = document.getElementById('closeArchivePanelButton');

let removeReminderListener = null;
let removeActiveRentersListener = null;
let removeArchivedRentersListener = null;

seedInMemoryDb(CURRENT_USER_UID, {
  renters: initialRenters,
  ledger: seededLedgerEntries,
});

function getCurrentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function toSafeDate(value) {
  if (!value) {
    return new Date(0);
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }

  return parsed;
}

function formatMonthLabelFromMonthKey(monthKey) {
  if (!monthKey || typeof monthKey !== 'string' || !monthKey.includes('-')) {
    return 'Unknown month';
  }

  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown month';
  }

  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('open'));
  window.setTimeout(() => {
    toast.classList.remove('open');
    window.setTimeout(() => toast.remove(), 180);
  }, 1800);
}

function computeStatusForRenter(renter, monthKey) {
  const entries = ledgerByRenterId[renter.id] || [];

  const chargesTotal = entries
    .filter((entry) => entry.type === 'charge' && entry.appliesToMonthKey === monthKey)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const paymentsTotal = entries
    .filter((entry) => entry.type === 'payment' && entry.appliesToMonthKey === monthKey)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const remaining = Math.max(0, chargesTotal - paymentsTotal);
  const now = new Date();

  if (remaining === 0 && chargesTotal > 0) {
    return { label: 'paid', chargesTotal, paymentsTotal, remaining };
  }

  if (paymentsTotal > 0 && remaining > 0) {
    return { label: 'partial', chargesTotal, paymentsTotal, remaining };
  }

  if (now.getDate() > Number(renter.dueDayOfMonth) && remaining > 0) {
    return { label: 'overdue', chargesTotal, paymentsTotal, remaining };
  }

  if (now.getDate() === Number(renter.dueDayOfMonth) && remaining > 0) {
    return { label: 'due', chargesTotal, paymentsTotal, remaining };
  }

  return { label: 'upcoming', chargesTotal, paymentsTotal, remaining };
}

async function refreshRenterLedger(renterId) {
  const entries = await ledgerDb.listByRenter(CURRENT_USER_UID, renterId);
  ledgerByRenterId[renterId] = entries;
}

function getHistoryByMonthWithMergedData(renterId) {
  const mergedHistory = {};

  const ledgerEntries = ledgerByRenterId[renterId] || [];
  ledgerEntries.forEach((entry) => {
    const monthLabel = formatMonthLabelFromMonthKey(entry.appliesToMonthKey);
    if (!mergedHistory[monthLabel]) {
      mergedHistory[monthLabel] = [];
    }

    mergedHistory[monthLabel].push({
      date: entry.date || entry.createdAt,
      type: entry.type === 'charge' ? 'Charge' : 'Payment',
      amount: Number(entry.amount || 0),
      note: entry.note || '',
    });
  });

  const reminderEvents = reminderEventsByRenterId[renterId] || [];
  reminderEvents.forEach((eventData) => {
    const monthLabel = formatMonthLabelFromMonthKey(eventData.monthKey);
    if (!mergedHistory[monthLabel]) {
      mergedHistory[monthLabel] = [];
    }

    mergedHistory[monthLabel].push({
      date: eventData.sentAt || eventData.createdAt,
      type: 'Reminder marked sent',
      note: eventData.message || '',
    });
  });

  Object.keys(mergedHistory).forEach((monthLabel) => {
    mergedHistory[monthLabel].sort((a, b) => toSafeDate(b.date) - toSafeDate(a.date));
  });

  return mergedHistory;
}

function getRenterById(renterId) {
  return activeRenters.find((renter) => renter.id === renterId)
    || getUiState().archivedRenters.find((renter) => renter.id === renterId)
    || null;
}

function renderRenters() {
  const { searchText, remindersByRenterForCurrentMonth, reminderPopoverOpenForRenterId, archiveOpen } = getUiState();
  const normalizedSearch = searchText.trim().toLowerCase();
  const monthKey = getCurrentMonthKey();

  if (archiveOpen) {
    rentersListElement.classList.add('hidden-panel');
    archivePanelElement.classList.remove('hidden-panel');
    return;
  }

  rentersListElement.classList.remove('hidden-panel');
  archivePanelElement.classList.add('hidden-panel');

  const visibleRenters = activeRenters
    .filter((renter) => renter.name.toLowerCase().includes(normalizedSearch))
    .map((renter) => {
      const status = computeStatusForRenter(renter, monthKey);
      return {
        ...renter,
        statusLabel: status.label,
      };
    });

  rentersListElement.innerHTML = '';
  visibleRenters.forEach((renter) => {
    const reminderDatesForMonth = remindersByRenterForCurrentMonth[renter.id] || [];

    const card = createRenterCard({
      renter,
      reminderDatesForMonth,
      isReminderPopoverOpen: reminderPopoverOpenForRenterId === renter.id,
      onCardClick: openRenterDrawer,
      onReminderDotClick: toggleReminderPopover,
    });

    rentersListElement.appendChild(card);
  });
}

function renderArchivePanel() {
  const uiState = getUiState();
  const archivedRenters = uiState.archivedRenters;

  archiveContentElement.innerHTML = '';

  if (uiState.archiveLoading) {
    archiveContentElement.textContent = 'Loading archived renters...';
    return;
  }

  if (uiState.archiveError) {
    archiveContentElement.textContent = uiState.archiveError;
    return;
  }

  if (archivedRenters.length === 0) {
    archiveContentElement.textContent = 'No archived renters yet.';
    return;
  }

  archivedRenters.forEach((renter) => {
    const row = document.createElement('div');
    row.className = 'archive-row';

    const info = document.createElement('div');
    info.className = 'archive-row-info';
    info.innerHTML = `<strong>${renter.name}</strong><div>${renter.email || renter.phone || ''}</div><span class="archive-badge">Archived</span>`;

    const actions = document.createElement('div');
    actions.className = 'archive-row-actions';

    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'btn';
    restoreButton.textContent = 'Restore';
    restoreButton.addEventListener('click', async () => {
      try {
        const result = await renterDb.restore(CURRENT_USER_UID, renter.id);
        if (!result.ok) {
          showToast(result.error || 'Unable to restore renter.');
          return;
        }

        showToast('Renter restored.');
      } catch (error) {
        showToast(`Unable to restore renter: ${error.message}`);
      }
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn-danger-text';
    deleteButton.textContent = 'Permanently Delete';
    deleteButton.addEventListener('click', () => {
      updateUiState({
        deleteConfirmOpen: true,
        deleteTargetRenterId: renter.id,
        deleteConfirmText: '',
        deleteError: null,
      });
      renderArchivePanel();
    });

    actions.append(restoreButton, deleteButton);
    row.append(info, actions);
    archiveContentElement.appendChild(row);
  });

  if (uiState.deleteConfirmOpen && uiState.deleteTargetRenterId) {
    const renter = archivedRenters.find((item) => item.id === uiState.deleteTargetRenterId);
    if (!renter) {
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'archive-delete-modal';
    const matches = uiState.deleteConfirmText.trim() === renter.name;

    modal.innerHTML = `
      <h4>Permanently delete ${renter.name}? This cannot be undone.</h4>
      <p>Type the renter's name to confirm:</p>
    `;

    const input = document.createElement('input');
    input.className = 'search-input';
    input.placeholder = renter.name;
    input.value = uiState.deleteConfirmText;
    input.addEventListener('input', (event) => {
      updateUiState({ deleteConfirmText: event.target.value, deleteError: null });
      renderArchivePanel();
    });

    const actions = document.createElement('div');
    actions.className = 'archive-row-actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'btn';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
      updateUiState({
        deleteConfirmOpen: false,
        deleteTargetRenterId: null,
        deleteConfirmText: '',
        deleteWorking: false,
        deleteError: null,
        deleteProgress: 0,
      });
      renderArchivePanel();
    });

    const confirmDeleteButton = document.createElement('button');
    confirmDeleteButton.type = 'button';
    confirmDeleteButton.className = 'btn btn-danger-text';
    confirmDeleteButton.textContent = uiState.deleteWorking ? 'Deleting...' : 'Permanently Delete';
    confirmDeleteButton.disabled = !matches || uiState.deleteWorking;
    confirmDeleteButton.addEventListener('click', async () => {
      updateUiState({ deleteWorking: true, deleteProgress: 1, deleteError: null });
      renderArchivePanel();

      try {
        const result = await renterDb.permanentlyDelete(CURRENT_USER_UID, renter.id);

        if (!result.deletedRenter) {
          updateUiState({ deleteError: 'Failed to delete renter.', deleteWorking: false });
          renderArchivePanel();
          return;
        }

        delete reminderEventsByRenterId[renter.id];
        delete ledgerByRenterId[renter.id];

        updateUiState({
          deleteConfirmOpen: false,
          deleteTargetRenterId: null,
          deleteConfirmText: '',
          deleteWorking: false,
          deleteProgress: result.deletedEvents + result.deletedLedger + 1,
        });

        showToast(`Deleted renter, ${result.deletedEvents} events, ${result.deletedLedger} ledger entries.`);
      } catch (error) {
        updateUiState({ deleteError: `Delete failed: ${error.message}`, deleteWorking: false });
      }

      renderArchivePanel();
      renderRenters();
    });

    actions.append(cancelButton, confirmDeleteButton);

    if (uiState.deleteError) {
      const errorLine = document.createElement('p');
      errorLine.className = 'btn-danger-text';
      errorLine.textContent = uiState.deleteError;
      modal.appendChild(errorLine);
    }

    modal.append(input, actions);
    archiveContentElement.appendChild(modal);
  }
}

async function ensureChargeAndLedgerRefreshForRenter(renter) {
  await billing.ensureMonthlyCharge(CURRENT_USER_UID, renter, new Date());
  await refreshRenterLedger(renter.id);
}

async function openRenterDrawer(renter) {
  updateUiState({ selectedRenterId: renter.id });

  await ensureChargeAndLedgerRefreshForRenter(renter);

  const monthKey = getCurrentMonthKey();
  const paymentsThisMonth = (ledgerByRenterId[renter.id] || [])
    .filter((entry) => entry.type === 'payment' && entry.appliesToMonthKey === monthKey)
    .map((entry) => ({
      amount: Number(entry.amount || 0),
      method: entry.method || 'Recorded payment',
      note: entry.note || '',
      date: toSafeDate(entry.date || entry.createdAt).toISOString().slice(0, 10),
    }));

  renderRenterDrawer({
    drawerElement,
    overlayElement,
    renter,
    paymentsThisMonth,
    historyByMonth: getHistoryByMonthWithMergedData(renter.id),
    onMarkReminderSent: markReminderSent,
    onArchiveRenter: archiveRenterFromDrawer,
  });
}

async function rerenderOpenDrawerIfNeeded() {
  const { selectedRenterId, drawerOpen } = getUiState();
  if (!drawerOpen || !selectedRenterId) {
    return;
  }

  const renter = getRenterById(selectedRenterId);
  if (!renter || renter.status !== 'active') {
    closeDrawer(drawerElement, overlayElement);
    return;
  }

  await openRenterDrawer(renter);
}

async function archiveRenterFromDrawer(renterId) {
  try {
    const result = await renterDb.archive(CURRENT_USER_UID, renterId);
    if (!result.ok) {
      showToast(result.error || 'Unable to archive renter.');
      return;
    }

    closeDrawer(drawerElement, overlayElement);
    showToast('Renter archived.');
  } catch (error) {
    showToast(`Unable to archive renter: ${error.message}`);
  }
}

async function markReminderSent(renterId) {
  await eventDb.logReminderSent(CURRENT_USER_UID, renterId, new Date());
  showToast('Reminder marked sent.');
}

function toggleReminderPopover(renterId) {
  const { reminderPopoverOpenForRenterId } = getUiState();
  updateUiState({ reminderPopoverOpenForRenterId: reminderPopoverOpenForRenterId === renterId ? null : renterId });
  renderRenters();
}

function startReminderListener() {
  const monthKey = getCurrentMonthKey();

  if (removeReminderListener) {
    removeReminderListener();
  }

  removeReminderListener = eventDb.listenRemindersForMonth(CURRENT_USER_UID, monthKey, (eventsForMonth) => {
    const grouped = {};
    const allByRenter = {};

    eventsForMonth.forEach((eventData) => {
      if (!grouped[eventData.renterId]) {
        grouped[eventData.renterId] = [];
      }
      grouped[eventData.renterId].push(eventData.sentAt);

      if (!allByRenter[eventData.renterId]) {
        allByRenter[eventData.renterId] = [];
      }
      allByRenter[eventData.renterId].push(eventData);
    });

    Object.keys(grouped).forEach((renterId) => grouped[renterId].sort((a, b) => toSafeDate(b) - toSafeDate(a)));

    Object.keys(allByRenter).forEach((renterId) => {
      allByRenter[renterId].sort((a, b) => toSafeDate(b.sentAt) - toSafeDate(a.sentAt));
      reminderEventsByRenterId[renterId] = allByRenter[renterId];
    });

    updateUiState({ remindersByRenterForCurrentMonth: grouped });
    renderRenters();
    rerenderOpenDrawerIfNeeded();
  });
}

async function startRenterListeners() {
  updateUiState({ archiveLoading: true, archiveError: null });

  if (removeActiveRentersListener) {
    removeActiveRentersListener();
  }

  if (removeArchivedRentersListener) {
    removeArchivedRentersListener();
  }

  removeActiveRentersListener = renterDb.listen(CURRENT_USER_UID, { status: 'active' }, async (nextRenters) => {
    activeRenters = nextRenters;

    for (let index = 0; index < activeRenters.length; index += 1) {
      const renter = activeRenters[index];
      await ensureChargeAndLedgerRefreshForRenter(renter);
    }

    renderRenters();
    rerenderOpenDrawerIfNeeded();
  });

  removeArchivedRentersListener = renterDb.listen(CURRENT_USER_UID, { status: 'archived' }, (nextRenters) => {
    updateUiState({ archivedRenters: nextRenters, archiveLoading: false, archiveError: null });
    renderArchivePanel();
  });
}

function openArchivePanel() {
  updateUiState({
    archiveOpen: true,
    deleteConfirmOpen: false,
    deleteTargetRenterId: null,
    deleteConfirmText: '',
  });
  menuPopover.classList.remove('open');
  renderArchivePanel();
  renderRenters();
}

function closeArchivePanel() {
  updateUiState({ archiveOpen: false });
  renderRenters();
}

function setupEvents() {
  searchInput.addEventListener('input', (event) => {
    updateUiState({ searchText: event.target.value });
    renderRenters();
  });

  overlayElement.addEventListener('click', () => closeDrawer(drawerElement, overlayElement));
  railArchiveButton.addEventListener('click', openArchivePanel);
  menuArchiveButton.addEventListener('click', openArchivePanel);
  closeArchivePanelButton.addEventListener('click', closeArchivePanel);

  menuButton.addEventListener('click', () => menuPopover.classList.toggle('open'));

  document.addEventListener('click', (event) => {
    const clickWasInsideMenu = menuPopover.contains(event.target) || menuButton.contains(event.target);
    if (!clickWasInsideMenu) {
      menuPopover.classList.remove('open');
    }

    const clickWasInsideReminderPopover = event.target.closest('.reminder-indicator-wrap');
    if (!clickWasInsideReminderPopover && getUiState().reminderPopoverOpenForRenterId) {
      updateUiState({ reminderPopoverOpenForRenterId: null });
      renderRenters();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menuPopover.classList.remove('open');
      closeDrawer(drawerElement, overlayElement);
      if (getUiState().reminderPopoverOpenForRenterId) {
        updateUiState({ reminderPopoverOpenForRenterId: null });
        renderRenters();
      }
    }
  });
}

async function startApp() {
  await startRenterListeners();
  startReminderListener();
  renderRenters();
  setupEvents();
}

startApp();
