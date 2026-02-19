const STATUS_LABELS = {
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  due: 'Due',
  upcoming: 'Upcoming',
  unknown: '—',
};

function formatReminderTime(value) {
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending timestamp';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildReminderIndicator({ renter, reminders, popoverOpen, onToggleReminderPopover }) {
  if (!reminders.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'renter-reminder-wrap';

  const dotButton = document.createElement('span');
  dotButton.className = 'renter-reminder-dot';
  dotButton.setAttribute('role', 'button');
  dotButton.setAttribute('tabindex', '0');
  dotButton.setAttribute('aria-label', 'View reminder history for this month');
  dotButton.title = reminders.length > 1 ? `Reminded (${reminders.length})` : `Reminded: ${formatReminderTime(reminders[0])}`;

  const toggle = (event) => {
    event.stopPropagation();
    onToggleReminderPopover(renter.id);
  };

  dotButton.addEventListener('click', toggle);
  dotButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle(event);
    }
  });

  wrap.appendChild(dotButton);

  if (popoverOpen) {
    const popover = document.createElement('div');
    popover.className = 'renter-reminder-popover';

    const heading = document.createElement('div');
    heading.className = 'renter-reminder-popover-title';
    heading.textContent = reminders.length === 1
      ? `Reminded: ${formatReminderTime(reminders[0])}`
      : `Reminded (x${reminders.length})`;

    const list = document.createElement('ul');
    list.className = 'renter-reminder-popover-list';

    reminders.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = formatReminderTime(item);
      list.appendChild(li);
    });

    popover.append(heading, list);
    wrap.appendChild(popover);
  }

  return wrap;
}

export function createRenterCard(renter, onClick, options = {}) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'renter-card';
  card.style.borderLeft = `6px solid ${renter.color || '#DDF3E6'}`;
  card.style.background = `${renter.color || '#DDF3E6'}22`;

  const info = document.createElement('div');
  info.className = 'renter-info';

  const textWrap = document.createElement('div');

  const topRow = document.createElement('div');
  topRow.className = 'renter-top-row';

  const name = document.createElement('div');
  name.className = 'renter-name';
  name.textContent = renter.name;

  const status = renter.computedStatus || 'unknown';
  const statusBadge = document.createElement('span');
  statusBadge.className = `renter-status-badge status-${status}`;
  statusBadge.textContent = STATUS_LABELS[status] || STATUS_LABELS.unknown;

  topRow.append(name, statusBadge);

  const contact = document.createElement('div');
  contact.className = 'renter-meta';
  const contactParts = [renter.phone, renter.email].filter(Boolean);
  contact.textContent = contactParts.length ? contactParts.join(' • ') : 'No contact info yet';

  const billing = document.createElement('div');
  billing.className = 'renter-meta';
  billing.textContent = `Due day: ${renter.dueDayOfMonth} • Rent: $${Number(renter.monthlyRent || 0).toFixed(2)}`;

  textWrap.append(topRow, contact, billing);
  info.append(textWrap);

  const open = document.createElement('span');
  open.className = 'renter-open';
  open.textContent = 'Open ›';

  card.append(info, open);

  const reminders = Array.isArray(options.reminders) ? options.reminders : [];
  const reminderIndicator = buildReminderIndicator({
    renter,
    reminders,
    popoverOpen: Boolean(options.reminderPopoverOpen),
    onToggleReminderPopover: options.onToggleReminderPopover || (() => {}),
  });
  if (reminderIndicator) card.appendChild(reminderIndicator);

  card.addEventListener('click', () => onClick(renter));

  return card;
}
