export function createRenterCard(renter, onClick) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'renter-card';

  const left = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'renter-name';
  name.textContent = renter.name;

  const meta = document.createElement('div');
  meta.className = 'key-value';
  meta.innerHTML = `<span>Due day</span><span>${renter.dueDayOfMonth}</span>`;

  left.append(name, meta);

  const colorSwatch = document.createElement('span');
  colorSwatch.style.background = renter.color;
  colorSwatch.style.width = '16px';
  colorSwatch.style.height = '16px';
  colorSwatch.style.borderRadius = '50%';

  card.append(left, colorSwatch);
  card.addEventListener('click', () => onClick(renter.id));

  return card;
}
