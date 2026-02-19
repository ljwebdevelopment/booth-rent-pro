const STATUS_LABELS = {
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  due: 'Due',
};

export function createRenterCard(renter, onClick) {
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

  const status = renter.computedStatus || 'due';
  const statusBadge = document.createElement('span');
  statusBadge.className = `renter-status-badge status-${status}`;
  statusBadge.textContent = STATUS_LABELS[status] || 'Due';

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
  card.addEventListener('click', () => onClick(renter));

  return card;
}
