export function createRenterCard(renter, onClick) {
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

  const open = document.createElement('span');
  open.textContent = 'Open ›';

  card.append(info, open);
  card.addEventListener('click', () => onClick(renter));

  return card;
}
