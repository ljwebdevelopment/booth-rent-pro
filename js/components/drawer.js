import { createDropdown } from './dropdown.js';
import { getUiState, updateUiState } from '../uiStore.js';

const PAYMENT_OPTIONS = [
  'Cash',
  'Card',
  'Cash App',
  'Venmo',
  'PayPal',
  'Zelle',
  'Apple Pay',
  'Google Pay',
  'Other',
];

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatReminderDate(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function renderRenterDrawer({
  drawerElement,
  overlayElement,
  renter,
  paymentsThisMonth,
  historyByMonth,
  onMarkReminderSent,
  onArchiveRenter,
}) {
  const uiState = getUiState();
  drawerElement.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'drawer-header';

  const title = document.createElement('h2');
  title.textContent = renter.name;
  title.style.margin = '0';

  const headerActions = document.createElement('div');
  headerActions.className = 'drawer-header-actions';

  const moreButton = document.createElement('button');
  moreButton.type = 'button';
  moreButton.className = 'btn btn-ghost';
  moreButton.textContent = '⋯';

  const drawerMenu = document.createElement('div');
  drawerMenu.className = 'drawer-menu-popover';

  const archiveButton = document.createElement('button');
  archiveButton.type = 'button';
  archiveButton.className = 'menu-item';
  archiveButton.textContent = 'Archive renter';
  archiveButton.addEventListener('click', () => {
    onArchiveRenter(renter.id);
  });

  drawerMenu.appendChild(archiveButton);

  moreButton.addEventListener('click', () => {
    drawerMenu.classList.toggle('open');
  });

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'btn';
  closeButton.textContent = 'Close';
  closeButton.addEventListener('click', () => closeDrawer(drawerElement, overlayElement));

  headerActions.append(moreButton, drawerMenu, closeButton);
  header.append(title, headerActions);

  const body = document.createElement('div');
  body.className = 'drawer-body';

  const gradePanel = document.createElement('section');
  gradePanel.className = 'panel';
  gradePanel.innerHTML = `
    <h3>Grade Block Placeholder</h3>
    <p>Score: ${renter.gradeScore} / 100</p>
    <p>Placement: ${renter.gradeLetter}</p>
  `;

  const monthPanel = document.createElement('section');
  monthPanel.className = 'panel';

  const monthTitle = document.createElement('h3');
  monthTitle.textContent = 'This Month\'s Overview';

  const paymentList = document.createElement('div');
  paymentList.style.display = 'grid';
  paymentList.style.gap = '8px';

  let paidTotal = 0;
  paymentsThisMonth.forEach((payment) => {
    paidTotal += payment.amount;
    const item = document.createElement('div');
    item.style.border = '1px solid var(--border)';
    item.style.borderRadius = '8px';
    item.style.padding = '10px';
    item.innerHTML = `
      <strong>${formatMoney(payment.amount)}</strong> • ${payment.method}<br />
      <span>${payment.note || 'No note'}</span><br />
      <small>${payment.date}</small>
    `;
    paymentList.appendChild(item);
  });

  const remaining = Math.max(renter.monthlyRent - paidTotal, 0);
  const remainingText = document.createElement('p');
  remainingText.innerHTML = `<strong>Remaining owed this month:</strong> ${formatMoney(remaining)}`;

  const logPanel = document.createElement('div');
  logPanel.className = 'panel';
  const logTitle = document.createElement('h4');
  logTitle.textContent = 'Log Payment';

  const amountField = document.createElement('label');
  amountField.className = 'field';
  amountField.innerHTML = 'Amount<input type="number" min="0" step="0.01" placeholder="0.00" />';

  const noteField = document.createElement('label');
  noteField.className = 'field';
  noteField.innerHTML = 'Note<input type="text" placeholder="Optional note" />';

  const methodField = document.createElement('div');
  methodField.className = 'field';
  const methodLabel = document.createElement('div');
  methodLabel.textContent = 'Payment method';

  const dropdown = createDropdown({
    label: 'Choose a method',
    options: PAYMENT_OPTIONS,
    value: uiState.paymentMethod,
    onChange: (newMethod) => {
      updateUiState({ paymentMethod: newMethod });
      otherMethodField.style.display = newMethod === 'Other' ? 'grid' : 'none';
    },
  });

  const otherMethodField = document.createElement('label');
  otherMethodField.className = 'field';
  otherMethodField.innerHTML = 'Other method<input type="text" placeholder="Type payment method" />';
  otherMethodField.style.display = uiState.paymentMethod === 'Other' ? 'grid' : 'none';

  const otherInput = otherMethodField.querySelector('input');
  otherInput.value = uiState.paymentOtherMethod;
  otherInput.addEventListener('input', (event) => updateUiState({ paymentOtherMethod: event.target.value }));

  const reminderActionRow = document.createElement('div');
  reminderActionRow.className = 'drawer-actions-row';

  const markReminderButton = document.createElement('button');
  markReminderButton.type = 'button';
  markReminderButton.className = 'btn';
  markReminderButton.textContent = 'Mark Reminder Sent';
  markReminderButton.addEventListener('click', () => {
    onMarkReminderSent(renter.id);
  });

  reminderActionRow.appendChild(markReminderButton);

  methodField.append(methodLabel, dropdown.element);
  logPanel.append(logTitle, amountField, noteField, methodField, otherMethodField, reminderActionRow);

  monthPanel.append(monthTitle, paymentList, remainingText, logPanel);

  const notesPanel = document.createElement('section');
  notesPanel.className = 'panel';
  const notesLabel = document.createElement('label');
  notesLabel.className = 'field';
  notesLabel.textContent = 'Notes';
  const notesArea = document.createElement('textarea');
  notesArea.rows = 4;
  notesArea.placeholder = 'Write notes for this renter...';
  notesArea.value = uiState.noteDraftByRenterId[renter.id] || '';
  notesArea.addEventListener('input', (event) => {
    const nextDrafts = { ...getUiState().noteDraftByRenterId, [renter.id]: event.target.value };
    updateUiState({ noteDraftByRenterId: nextDrafts });
  });
  notesLabel.appendChild(notesArea);
  notesPanel.append(notesLabel);

  const historyPanel = document.createElement('section');
  historyPanel.className = 'panel';
  const historyTitle = document.createElement('h3');
  historyTitle.textContent = 'History';
  historyPanel.append(historyTitle);

  Object.entries(historyByMonth).forEach(([monthLabel, entries]) => {
    const details = document.createElement('details');
    details.className = 'history-month';
    const summary = document.createElement('summary');
    summary.textContent = monthLabel;
    details.append(summary);

    const list = document.createElement('div');
    list.style.padding = '0 10px 10px';
    list.style.display = 'grid';
    list.style.gap = '8px';

    entries.forEach((entry) => {
      const line = document.createElement('div');

      if (entry.type === 'Reminder marked sent') {
        line.textContent = `${formatReminderDate(entry.date)} • Reminder marked sent`;
      } else {
        line.textContent = `${entry.date} • ${entry.type} • ${formatMoney(entry.amount)} • ${entry.note}`;
      }

      list.appendChild(line);
    });

    details.append(list);
    historyPanel.append(details);
  });

  body.append(gradePanel, monthPanel, notesPanel, historyPanel);
  drawerElement.append(header, body);

  openDrawer(drawerElement, overlayElement);
}

export function openDrawer(drawerElement, overlayElement) {
  drawerElement.classList.add('open');
  overlayElement.classList.add('open');
  updateUiState({ drawerOpen: true });
}

export function closeDrawer(drawerElement, overlayElement) {
  drawerElement.classList.remove('open');
  overlayElement.classList.remove('open');
  updateUiState({ drawerOpen: false, selectedRenterId: null });
}
