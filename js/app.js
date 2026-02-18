import { createRenterShape } from './dataModel.js';
import { getUiState, updateUiState } from './uiStore.js';
import { createRenterCard } from './components/renterCard.js';
import { closeDrawer, renderRenterDrawer } from './components/drawer.js';

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

const historyByRenterId = {
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

const rentersListElement = document.getElementById('rentersList');
const searchInput = document.getElementById('searchInput');
const drawerElement = document.getElementById('renterDrawer');
const overlayElement = document.getElementById('drawerOverlay');
const menuButton = document.getElementById('menuButton');
const menuPopover = document.getElementById('menuPopover');

function renderRenters() {
  const { searchText } = getUiState();
  const normalizedSearch = searchText.trim().toLowerCase();

  const visibleRenters = renters.filter((renter) => renter.name.toLowerCase().includes(normalizedSearch));

  rentersListElement.innerHTML = '';
  visibleRenters.forEach((renter) => {
    const card = createRenterCard(renter, openRenterDrawer);
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
    historyByMonth: historyByRenterId[renter.id] || {},
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
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menuPopover.classList.remove('open');
      closeDrawer(drawerElement, overlayElement);
    }
  });
}

function startApp() {
  renderRenters();
  setupEvents();
}

startApp();
