import { createRenterShape } from './dataModel.js';
import { events as eventDb } from './db.js';
import { getUiState, updateUiState } from './uiStore.js';
import { createRenterCard } from './components/renterCard.js';
import { closeDrawer, renderRenterDrawer } from './components/drawer.js';

const CURRENT_USER_UID = 'demo-user-1';

const renters = [
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

const paymentsByRenterId = {
  r1: [
    { id: 'l1', renterId: 'r1', amount: 300, method: 'Card', note: 'First installment', date: '2026-02-02' },
    { id: 'l2', renterId: 'r1', amount: 250, method: 'Cash App', note: 'Mid-month', date: '2026-02-10' },
  ],
  r2: [{ id: 'l3', renterId: 'r2', amount: 400, method: 'Venmo', note: 'Partial payment', date: '2026-02-06' }],
  r3: [
    { id: 'l4', renterId: 'r3', amount: 180, method: 'Cash', note: 'Weekly payment', date: '2026-02-01' },
    { id: 'l5', renterId: 'r3', amount: 180, method: 'Cash', note: 'Weekly payment', date: '2026-02-08' },
  ],
};

const baseHistoryByRenterId = {
  r1: {
    'February 2026': [
      { date: '2026-02-02', type: 'Payment', amount: 300, note: 'Card payment' },
      { date: '2026-02-10', type: 'Payment', amount: 250, note: 'Cash App payment' },
    ],
  },
  r2: {
    'February 2026': [{ date: '2026-02-06', type: 'Payment', amount: 400, note: 'Partial' }],
  },
  r3: {
    'February 2026': [
      { date: '2026-02-01', type: 'Payment', amount: 180, note: 'Cash' },
      { date: '2026-02-08', type: 'Payment', amount: 180, note: 'Cash' },
    ],
  },
};

const reminderEventsByRenterId = {};

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

let removeReminderListener = null;
let removeActiveRentersListener = null;
let removeArchivedRentersListener = null;

seedInMemoryDb(CURRENT_USER_UID, {
  renters: initialRenters,
  ledger: Object.values(paymentsByRenterId).flat(),
});

function getCurrentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function formatMonthLabel(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
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

function getHistoryByMonthWithReminders(renterId) {
  const baseHistory = baseHistoryByRenterId[renterId] || {};
  const mergedHistory = JSON.parse(JSON.stringify(baseHistory));
  const reminderEvents = reminderEventsByRenterId[renterId] || [];

  reminderEvents.forEach((eventData) => {
    const monthLabel = formatMonthLabel(eventData.sentAt);
    if (!mergedHistory[monthLabel]) {
      mergedHistory[monthLabel] = [];
    }

    mergedHistory[monthLabel].push({
      date: eventData.sentAt,
      type: 'Reminder marked sent',
      note: eventData.message || '',
    });
  });

  Object.keys(mergedHistory).forEach((monthLabel) => {
    mergedHistory[monthLabel].sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  return mergedHistory;
}

function getRenterById(renterId) {
  return activeRenters.find((renter) => renter.id === renterId)
    || getUiState().archivedRenters.find((renter) => renter.id === renterId)
    || null;
}

let removeReminderListener = null;

function getCurrentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function formatMonthLabel(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('open');
  });

  window.setTimeout(() => {
    toast.classList.remove('open');
    window.setTimeout(() => toast.remove(), 180);
  }, 1800);
}

function getHistoryByMonthWithReminders(renterId) {
  const baseHistory = baseHistoryByRenterId[renterId] || {};
  const mergedHistory = JSON.parse(JSON.stringify(baseHistory));
  const reminderEvents = reminderEventsByRenterId[renterId] || [];

  reminderEvents.forEach((eventData) => {
    const monthLabel = formatMonthLabel(eventData.sentAt);
    if (!mergedHistory[monthLabel]) {
      mergedHistory[monthLabel] = [];
    }

    mergedHistory[monthLabel].push({
      date: eventData.sentAt,
      type: 'Reminder marked sent',
      note: eventData.message || '',
    });
  });

  Object.keys(mergedHistory).forEach((monthLabel) => {
    mergedHistory[monthLabel].sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  return mergedHistory;
}

function getRenterById(renterId) {
  return renters.find((renter) => renter.id === renterId) || null;
}

function renderRenters() {
  const { searchText, remindersByRenterForCurrentMonth, reminderPopoverOpenForRenterId } = getUiState();
  const normalizedSearch = searchText.trim().toLowerCase();

  if (archiveOpen) {
    rentersListElement.classList.add('hidden-panel');
    archivePanelElement.classList.remove('hidden-panel');
    return;
  }

  rentersListElement.classList.remove('hidden-panel');
  archivePanelElement.classList.add('hidden-panel');

  const visibleRenters = activeRenters.filter((renter) => renter.name.toLowerCase().includes(normalizedSearch));

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
      await renterDb.restore(CURRENT_USER_UID, renter.id);
      showToast('Renter restored.');
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

      const result = await renterDb.permanentlyDelete(CURRENT_USER_UID, renter.id);

      if (!result.deletedRenter) {
        updateUiState({ deleteError: 'Failed to delete renter.', deleteWorking: false });
        renderArchivePanel();
        return;
      }

      delete reminderEventsByRenterId[renter.id];
      delete baseHistoryByRenterId[renter.id];
      delete paymentsByRenterId[renter.id];

      updateUiState({
        deleteConfirmOpen: false,
        deleteTargetRenterId: null,
        deleteConfirmText: '',
        deleteWorking: false,
        deleteProgress: result.deletedEvents + result.deletedLedger + 1,
      });

      showToast(`Deleted renter, ${result.deletedEvents} events, ${result.deletedLedger} ledger entries.`);
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

function openRenterDrawer(renter) {
  updateUiState({ selectedRenterId: renter.id });
  await ensureChargeAndLedgerRefreshForRenter(renter);

  const monthKey = getCurrentMonthKey();
  const paymentsThisMonth = (ledgerByRenterId[renter.id] || [])
    .filter((entry) => entry.type === 'payment' && entry.appliesToMonthKey === monthKey)
    .map((entry) => ({ amount: Number(entry.amount || 0), method: entry.method || 'Recorded payment', note: entry.note || '', date: toSafeDate(entry.date || entry.createdAt).toISOString().slice(0, 10) }));

  renderRenterDrawer({
    drawerElement,
    overlayElement,
    renter,
    paymentsThisMonth: paymentsByRenterId[renter.id] || [],
    historyByMonth: getHistoryByMonthWithReminders(renter.id),
    onMarkReminderSent: markReminderSent,
  });
}

function rerenderOpenDrawerIfNeeded() {
  const { selectedRenterId, drawerOpen } = getUiState();
  if (!drawerOpen || !selectedRenterId) {
    return;
  }

  const renter = getRenterById(selectedRenterId);
  if (!renter) {
    return;
  }

  openRenterDrawer(renter);
}

async function markReminderSent(renterId) {
  const sentAt = new Date();
  await eventDb.logReminderSent(CURRENT_USER_UID, renterId, sentAt);
  showToast('Reminder marked sent.');
}

function toggleReminderPopover(renterId) {
  const { reminderPopoverOpenForRenterId } = getUiState();
  const nextValue = reminderPopoverOpenForRenterId === renterId ? null : renterId;
  updateUiState({ reminderPopoverOpenForRenterId: nextValue });
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

    Object.keys(grouped).forEach((renterId) => {
      grouped[renterId].sort((a, b) => new Date(b) - new Date(a));
    });

    Object.keys(allByRenter).forEach((renterId) => {
      allByRenter[renterId].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
      reminderEventsByRenterId[renterId] = allByRenter[renterId];
    });

    updateUiState({ remindersByRenterForCurrentMonth: grouped });
    renderRenters();
    rerenderOpenDrawerIfNeeded();
  });
}

function rerenderOpenDrawerIfNeeded() {
  const { selectedRenterId, drawerOpen } = getUiState();
  if (!drawerOpen || !selectedRenterId) {
    return;
  }

  const renter = getRenterById(selectedRenterId);
  if (!renter || renter.status !== 'active') {
    closeDrawer(drawerElement, overlayElement);
    return;
  }

  openRenterDrawer(renter);
}

async function archiveRenterFromDrawer(renterId) {
  await renterDb.archive(CURRENT_USER_UID, renterId);
  closeDrawer(drawerElement, overlayElement);
  showToast('Renter archived.');
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

    Object.keys(grouped).forEach((renterId) => grouped[renterId].sort((a, b) => new Date(b) - new Date(a)));
    Object.keys(allByRenter).forEach((renterId) => {
      allByRenter[renterId].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
      reminderEventsByRenterId[renterId] = allByRenter[renterId];
    });

    updateUiState({ remindersByRenterForCurrentMonth: grouped });
    renderRenters();
    rerenderOpenDrawerIfNeeded();
  });
}

function startRenterListeners() {
  updateUiState({ archiveLoading: true, archiveError: null });

  if (removeActiveRentersListener) {
    removeActiveRentersListener();
  }
  if (removeArchivedRentersListener) {
    removeArchivedRentersListener();
  }

  removeActiveRentersListener = renterDb.listen(CURRENT_USER_UID, { status: 'active' }, (nextRenters) => {
    activeRenters = nextRenters;
    renderRenters();
    rerenderOpenDrawerIfNeeded();
  });

  removeArchivedRentersListener = renterDb.listen(CURRENT_USER_UID, { status: 'archived' }, (nextRenters) => {
    updateUiState({ archivedRenters: nextRenters, archiveLoading: false, archiveError: null });
    renderArchivePanel();
  });
  renderSettingsPanel();
}

async function saveBusinessSettings() {
  const uiState = getUiState();

  if (!uiState.businessDraft.businessName.trim()) {
    updateUiState({ settingsError: 'Business name is required.' });
    renderSettingsPanel();
    return;
  }

  updateUiState({ settingsSaving: true, settingsError: null, settingsSavedNotice: false });
  renderSettingsPanel();

  try {
    const saved = await business.update(CURRENT_USER_UID, uiState.businessDraft);
    updateUiState({
      businessSaved: { ...saved },
      businessDraft: { ...saved },
      businessDirty: false,
      settingsSaving: false,
      settingsSavedNotice: true,
    });
    showToast('Settings saved.');
  } catch (error) {
    updateUiState({ settingsSaving: false, settingsError: `Unable to save settings: ${error.message}` });
  }

  renderSettingsPanel();
}

function cancelBusinessSettings() {
  const uiState = getUiState();
  updateUiState({ businessDraft: { ...uiState.businessSaved }, businessDirty: false, settingsError: null, settingsSavedNotice: false });
  renderSettingsPanel();
}

async function handleLogoSelected(file) {
  if (!file) {
    return;
  }

  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    updateUiState({ logoError: 'Only PNG, JPG, and WEBP files are allowed.' });
    renderSettingsPanel();
    return;
  }

  if (file.size > MAX_LOGO_BYTES) {
    updateUiState({ logoError: 'Logo must be 3MB or smaller.' });
    renderSettingsPanel();
    return;
  }

  updateUiState({ logoUploading: true, logoProgress: 0, logoError: null, settingsSavedNotice: false });
  renderSettingsPanel();

  try {
    const result = await branding.uploadLogo(CURRENT_USER_UID, file, (percent) => {
      updateUiState({ logoProgress: percent });
      renderSettingsPanel();
    });

    const updatedProfile = await business.get(CURRENT_USER_UID);
    const mergedDraft = { ...updatedProfile, logoUrl: result.logoUrl || updatedProfile.logoUrl || '' };

    updateUiState({
      businessSaved: { ...mergedDraft },
      businessDraft: { ...mergedDraft },
      businessDirty: false,
      logoUploading: false,
      logoProgress: 100,
      logoError: null,
      settingsSavedNotice: true,
    });

    showToast('Logo uploaded.');
  } catch (error) {
    updateUiState({ logoUploading: false, logoError: `Upload failed: ${error.message}` });
  }

  renderSettingsPanel();
}

function openArchivePanel() {
  updateUiState({ archiveOpen: true, deleteConfirmOpen: false, deleteTargetRenterId: null, deleteConfirmText: '' });
  menuPopover.classList.remove('open');
  renderArchivePanel();
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

  menuButton.addEventListener('click', () => menuPopover.classList.toggle('open'));

  logoFileInput.addEventListener('change', (event) => {
    const [file] = event.target.files || [];
    handleLogoSelected(file);
  });

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

function startApp() {
  startReminderListener();
  renderRenters();
  setupEvents();
}

startApp();
