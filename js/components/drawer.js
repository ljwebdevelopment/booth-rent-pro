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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function formatTimestamp(value) {
  if (!value) return 'Pending timestamp';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending timestamp';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function renderRenterDrawer({
  drawerElement,
  overlayElement,
  renter,
  currentMonthLabel,
  currentMonthKey,
  paymentsThisMonth,
  onArchiveRenter,
  onSavePayment,
  historyByMonth,
}) {
  const uiState = getUiState();
  drawerElement.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'drawer-header';

  const titleWrap = document.createElement('div');

  const title = document.createElement('h2');
  title.textContent = renter.name;
  title.style.margin = '0';

  const subtitle = document.createElement('p');
  subtitle.style.margin = '6px 0 0';
  subtitle.style.color = 'var(--ink-muted)';
  subtitle.textContent = [renter.phone || '', renter.email || ''].filter(Boolean).join(' • ') || 'No contact info';

  const meta = document.createElement('p');
  meta.style.margin = '6px 0 0';
  meta.style.color = 'var(--ink-muted)';
  meta.textContent = `Due day: ${renter.dueDayOfMonth} • Monthly rent: ${formatMoney(renter.monthlyRent)}`;

  titleWrap.append(title, subtitle, meta);

  const headerActions = document.createElement('div');
  headerActions.className = 'drawer-header-actions';

  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'drawer-kebab';
  menuButton.setAttribute('aria-label', 'Renter actions');
  menuButton.textContent = '⋯';

  const menu = document.createElement('div');
  menu.className = 'drawer-action-menu';
  const archiveButton = document.createElement('button');
  archiveButton.type = 'button';
  archiveButton.className = 'drawer-action-menu-item';
  archiveButton.textContent = 'Archive renter';
  archiveButton.addEventListener('click', async () => {
    menu.classList.remove('open');
    await onArchiveRenter();
  });
  menu.appendChild(archiveButton);

  menuButton.addEventListener('click', () => {
    menu.classList.toggle('open');
  });

  document.addEventListener('click', (event) => {
    const clickedInside = menu.contains(event.target) || menuButton.contains(event.target);
    if (!clickedInside) {
      menu.classList.remove('open');
    }
  });

  headerActions.append(menuButton, menu);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'btn';
  closeButton.textContent = 'Close';
  closeButton.addEventListener('click', () => closeDrawer(drawerElement, overlayElement));

  header.append(titleWrap, headerActions, closeButton);

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

  const monthLabel = document.createElement('p');
  monthLabel.className = 'month-label';
  monthLabel.textContent = currentMonthLabel;

  const amountDue = Number(renter.monthlyRent || 0);
  const paidTotal = paymentsThisMonth.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const remaining = Math.max(amountDue - paidTotal, 0);

  const amountDueText = document.createElement('p');
  amountDueText.innerHTML = `<strong>Amount due this month:</strong> ${formatMoney(amountDue)}`;

  const remainingText = document.createElement('p');
  remainingText.innerHTML = `<strong>Remaining owed this month:</strong> ${formatMoney(remaining)}`;

  const paymentsList = document.createElement('div');
  paymentsList.className = 'payments-list';

  if (!paymentsThisMonth.length) {
    const empty = document.createElement('div');
    empty.className = 'payment-empty';
    empty.textContent = 'No payments logged this month.';
    paymentsList.appendChild(empty);
  } else {
    paymentsThisMonth.forEach((payment) => {
      const item = document.createElement('div');
      item.className = 'payment-item';

      const top = document.createElement('div');
      top.className = 'payment-item-top';
      top.innerHTML = `<strong>${formatMoney(payment.amount)}</strong><span>${payment.method || 'Unknown method'}</span>`;

      const note = document.createElement('div');
      note.className = 'payment-item-note';
      note.textContent = payment.note || 'No note';

      const date = document.createElement('div');
      date.className = 'payment-item-date';
      date.textContent = formatTimestamp(payment.createdAt);

      item.append(top, note, date);
      paymentsList.appendChild(item);
    });
  }

  const logPanel = document.createElement('div');
  logPanel.className = 'panel';
  const logTitle = document.createElement('h4');
  logTitle.textContent = 'Log Payment';

  const amountField = document.createElement('label');
  amountField.className = 'field';
  amountField.innerHTML = 'Amount<input type="number" min="0.01" step="0.01" placeholder="0.00" required />';
  const amountInput = amountField.querySelector('input');

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
  const otherInput = otherMethodField.querySelector('input');
  otherInput.value = uiState.paymentOtherMethod;
  otherMethodField.style.display = uiState.paymentMethod === 'Other' ? 'grid' : 'none';
  otherInput.addEventListener('input', (event) => updateUiState({ paymentOtherMethod: event.target.value }));

  const noteField = document.createElement('label');
  noteField.className = 'field';
  noteField.innerHTML = 'Note<input type="text" placeholder="Optional note" />';
  const noteInput = noteField.querySelector('input');

  const paymentError = document.createElement('p');
  paymentError.className = 'auth-error hidden';

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'btn btn-primary';
  saveButton.textContent = 'Save Payment';

  saveButton.addEventListener('click', async () => {
    const amount = Number(amountInput.value || 0);
    const selectedMethod = dropdown.getValue();
    const otherMethod = otherInput.value.trim();
    const method = selectedMethod === 'Other' ? otherMethod : selectedMethod;

    if (!amount || amount <= 0) {
      paymentError.textContent = 'Amount must be greater than 0.';
      paymentError.classList.remove('hidden');
      return;
    }

    if (!method) {
      paymentError.textContent = 'Payment method is required.';
      paymentError.classList.remove('hidden');
      return;
    }

    paymentError.classList.add('hidden');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
      await onSavePayment({
        renterId: renter.id,
        amount,
        method,
        note: noteInput.value.trim(),
        appliesToMonthKey: currentMonthKey,
      });

      amountInput.value = '';
      noteInput.value = '';
      otherInput.value = '';
      updateUiState({ paymentMethod: 'Cash', paymentOtherMethod: '' });
      dropdown.setValue('Cash');
      otherMethodField.style.display = 'none';
    } catch (error) {
      paymentError.textContent = error?.message || 'Could not save payment.';
      paymentError.classList.remove('hidden');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save Payment';
    }
  });

  methodField.append(methodLabel, dropdown.element);
  logPanel.append(logTitle, amountField, methodField, otherMethodField, noteField, paymentError, saveButton);

  monthPanel.append(monthTitle, monthLabel, amountDueText, remainingText, paymentsList, logPanel);

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

  Object.entries(historyByMonth).forEach(([monthLabelText, entries]) => {
    const details = document.createElement('details');
    details.className = 'history-month';
    const summary = document.createElement('summary');
    summary.textContent = monthLabelText;
    details.append(summary);

    const list = document.createElement('div');
    list.style.padding = '0 10px 10px';
    list.style.display = 'grid';
    list.style.gap = '8px';

    entries.forEach((entry) => {
      const line = document.createElement('div');
      line.textContent = `${entry.date} • ${entry.type} • ${formatMoney(entry.amount)} • ${entry.note}`;
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
