export function createDropdown({
  label = 'Select option',
  options = [],
  value = '',
  onChange = () => {},
}) {
  const root = document.createElement('div');
  root.className = 'dropdown';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'dropdown-trigger';

  const triggerText = document.createElement('span');
  const caret = document.createElement('span');
  caret.textContent = '▾';

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';

  let isOpen = false;
  let selected = value || options[0] || '';

  function closeMenu() {
    isOpen = false;
    menu.classList.remove('open');
  }

  function openMenu() {
    isOpen = true;
    menu.classList.add('open');
  }

  function updateLabel() {
    triggerText.textContent = selected || label;
  }

  options.forEach((option) => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.className = 'dropdown-option';
    optionButton.textContent = option;
    optionButton.addEventListener('click', () => {
      selected = option;
      updateLabel();
      closeMenu();
      onChange(option);
    });
    menu.appendChild(optionButton);
  });

  trigger.append(triggerText, caret);
  updateLabel();

  trigger.addEventListener('click', () => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });

  root.append(trigger, menu);

  return {
    element: root,
    getValue: () => selected,
    setValue: (newValue) => {
      selected = newValue;
      updateLabel();
    },
  };
}
