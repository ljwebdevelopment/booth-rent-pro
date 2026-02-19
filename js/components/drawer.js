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

function toJsDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimestamp(value) {
  const date = toJsDate(value);
  if (!date) return 'Pending timestamp';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncateNotes(text, max = 120) {
  if (!text) return 'No notes yet.';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function mergeHistoryItems(ledgerItems, eventItems) {
  const normalizedLedger = ledgerItems.map((item) => ({
    kind: item.type === 'charge' ? 'charge' : 'payment',
    timestamp: item.createdAt || null,
    displayTime: formatTimestamp(item.createdAt),
    amount: Number(item.amount || 0),
    method: item.type === 'payment' ? item.method || null : null,
    note: item.note || null,
    raw: item,
  }));

  const normalizedEvents = eventItems
    .filter((item) => item.type === 'reminder_marked_sent')
    .map((item) => ({
      kind: 'reminder',
      timestamp: item.sentAt || item.createdAt || null,
      displayTime: formatTimestamp(item.sentAt || item.createdAt),
      amount: null,
      method: null,
      note: item.message || 'Reminder marked sent',
      raw: item,
    }));

  return [...normalizedLedger, ...normalizedEvents].sort((a, b) => {
    const aTime = toJsDate(a.timestamp)?.getTime() || 0;
    const bTime = toJsDate(b.timestamp)?.getTime() || 0;
    return bTime - aTime;
  });
}

function renderHistoryItem(item) {
  const row = document.createElement('div');
  row.className = `history-item history-${item.kind}`;

  const top = document.createElement('div');
  top.className = 'history-item-top';

  const kindLabel = document.createElement('span');
  kindLabel.className = `history-kind kind-${item.kind}`;
  kindLabel.textContent = item.kind === 'charge' ? 'Charge' : item.kind === 'payment' ? 'Payment' : 'Reminder';

  const time = document.createElement('span');
  time.className = 'history-time';
  time.textContent = item.displayTime;

  top.append(kindLabel, time);

  const details = document.createElement('div');
  details.className = 'history-details';

  if (item.amount !== null) {
    const amount = document.createElement('div');
    amount.textContent = `Amount: ${formatMoney(item.amount)}`;
    details.appendChild(amount);
  }

  if (item.method) {
    const method = document.createElement('div');
    method.textContent = `Method: ${item.method}`;
    details.appendChild(method);
  }

  if (item.note) {
    const note = document.createElement('div');
    note.textContent = `Note: ${item.note}`;
    details.appendChild(note);
  }

  row.append(top, details);
  return row;
}

export function renderRenterDrawer({
  drawerElement,
  overlayElement,
  renter,
  currentMonthLabel,
  currentMonthKey,
  paymentsThisMonth,
  monthSummary,
  historyMonthKeys,
  historyByMonth,
  historyLoadingByMonth,
  historyErrorByMonth,
  historyExpandedMonthKey,
  monthLabelForKey,
  onToggleHistoryMonth,
  onArchiveRenter,
  onSavePayment,
  onSaveNotes,
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

  const statusLine = document.createElement('p');
  statusLine.style.margin = '6px 0 0';
  statusLine.innerHTML = `<span class="renter-status-badge status-${monthSummary?.status || 'due'}">${(monthSummary?.status || 'due').toUpperCase()}</span>`;

  titleWrap.append(title, subtitle, meta, statusLine);

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
    if (!clickedInside) menu.classList.remove('open');
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
  monthTitle.textContent = "This Month's Overview";

  const monthLabel = document.createElement('p');
  monthLabel.className = 'month-label';
  monthLabel.textContent = currentMonthLabel;

  const amountDue = Number(monthSummary?.chargeAmount || 0);
  const remaining = Number(monthSummary?.remaining || 0);

  const amountDueText = document.createElement('p');
  amountDueText.innerHTML = `<strong>Amount due this month:</strong> ${formatMoney(amountDue)}`;

  const remainingText = document.createElement('p');
  if (monthSummary?.upcomingCharge) {
    remainingText.innerHTML = `<strong>Upcoming charge on:</strong> ${formatTimestamp(monthSummary?.dueDate)}`;
  } else {
    remainingText.innerHTML = `<strong>Remaining owed this month:</strong> ${formatMoney(remaining)}`;
  }

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

  const notesPreviewWrap = document.createElement('div');
  notesPreviewWrap.className = 'notes-preview-wrap';
  const notesPreviewLabel = document.createElement('strong');
  notesPreviewLabel.textContent = 'Notes';

  const notesPreviewText = document.createElement('p');
  notesPreviewText.className = 'notes-preview-text';
  notesPreviewText.textContent = truncateNotes(uiState.notesSaved || renter.notes || '');

  const editNotesButton = document.createElement('button');
  editNotesButton.type = 'button';
  editNotesButton.className = 'link-btn';
  editNotesButton.textContent = 'Edit notes';
  editNotesButton.addEventListener('click', () => {
    const notesEditor = drawerElement.querySelector('#notesEditor');
    if (notesEditor) {
      notesEditor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notesEditor.focus();
    }
  });

  notesPreviewWrap.append(notesPreviewLabel, notesPreviewText, editNotesButton);

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

  const savePaymentButton = document.createElement('button');
  savePaymentButton.type = 'button';
  savePaymentButton.className = 'btn btn-primary';
  savePaymentButton.textContent = 'Save Payment';

  savePaymentButton.addEventListener('click', async () => {
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
    savePaymentButton.disabled = true;
    savePaymentButton.textContent = 'Saving...';

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
      savePaymentButton.disabled = false;
      savePaymentButton.textContent = 'Save Payment';
    }
  });

  methodField.append(methodLabel, dropdown.element);
  logPanel.append(logTitle, amountField, methodField, otherMethodField, noteField, paymentError, savePaymentButton);

  monthPanel.append(monthTitle, monthLabel, amountDueText, remainingText, paymentsList, notesPreviewWrap, logPanel);

  const notesPanel = document.createElement('section');
  notesPanel.className = 'panel';

  const notesTitle = document.createElement('h3');
  notesTitle.textContent = 'Notes';

  const notesEditor = document.createElement('textarea');
  notesEditor.id = 'notesEditor';
  notesEditor.rows = 5;
  notesEditor.className = 'notes-editor';
  notesEditor.placeholder = 'Write notes for this renter...';
  notesEditor.value = uiState.notesDraft;
  notesEditor.addEventListener('input', (event) => {
    const nextDraft = event.target.value;
    updateUiState({
      notesDraft: nextDraft,
      notesDirty: nextDraft !== uiState.notesSaved,
      notesSaveError: null,
      notesSaveSuccess: '',
    });
  });

  const notesMessage = document.createElement('p');
  notesMessage.className = 'notes-message';
  if (uiState.notesSaveError) {
    notesMessage.textContent = uiState.notesSaveError;
    notesMessage.classList.add('error');
  } else if (uiState.notesSaveSuccess) {
    notesMessage.textContent = uiState.notesSaveSuccess;
    notesMessage.classList.add('success');
  }

  const notesActions = document.createElement('div');
  notesActions.className = 'panel-actions';

  const saveNotesButton = document.createElement('button');
  saveNotesButton.type = 'button';
  saveNotesButton.className = 'btn btn-primary';
  saveNotesButton.textContent = uiState.notesSaving ? 'Saving...' : 'Save Notes';
  saveNotesButton.disabled = uiState.notesSaving || !uiState.notesDirty;

  const reRenderDrawer = () => {
    renderRenterDrawer({
      drawerElement,
      overlayElement,
      renter,
      currentMonthLabel,
      currentMonthKey,
      paymentsThisMonth,
      monthSummary,
      historyMonthKeys,
      historyByMonth,
      historyLoadingByMonth,
      historyErrorByMonth,
      historyExpandedMonthKey,
      monthLabelForKey,
      onToggleHistoryMonth,
      onArchiveRenter,
      onSavePayment,
      onSaveNotes,
    });
  };

  saveNotesButton.addEventListener('click', async () => {
    updateUiState({ notesSaving: true, notesSaveError: null, notesSaveSuccess: '' });
    try {
      await onSaveNotes(uiState.notesDraft);
      updateUiState({
        notesSaving: false,
        notesSaved: uiState.notesDraft,
        notesDirty: false,
        notesSaveSuccess: 'Saved',
      });
      reRenderDrawer();
    } catch (error) {
      updateUiState({ notesSaving: false, notesSaveError: error?.message || 'Could not save notes.' });
      reRenderDrawer();
    }
  });

  const cancelNotesButton = document.createElement('button');
  cancelNotesButton.type = 'button';
  cancelNotesButton.className = 'btn';
  cancelNotesButton.textContent = 'Cancel';
  cancelNotesButton.disabled = !uiState.notesDirty || uiState.notesSaving;
  cancelNotesButton.addEventListener('click', () => {
    updateUiState({
      notesDraft: uiState.notesSaved,
      notesDirty: false,
      notesSaveError: null,
      notesSaveSuccess: '',
    });
    reRenderDrawer();
  });

  notesActions.append(saveNotesButton, cancelNotesButton);
  notesPanel.append(notesTitle, notesEditor, notesMessage, notesActions);

  const historyPanel = document.createElement('section');
  historyPanel.className = 'panel';
  const historyTitle = document.createElement('h3');
  historyTitle.textContent = 'History';
  historyPanel.append(historyTitle);

  historyMonthKeys.forEach((monthKey) => {
    const monthBlock = document.createElement('div');
    monthBlock.className = 'history-month-block';

    const monthHeader = document.createElement('button');
    monthHeader.type = 'button';
    monthHeader.className = 'history-month-header';
    monthHeader.textContent = monthLabelForKey(monthKey);
    monthHeader.addEventListener('click', () => onToggleHistoryMonth(monthKey));

    monthBlock.append(monthHeader);

    if (historyExpandedMonthKey === monthKey) {
      const monthContent = document.createElement('div');
      monthContent.className = 'history-month-content';

      if (historyLoadingByMonth[monthKey]) {
        const loading = document.createElement('div');
        loading.className = 'history-empty';
        loading.textContent = 'Loading history...';
        monthContent.appendChild(loading);
      } else if (historyErrorByMonth[monthKey]) {
        const error = document.createElement('div');
        error.className = 'history-empty';
        error.textContent = historyErrorByMonth[monthKey];
        monthContent.appendChild(error);
      } else {
        const items = historyByMonth[monthKey] || [];
        if (!items.length) {
          const empty = document.createElement('div');
          empty.className = 'history-empty';
          empty.textContent = 'No history for this month yet.';
          monthContent.appendChild(empty);
        } else {
          items.forEach((item) => {
            monthContent.appendChild(renderHistoryItem(item));
          });
        }
      }

      monthBlock.append(monthContent);
    }

    historyPanel.append(monthBlock);
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
  updateUiState({
    drawerOpen: false,
    selectedRenterId: null,
    notesDraft: '',
    notesSaved: '',
    notesDirty: false,
    notesSaving: false,
    notesSaveError: null,
    notesSaveSuccess: '',
    historyExpandedMonthKey: '',
    historyByMonth: {},
    historyLoadingByMonth: {},
    historyErrorByMonth: {},
  });
}
