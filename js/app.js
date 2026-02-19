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
  }),
];

const paymentsByRenterId = {
  r1: [
    { amount: 300, method: 'Card', note: 'First installment', date: '2026-02-02' },
    { amount: 250, method: 'Cash App', note: 'Mid-month', date: '2026-02-10' },
  ],
  r2: [{ amount: 400, method: 'Venmo', note: 'Partial payment', date: '2026-02-06' }],
  r3: [
    { amount: 180, method: 'Cash', note: 'Weekly payment', date: '2026-02-01' },
    { amount: 180, method: 'Cash', note: 'Weekly payment', date: '2026-02-08' },
  ],
};

const baseHistoryByRenterId = {
  r1: {
    'February 2026': [
      { date: '2026-02-02', type: 'Payment', amount: 300, note: 'Card payment' },
      { date: '2026-02-10', type: 'Payment', amount: 250, note: 'Cash App payment' },
    ],
    'January 2026': [{ date: '2026-01-05', type: 'Payment', amount: 900, note: 'Paid in full' }],
  },
  r2: {
    'February 2026': [{ date: '2026-02-06', type: 'Payment', amount: 400, note: 'Partial' }],
    'January 2026': [{ date: '2026-01-12', type: 'Payment', amount: 1050, note: 'Card' }],
  },
  r3: {
    'February 2026': [
      { date: '2026-02-01', type: 'Payment', amount: 180, note: 'Cash' },
      { date: '2026-02-08', type: 'Payment', amount: 180, note: 'Cash' },
    ],
    'January 2026': [{ date: '2026-01-20', type: 'Payment', amount: 780, note: 'Paid in full' }],
  },
};

const reminderEventsByRenterId = {};

const rentersListElement = document.getElementById('rentersList');
const searchInput = document.getElementById('searchInput');
const drawerElement = document.getElementById('renterDrawer');
const overlayElement = document.getElementById('drawerOverlay');
const menuButton = document.getElementById('menuButton');
const menuPopover = document.getElementById('menuPopover');

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

  const visibleRenters = renters.filter((renter) => renter.name.toLowerCase().includes(normalizedSearch));

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

function openRenterDrawer(renter) {
  updateUiState({ selectedRenterId: renter.id });

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

function setupEvents() {
  searchInput.addEventListener('input', (event) => {
    updateUiState({ searchText: event.target.value });
    renderRenters();
  });

  overlayElement.addEventListener('click', () => closeDrawer(drawerElement, overlayElement));

  menuButton.addEventListener('click', () => {
    menuPopover.classList.toggle('open');
  });

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
