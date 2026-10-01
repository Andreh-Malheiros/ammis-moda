(() => {
  const roots = document.querySelectorAll('[data-configurable-pdp]');

  roots.forEach((root) => {
    const dialog = root.querySelector('[data-configurable-dialog]');
    const startButton = root.querySelector('[data-configurable-start]');

    if (!dialog || !startButton) return;

    const closeButtons = root.querySelectorAll('[data-configurable-close]');
    let returnFocusTarget = null;

    const closeDialog = () => {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
      root.classList.remove('configurable-product--dialog-open');
      returnFocusTarget?.focus();
    };

    const openDialog = () => {
      returnFocusTarget = document.activeElement;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      root.classList.add('configurable-product--dialog-open');
      dialog.querySelector('[tabindex="-1"]')?.focus();
    };

    startButton.addEventListener('click', openDialog);
    closeButtons.forEach((button) => button.addEventListener('click', closeDialog));

    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog();
    });

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog();
    });
  });
})();
