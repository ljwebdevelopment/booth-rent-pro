import { appConfig } from './appConfig.js';
import { initializeFirebase } from './firebase-init.js';
import { createRenterCard } from './components/renterCard.js';
import { renderDrawer } from './components/drawer.js';
import { getState, setState, subscribe } from './uiStore.js';

initializeFirebase();

const renters = [
  {
    id: 'r1',
    name: 'Maya Torres',
    email: 'maya@example.com',
    phone: '(555) 010-1001',
    status: 'active',
    color: '#d5efe2',
    billingCycle: 'monthly',
    monthlyRent: 850,
    dueDayOfMonth: 1,
    timezone: appConfig.timezone,
    nextDueDate: null,
    gradeScore: 92,
    gradeLetter: 'A'
  },
  {
    id: 'r2',
    name: 'Jordan Lee',
    email: 'jordan@example.com',
    phone: '(555) 010-2222',
    status: 'active',
    color: '#fde6d5',
    billingCycle: 'monthly',
    monthlyRent: 720,
    dueDayOfMonth: 10,
    timezone: appConfig.timezone,
    nextDueDate: null,
    gradeScore: 81,
    gradeLetter: 'B'
  },
  {
    id: 'r3',
    name: 'Avery Patel',
    email: 'avery@example.com',
    phone: '(555) 010-3003',
    status: 'active',
    color: '#e5e2ff',
    billingCycle: 'monthly',
    monthlyRent: 930,
    dueDayOfMonth: 18,
    timezone: appConfig.timezone,
    nextDueDate: null,
    gradeScore: 75,
    gradeLetter: 'C'
  }
];

const monthKey = new Date().toISOString().slice(0, 7);
const previousMonth = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 7);

const renterPayments = {
  r1: {
    [monthKey]: [
      { amount: 300, method: 'Card', note: 'First installment', date: `${monthKey}-03` },
      { amount: 275, method: 'Cash App', note: 'Second installment', date: `${monthKey}-12` }
    ],
    [previousMonth]: [{ amount: 850, method: 'Cash', note: 'Paid in full', date: `${previousMonth}-01` }]
  },
  r2: {
    [monthKey]: [{ amount: 400, method: 'Venmo', note: 'Mid-month payment', date: `${monthKey}-10` }],
    [previousMonth]: [{ amount: 720, method: 'Card', note: '', date: `${previousMonth}-09` }]
  },
  r3: {
    [monthKey]: [],
    [previousMonth]: [{ amount: 930, method: 'Zelle', note: 'On time', date: `${previousMonth}-18` }]
  }
};

const renterListEl = document.getElementById('renter-list');
const searchInputEl = document.getElementById('search-input');
const drawerRoot = document.getElementById('drawer-root');
const menuToggle = document.getElementById('menu-toggle');
const menuPopover = document.getElementById('menu-popover');
const panelButtons = document.querySelectorAll('[data-panel]');

menuToggle?.addEventListener('click', () => {
  menuPopover.classList.toggle('hidden');
});

document.addEventListener('click', (event) => {
  if (!menuPopover.contains(event.target) && !menuToggle.contains(event.target)) {
    menuPopover.classList.add('hidden');
  }
});

panelButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const panelName = button.getAttribute('data-panel');
    document.querySelectorAll('.panel-shell').forEach((panel) => panel.classList.add('hidden'));
    const activePanel = document.getElementById(`panel-${panelName}`);
    activePanel?.classList.remove('hidden');
  });
});

searchInputEl?.addEventListener('input', () => renderRenters());

subscribe(() => {
  const { drawerOpen, selectedRenterId } = getState();

  if (!drawerOpen || !selectedRenterId) {
    drawerRoot.innerHTML = '';
    return;
  }

  const selectedRenter = renters.find((renter) => renter.id === selectedRenterId);
  if (!selectedRenter) return;

  renderDrawer(drawerRoot, selectedRenter, renterPayments[selectedRenter.id] || {});
});

function renderRenters() {
  const query = searchInputEl.value.trim().toLowerCase();
  renterListEl.innerHTML = '';

  const filtered = renters.filter((renter) => renter.name.toLowerCase().includes(query));

  filtered.forEach((renter) => {
    const card = createRenterCard(renter, (renterId) => {
      setState({ selectedRenterId: renterId, drawerOpen: true });
    });
    renterListEl.append(card);
  });
}

renderRenters();
