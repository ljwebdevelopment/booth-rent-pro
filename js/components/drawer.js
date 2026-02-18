import { createDropdown } from './dropdown.js';
import { getState, setRenterNoteDraft, setState } from '../uiStore.js';

const PAYMENT_METHODS = [
  'Cash',
  'Card',
  'Cash App',
  'Venmo',
  'PayPal',
  'Zelle',
  'Apple Pay',
  'Google Pay',
  'Other'
];

export function renderDrawer(root, renter, renterPaymentsByMonth) {
  root.innerHTML = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';

  const panel = document.createElement('aside');
  panel.className = 'drawer-panel';

  const header = document.createElement('div');
  header.className = 'drawer-header';
  header.innerHTML = `<strong>Renter Details</strong>`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'icon-button';
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';

  closeBtn.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);

  header.append(closeBtn);

  const content = document.createElement('div');
  content.className = 'drawer-content';

  // 1) Renter name
  const nameSection = sectionCard('Renter Name');
  nameSection.append(textRow(renter.name));

  // 2) Grade block placeholder (score + grade placement)
  const gradeSection = sectionCard('Grade Placement');
  gradeSection.append(
    textRow(`Score: ${renter.gradeScore}`),
    textRow(`Letter: ${renter.gradeLetter}`)
  );

  // 3) This Month's Overview
  const monthKey = new Date().toISOString().slice(0, 7);
  const currentMonthPayments = renterPaymentsByMonth[monthKey] || [];
  const totalPaid = currentMonthPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = Math.max(0, renter.monthlyRent - totalPaid);

  const overviewSection = sectionCard("This Month's Overview");
  overviewSection.append(createPaymentsList(currentMonthPayments));
  overviewSection.append(textRow(`Remaining owed this month: $${remaining.toFixed(2)}`));

  const logPaymentTitle = document.createElement('h4');
  logPaymentTitle.className = 'section-title';
  logPaymentTitle.textContent = 'Log Payment';
  overviewSection.append(logPaymentTitle);

  const formGrid = document.createElement('div');
  formGrid.className = 'form-grid';

  const amountInput = inputWithLabel('Amount', 'number');
  const noteInput = inputWithLabel('Note', 'text');

  const dropdownWrap = document.createElement('div');
  const dropdownLabel = document.createElement('label');
  dropdownLabel.textContent = 'Payment Method';
  dropdownLabel.style.display = 'grid';
  dropdownLabel.style.gap = '0.4rem';

  const dropdown = createDropdown({
    options: PAYMENT_METHODS,
    placeholder: 'Choose method',
    value: getState().paymentMethod,
    onChange: (method) => {
      setState({ paymentMethod: method });
      otherMethodWrap.classList.toggle('hidden', method !== 'Other');
    }
  });

  const otherMethodWrap = document.createElement('div');
  otherMethodWrap.className = `form-grid ${getState().paymentMethod === 'Other' ? '' : 'hidden'}`;
  const otherMethodInput = inputWithLabel('Other method', 'text');
  otherMethodInput.querySelector('input').value = getState().otherMethod;
  otherMethodInput.querySelector('input').addEventListener('input', (event) => {
    setState({ otherMethod: event.target.value });
  });
  otherMethodWrap.append(otherMethodInput);

  dropdownLabel.append(dropdown);
  dropdownWrap.append(dropdownLabel, otherMethodWrap);

  formGrid.append(amountInput, noteInput, dropdownWrap);
  overviewSection.append(formGrid);

  // 4) Notes UI stub
  const notesSection = sectionCard('Notes');
  const notes = document.createElement('textarea');
  notes.className = 'form-textarea';
  notes.placeholder = 'Add renter notes...';
  notes.value = getState().notesDraftByRenterId[renter.id] || '';
  notes.addEventListener('input', (event) => {
    setRenterNoteDraft(renter.id, event.target.value);
  });
  notesSection.append(notes);

  // 5) History at bottom
  const historySection = sectionCard('History');
  historySection.append(createHistoryShell(renterPaymentsByMonth));

  content.append(nameSection, gradeSection, overviewSection, notesSection, historySection);

  panel.append(header, content);
  root.append(backdrop, panel);

  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    panel.classList.add('open');
  });

  function closeDrawer() {
    backdrop.classList.remove('open');
    panel.classList.remove('open');
    setTimeout(() => {
      setState({ drawerOpen: false, selectedRenterId: null });
      dropdown.cleanup?.();
    }, 220);
  }
}

function sectionCard(title) {
  const card = document.createElement('section');
  card.className = 'section-card';

  const heading = document.createElement('h3');
  heading.className = 'section-title';
  heading.textContent = title;

  card.append(heading);
  return card;
}

function textRow(text) {
  const p = document.createElement('p');
  p.style.margin = '0';
  p.textContent = text;
  return p;
}

function inputWithLabel(labelText, type) {
  const label = document.createElement('label');
  label.style.display = 'grid';
  label.style.gap = '0.4rem';
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = type;
  input.className = 'form-input';

  label.append(input);
  return label;
}

function createPaymentsList(payments) {
  const wrap = document.createElement('div');
  wrap.className = 'form-grid';

  if (!payments.length) {
    wrap.append(textRow('No payments logged yet this month.'));
    return wrap;
  }

  payments.forEach((payment) => {
    const card = document.createElement('div');
    card.className = 'section-card';
    card.innerHTML = `
      <div class="key-value"><span>Amount</span><span>$${payment.amount.toFixed(2)}</span></div>
      <div class="key-value"><span>Method</span><span>${payment.method}</span></div>
      <div class="key-value"><span>Note</span><span>${payment.note || '-'}</span></div>
      <div class="key-value"><span>Date</span><span>${payment.date}</span></div>
    `;
    wrap.append(card);
  });

  return wrap;
}

function createHistoryShell(renterPaymentsByMonth) {
  const container = document.createElement('div');
  container.className = 'form-grid';
  const monthKeys = Object.keys(renterPaymentsByMonth);

  monthKeys.forEach((monthKey) => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = monthKey;
    details.append(summary);

    renterPaymentsByMonth[monthKey].forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'key-value';
      row.innerHTML = `<span>${entry.date} • ${entry.method}</span><span>$${entry.amount.toFixed(2)}</span>`;
      details.append(row);
    });

    container.append(details);
  });

  return container;
}
