import { createRenterShape } from './dataModel.js';
import {
  billing,
  branding,
  business,
  events as eventDb,
  invites as inviteDb,
  ledger as ledgerDb,
  renters as renterDb,
  seedInMemoryDb,
} from './db.js';
import { getUiState, updateUiState } from './uiStore.js';
import { createRenterCard } from './components/renterCard.js';
import { closeDrawer, renderRenterDrawer } from './components/drawer.js';

const CURRENT_USER_UID = 'demo-user-1';
const CURRENT_USER_EMAIL = 'owner@example.com';
const MAX_LOGO_BYTES = 3 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const initialRenters = [
  createRenterShape({ id: 'r1', name: 'Ari Johnson', email: 'ari@example.com', phone: '312-555-1111', monthlyRent: 900, dueDayOfMonth: 5, color: '#DDF3E6', gradeScore: 94, gradeLetter: 'A', status: 'active' }),
  createRenterShape({ id: 'r2', name: 'Mina Patel', email: 'mina@example.com', phone: '312-555-2222', monthlyRent: 1050, dueDayOfMonth: 12, color: '#F3E4DD', gradeScore: 84, gradeLetter: 'B', status: 'active' }),
  createRenterShape({ id: 'r3', name: 'Jules Carter', email: 'jules@example.com', phone: '312-555-3333', monthlyRent: 780, dueDayOfMonth: 20, color: '#DEEAF9', gradeScore: 72, gradeLetter: 'C', status: 'active' }),
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
let removeInviteListener = null;

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
const railSettingsButton = document.getElementById('railSettingsButton');
const menuSettingsButton = document.getElementById('menuSettingsButton');
const settingsPanelElement = document.getElementById('settingsPanel');
const closeSettingsPanelButton = document.getElementById('closeSettingsPanelButton');

const settingsFieldMap = {
  businessName: document.getElementById('businessNameInput'),
  phone: document.getElementById('businessPhoneInput'),
  address1: document.getElementById('businessAddress1Input'),
  address2: document.getElementById('businessAddress2Input'),
  city: document.getElementById('businessCityInput'),
  state: document.getElementById('businessStateInput'),
  zip: document.getElementById('businessZipInput'),
};

const saveSettingsButton = document.getElementById('saveSettingsButton');
const cancelSettingsButton = document.getElementById('cancelSettingsButton');
const settingsSavedNotice = document.getElementById('settingsSavedNotice');
const settingsError = document.getElementById('settingsError');
const logoFileInput = document.getElementById('logoFileInput');
const uploadLogoButton = document.getElementById('uploadLogoButton');
const logoProgressText = document.getElementById('logoProgressText');
const logoError = document.getElementById('logoError');
const logoPreviewImage = document.getElementById('logoPreviewImage');
const receiptPreviewLogo = document.getElementById('receiptPreviewLogo');
const receiptPreviewBusinessName = document.getElementById('receiptPreviewBusinessName');
const receiptPreviewPhone = document.getElementById('receiptPreviewPhone');
const receiptPreviewLocation = document.getElementById('receiptPreviewLocation');
const inviteEmailInput = document.getElementById('inviteEmailInput');
const sendInviteButton = document.getElementById('sendInviteButton');
const inviteSuccessNotice = document.getElementById('inviteSuccessNotice');
const inviteError = document.getElementById('inviteError');
const inviteList = document.getElementById('inviteList');

let removeReminderListener = null;
let removeActiveRentersListener = null;
let removeArchivedRentersListener = null;

seedInMemoryDb(CURRENT_USER_UID, { renters: initialRenters, ledger: seededLedgerEntries });

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(toSafeDate(value));
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
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function formatMonthLabelFromMonthKey(monthKey) {
  if (!monthKey || !monthKey.includes('-')) {
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

function draftEqualsSaved(saved, draft) {
  return JSON.stringify(saved) === JSON.stringify(draft);
}

function statusPillClass(status) {
  if (status === 'accepted') {
    return 'invite-status invite-status-accepted';
  }

  if (status === 'revoked') {
    return 'invite-status invite-status-revoked';
  }

  return 'invite-status invite-status-pending';
}

function renderInvitesList() {
  const uiState = getUiState();
  inviteList.innerHTML = '';

  if (uiState.invitesLoading) {
    inviteList.textContent = 'Loading invites...';
    return;
  }

  if (uiState.invites.length === 0) {
    inviteList.textContent = 'No invites yet.';
    return;
  }

  uiState.invites.forEach((invite) => {
    const row = document.createElement('div');
    row.className = 'invite-row';

    const left = document.createElement('div');
    left.className = 'invite-row-left';
    left.innerHTML = `
      <strong>${invite.email}</strong>
      <div class="invite-row-meta">${formatDateTime(invite.createdAt)}</div>
    `;

    const right = document.createElement('div');
    right.className = 'invite-row-right';

    const status = document.createElement('span');
    status.className = statusPillClass(invite.status);
    status.textContent = invite.status[0].toUpperCase() + invite.status.slice(1);

    right.appendChild(status);

    const revokeButton = document.createElement('button');
    revokeButton.type = 'button';
    revokeButton.className = 'invite-revoke-btn';
    revokeButton.textContent = '✕';
    revokeButton.disabled = invite.status === 'revoked';
    revokeButton.title = invite.status === 'revoked' ? 'Already revoked' : 'Revoke invite';
    revokeButton.addEventListener('click', async () => {
      await inviteDb.revoke(CURRENT_USER_UID, invite.id);
      showToast('Invite revoked.');
    });

    if (invite.status !== 'revoked') {
      right.appendChild(revokeButton);
    }

    row.append(left, right);
    inviteList.appendChild(row);
  });
}

function renderSettingsPanel() {
  const uiState = getUiState();
  const { businessDraft } = uiState;

  Object.entries(settingsFieldMap).forEach(([key, input]) => {
    input.value = businessDraft[key] || '';
  });

  saveSettingsButton.disabled = !uiState.businessDirty || uiState.settingsSaving;
  saveSettingsButton.textContent = uiState.settingsSaving ? 'Saving...' : 'Save Settings';
  cancelSettingsButton.disabled = uiState.settingsSaving;

  settingsSavedNotice.classList.toggle('hidden-panel', !uiState.settingsSavedNotice);
  settingsError.classList.toggle('hidden-panel', !uiState.settingsError);
  settingsError.textContent = uiState.settingsError || '';

  uploadLogoButton.disabled = uiState.logoUploading;
  uploadLogoButton.textContent = uiState.logoUploading ? 'Uploading...' : 'Upload Logo';
  logoProgressText.textContent = uiState.logoUploading ? `${Math.round(uiState.logoProgress)}%` : '';
  logoError.classList.toggle('hidden-panel', !uiState.logoError);
  logoError.textContent = uiState.logoError || '';

  const logoUrl = businessDraft.logoUrl || '';
  logoPreviewImage.src = logoUrl;
  logoPreviewImage.style.display = logoUrl ? 'block' : 'none';
  receiptPreviewLogo.src = logoUrl;
  receiptPreviewLogo.style.display = logoUrl ? 'block' : 'none';

  receiptPreviewBusinessName.textContent = businessDraft.businessName || 'Your business name';
  receiptPreviewPhone.textContent = businessDraft.phone || 'Phone';
  const location = [businessDraft.city, businessDraft.state, businessDraft.zip].filter(Boolean).join(', ');
  receiptPreviewLocation.textContent = location || 'City, ST ZIP';

  inviteEmailInput.value = uiState.inviteEmailDraft;
  sendInviteButton.disabled = uiState.inviteSending;
  sendInviteButton.textContent = uiState.inviteSending ? 'Sending...' : 'Send Invite';
  inviteError.classList.toggle('hidden-panel', !uiState.inviteError);
  inviteError.textContent = uiState.inviteError || '';
  inviteSuccessNotice.classList.toggle('hidden-panel', !uiState.inviteSuccess);

  renderInvitesList();
}

function computeStatusForRenter(renter, monthKey) {
  const entries = ledgerByRenterId[renter.id] || [];
  const chargesTotal = entries.filter((e) => e.type === 'charge' && e.appliesToMonthKey === monthKey).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const paymentsTotal = entries.filter((e) => e.type === 'payment' && e.appliesToMonthKey === monthKey).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const remaining = Math.max(0, chargesTotal - paymentsTotal);

  if (remaining === 0 && chargesTotal > 0) return { label: 'paid' };
  if (paymentsTotal > 0 && remaining > 0) return { label: 'partial' };
  if (new Date().getDate() > Number(renter.dueDayOfMonth) && remaining > 0) return { label: 'overdue' };
  if (new Date().getDate() === Number(renter.dueDayOfMonth) && remaining > 0) return { label: 'due' };
  return { label: 'upcoming' };
}

async function refreshRenterLedger(renterId) {
  ledgerByRenterId[renterId] = await ledgerDb.listByRenter(CURRENT_USER_UID, renterId);
}

function getHistoryByMonthWithMergedData(renterId) {
  const mergedHistory = {};

  (ledgerByRenterId[renterId] || []).forEach((entry) => {
    const monthLabel = formatMonthLabelFromMonthKey(entry.appliesToMonthKey);
    if (!mergedHistory[monthLabel]) mergedHistory[monthLabel] = [];

    mergedHistory[monthLabel].push({
      date: entry.date || entry.createdAt,
      type: entry.type === 'charge' ? 'Charge' : 'Payment',
      amount: Number(entry.amount || 0),
      note: entry.note || '',
    });
  });

  (reminderEventsByRenterId[renterId] || []).forEach((eventData) => {
    const monthLabel = formatMonthLabelFromMonthKey(eventData.monthKey);
    if (!mergedHistory[monthLabel]) mergedHistory[monthLabel] = [];

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
  return activeRenters.find((renter) => renter.id === renterId) || getUiState().archivedRenters.find((renter) => renter.id === renterId) || null;
}

function renderRenters() {
  const uiState = getUiState();
  const { searchText, remindersByRenterForCurrentMonth, reminderPopoverOpenForRenterId, archiveOpen, settingsOpen } = uiState;
  const monthKey = getCurrentMonthKey();

  if (archiveOpen || settingsOpen) {
    rentersListElement.classList.add('hidden-panel');
    archivePanelElement.classList.toggle('hidden-panel', !archiveOpen);
    settingsPanelElement.classList.toggle('hidden-panel', !settingsOpen);
    return;
  }

  rentersListElement.classList.remove('hidden-panel');
  archivePanelElement.classList.add('hidden-panel');
  settingsPanelElement.classList.add('hidden-panel');

  const visibleRenters = activeRenters
    .filter((renter) => renter.name.toLowerCase().includes(searchText.trim().toLowerCase()))
    .map((renter) => ({ ...renter, statusLabel: computeStatusForRenter(renter, monthKey).label }));

  rentersListElement.innerHTML = '';
  visibleRenters.forEach((renter) => {
    const card = createRenterCard({
      renter,
      reminderDatesForMonth: remindersByRenterForCurrentMonth[renter.id] || [],
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
      const result = await renterDb.restore(CURRENT_USER_UID, renter.id);
      if (!result.ok) {
        showToast(result.error || 'Unable to restore renter.');
        return;
      }
      showToast('Renter restored.');
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn-danger-text';
    deleteButton.textContent = 'Permanently Delete';
    deleteButton.addEventListener('click', () => {
      updateUiState({ deleteConfirmOpen: true, deleteTargetRenterId: renter.id, deleteConfirmText: '', deleteError: null });
      renderArchivePanel();
    });

    actions.append(restoreButton, deleteButton);
    row.append(info, actions);
    archiveContentElement.appendChild(row);
  });

  if (uiState.deleteConfirmOpen && uiState.deleteTargetRenterId) {
    const renter = archivedRenters.find((item) => item.id === uiState.deleteTargetRenterId);
    if (!renter) return;

    const modal = document.createElement('div');
    modal.className = 'archive-delete-modal';
    const matches = uiState.deleteConfirmText.trim() === renter.name;
    modal.innerHTML = `<h4>Permanently delete ${renter.name}? This cannot be undone.</h4><p>Type the renter's name to confirm:</p>`;

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
      updateUiState({ deleteConfirmOpen: false, deleteTargetRenterId: null, deleteConfirmText: '', deleteWorking: false, deleteError: null, deleteProgress: 0 });
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

        updateUiState({ deleteConfirmOpen: false, deleteTargetRenterId: null, deleteConfirmText: '', deleteWorking: false, deleteProgress: result.deletedEvents + result.deletedLedger + 1 });
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
    .map((entry) => ({ amount: Number(entry.amount || 0), method: entry.method || 'Recorded payment', note: entry.note || '', date: toSafeDate(entry.date || entry.createdAt).toISOString().slice(0, 10) }));

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
  if (!drawerOpen || !selectedRenterId) return;

  const renter = getRenterById(selectedRenterId);
  if (!renter || renter.status !== 'active') {
    closeDrawer(drawerElement, overlayElement);
    return;
  }

  await openRenterDrawer(renter);
}

async function archiveRenterFromDrawer(renterId) {
  const result = await renterDb.archive(CURRENT_USER_UID, renterId);
  if (!result.ok) {
    showToast(result.error || 'Unable to archive renter.');
    return;
  }

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
  if (removeReminderListener) removeReminderListener();

  removeReminderListener = eventDb.listenRemindersForMonth(CURRENT_USER_UID, monthKey, (eventsForMonth) => {
    const grouped = {};
    const allByRenter = {};

    eventsForMonth.forEach((eventData) => {
      if (!grouped[eventData.renterId]) grouped[eventData.renterId] = [];
      if (!allByRenter[eventData.renterId]) allByRenter[eventData.renterId] = [];
      grouped[eventData.renterId].push(eventData.sentAt);
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

  if (removeActiveRentersListener) removeActiveRentersListener();
  if (removeArchivedRentersListener) removeArchivedRentersListener();

  removeActiveRentersListener = renterDb.listen(CURRENT_USER_UID, { status: 'active' }, async (nextRenters) => {
    activeRenters = nextRenters;

    for (let index = 0; index < activeRenters.length; index += 1) {
      await ensureChargeAndLedgerRefreshForRenter(activeRenters[index]);
    }

    renderRenters();
    rerenderOpenDrawerIfNeeded();
  });

  removeArchivedRentersListener = renterDb.listen(CURRENT_USER_UID, { status: 'archived' }, (nextRenters) => {
    updateUiState({ archivedRenters: nextRenters, archiveLoading: false, archiveError: null });
    renderArchivePanel();
  });
}

function startInviteListener() {
  if (removeInviteListener) {
    removeInviteListener();
  }

  updateUiState({ invitesLoading: true });

  removeInviteListener = inviteDb.listen(CURRENT_USER_UID, (inviteRows) => {
    updateUiState({ invites: inviteRows, invitesLoading: false });
    renderSettingsPanel();
  });
}

function stopInviteListener() {
  if (removeInviteListener) {
    removeInviteListener();
    removeInviteListener = null;
  }
}

async function loadBusinessProfileIfNeeded() {
  const uiState = getUiState();
  if (uiState.businessSaved && uiState.businessSaved.updatedAt) {
    return;
  }

  const profile = await business.get(CURRENT_USER_UID);
  updateUiState({
    businessSaved: { ...profile },
    businessDraft: { ...profile },
    businessDirty: false,
  });
}

function openArchivePanel() {
  updateUiState({ archiveOpen: true, settingsOpen: false, deleteConfirmOpen: false, deleteTargetRenterId: null, deleteConfirmText: '' });
  stopInviteListener();
  menuPopover.classList.remove('open');
  renderArchivePanel();
  renderRenters();
}

function closeArchivePanel() {
  updateUiState({ archiveOpen: false });
  renderRenters();
}

async function openSettingsPanel() {
  await loadBusinessProfileIfNeeded();
  updateUiState({
    settingsOpen: true,
    archiveOpen: false,
    settingsError: null,
    logoError: null,
    inviteError: null,
    inviteSuccess: false,
  });
  menuPopover.classList.remove('open');
  startInviteListener();
  renderSettingsPanel();
  renderRenters();
}

function closeSettingsPanel() {
  updateUiState({ settingsOpen: false });
  stopInviteListener();
  renderRenters();
}

function onBusinessDraftChange(field, value) {
  const uiState = getUiState();
  const nextDraft = { ...uiState.businessDraft, [field]: value };
  updateUiState({
    businessDraft: nextDraft,
    businessDirty: !draftEqualsSaved(uiState.businessSaved, nextDraft),
    settingsSavedNotice: false,
    settingsError: null,
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

async function sendInvite() {
  const uiState = getUiState();
  const email = normalizeEmail(uiState.inviteEmailDraft);

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    updateUiState({ inviteError: 'Enter a valid email address.', inviteSuccess: false });
    renderSettingsPanel();
    return;
  }

  if (email === normalizeEmail(CURRENT_USER_EMAIL)) {
    updateUiState({ inviteError: 'You cannot invite your own email.', inviteSuccess: false });
    renderSettingsPanel();
    return;
  }

  updateUiState({ inviteSending: true, inviteError: null, inviteSuccess: false });
  renderSettingsPanel();

  const result = await inviteDb.create(CURRENT_USER_UID, email);

  if (!result.ok) {
    if (result.reason === 'duplicate') {
      updateUiState({ inviteSending: false, inviteError: 'A pending invite already exists for that email.', inviteSuccess: false });
    } else {
      updateUiState({ inviteSending: false, inviteError: 'Unable to create invite.', inviteSuccess: false });
    }
    renderSettingsPanel();
    return;
  }

  updateUiState({ inviteSending: false, inviteEmailDraft: '', inviteError: null, inviteSuccess: true });
  renderSettingsPanel();
}

async function handleLogoSelected(file) {
  if (!file) return;

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

function setupEvents() {
  searchInput.addEventListener('input', (event) => {
    updateUiState({ searchText: event.target.value });
    renderRenters();
  });

  overlayElement.addEventListener('click', () => closeDrawer(drawerElement, overlayElement));

  railArchiveButton.addEventListener('click', openArchivePanel);
  menuArchiveButton.addEventListener('click', openArchivePanel);
  closeArchivePanelButton.addEventListener('click', closeArchivePanel);

  railSettingsButton.addEventListener('click', openSettingsPanel);
  menuSettingsButton.addEventListener('click', openSettingsPanel);
  closeSettingsPanelButton.addEventListener('click', closeSettingsPanel);

  Object.entries(settingsFieldMap).forEach(([field, input]) => {
    input.addEventListener('input', (event) => onBusinessDraftChange(field, event.target.value));
  });

  inviteEmailInput.addEventListener('input', (event) => {
    updateUiState({ inviteEmailDraft: event.target.value, inviteError: null, inviteSuccess: false });
    renderSettingsPanel();
  });

  sendInviteButton.addEventListener('click', sendInvite);

  saveSettingsButton.addEventListener('click', saveBusinessSettings);
  cancelSettingsButton.addEventListener('click', cancelBusinessSettings);

  uploadLogoButton.addEventListener('click', () => {
    logoFileInput.value = '';
    logoFileInput.click();
  });

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

async function startApp() {
  await startRenterListeners();
  await loadBusinessProfileIfNeeded();
  startReminderListener();
  renderSettingsPanel();
  renderRenters();
  setupEvents();
}

startApp();
