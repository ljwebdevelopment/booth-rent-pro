export function createDropdown({
  options,
  placeholder = 'Choose an option',
  value = '',
  onChange
}) {
  const root = document.createElement('div');
  root.className = 'dropdown';

  const trigger = document.createElement('button');
  trigger.className = 'dropdown-trigger';
  trigger.type = 'button';

  const label = document.createElement('span');
  label.textContent = value || placeholder;
  const caret = document.createElement('span');
  caret.textContent = '▾';

  trigger.append(label, caret);

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu hidden';

  let isOpen = false;

  const closeMenu = () => {
    isOpen = false;
    menu.classList.add('hidden');
  };

  const openMenu = () => {
    isOpen = true;
    menu.classList.remove('hidden');
  };

  trigger.addEventListener('click', () => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  options.forEach((option) => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.className = 'dropdown-option';
    optionButton.textContent = option;
    optionButton.addEventListener('click', () => {
      label.textContent = option;
      closeMenu();
      onChange?.(option);
    });
    menu.append(optionButton);
  });

  const onDocumentClick = (event) => {
    if (!root.contains(event.target)) {
      closeMenu();
    }
  };

  const onEscape = (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  };

  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onEscape);

  root.cleanup = () => {
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onEscape);
  };

  root.append(trigger, menu);
  return root;
}
