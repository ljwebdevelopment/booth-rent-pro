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

export function createRenterCard({
  renter,
  reminderDatesForMonth,
  isReminderPopoverOpen,
  onCardClick,
  onReminderDotClick,
}) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'renter-card';

  const info = document.createElement('div');
  info.className = 'renter-info';

  const chip = document.createElement('span');
  chip.className = 'renter-chip';
  chip.style.background = renter.color;

  const textWrap = document.createElement('div');

  const name = document.createElement('div');
  name.textContent = renter.name;

  const meta = document.createElement('div');
  meta.className = 'renter-meta';
  meta.textContent = `Due day: ${renter.dueDayOfMonth} • Rent: $${renter.monthlyRent.toFixed(2)}`;

  textWrap.append(name, meta);
  info.append(chip, textWrap);

  const rightSide = document.createElement('div');
  rightSide.className = 'renter-card-right';

  const open = document.createElement('span');
  open.textContent = 'Open ›';
  rightSide.appendChild(open);

  if (reminderDatesForMonth.length > 0) {
    const reminderWrap = document.createElement('div');
    reminderWrap.className = 'reminder-indicator-wrap';

    const reminderDot = document.createElement('button');
    reminderDot.type = 'button';
    reminderDot.className = 'reminder-dot-button';
    reminderDot.setAttribute('aria-label', 'View reminder timestamps');
    reminderDot.title = reminderDatesForMonth.length === 1
      ? `Reminded: ${formatReminderDate(reminderDatesForMonth[0])}`
      : `Reminded (${reminderDatesForMonth.length})`;

    const reminderDotInner = document.createElement('span');
    reminderDotInner.className = 'reminder-dot';
    reminderDot.appendChild(reminderDotInner);

    reminderDot.addEventListener('click', (event) => {
      event.stopPropagation();
      onReminderDotClick(renter.id);
    });

    reminderWrap.appendChild(reminderDot);

    if (isReminderPopoverOpen) {
      const popover = document.createElement('div');
      popover.className = 'reminder-popover';

      const title = document.createElement('div');
      title.className = 'reminder-popover-title';
      title.textContent = `Reminded (x${reminderDatesForMonth.length})`;

      const list = document.createElement('div');
      list.className = 'reminder-popover-list';

      reminderDatesForMonth.forEach((dateValue) => {
        const row = document.createElement('div');
        row.className = 'reminder-popover-row';
        row.textContent = `Reminded: ${formatReminderDate(dateValue)}`;
        list.appendChild(row);
      });

      popover.append(title, list);
      reminderWrap.appendChild(popover);
    }

    rightSide.appendChild(reminderWrap);
  }

  card.append(info, rightSide);
  card.addEventListener('click', () => onCardClick(renter));

  return card;
}
