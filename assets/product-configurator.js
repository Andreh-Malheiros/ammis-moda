(() => {
  const registryKey = '__ammisProductConfigurator';
  if (window[registryKey]) {
    window[registryKey].initializeWithin(document);
    return;
  }

  const initialized = new WeakSet();
  const observedSections = new WeakSet();

  function formatMoney(cents, currency, locale) {
    try {
      return new Intl.NumberFormat(locale || document.documentElement.lang || 'pt-BR', {
        style: 'currency',
        currency: currency || 'BRL'
      }).format((Number(cents) || 0) / 100);
    } catch (error) {
      return `${((Number(cents) || 0) / 100).toFixed(2)} ${currency || ''}`.trim();
    }
  }

  function initialize(root) {
    if (initialized.has(root)) return;
    initialized.add(root);

    const section = root.closest('[data-section]') || root.parentElement;
    const productSection = root.closest('section[id^="MainProduct-"]') || section;
    const state = new Map();
    const currency = root.dataset.currency;
    const locale = root.dataset.locale;
    let basePrice = Number(root.dataset.basePrice) || 0;

    function renderSummary() {
      let additions = 0;
      state.forEach((selection) => { additions += selection.extra; });

      const base = root.querySelector('[data-configurator-base]');
      const subtotal = root.querySelector('[data-configurator-subtotal]');
      const total = root.querySelector('[data-configurator-total]');
      if (base) base.textContent = formatMoney(basePrice, currency, locale);
      if (subtotal) subtotal.textContent = formatMoney(additions, currency, locale);
      if (total) total.textContent = formatMoney(basePrice + additions, currency, locale);
    }

    function syncSelectedCards(group) {
      group.querySelectorAll('[data-configurator-option]').forEach((control) => {
        const card = control.closest('.product-configurator__choice')?.querySelector('[data-configurator-card]');
        if (card) card.dataset.selected = control.checked ? 'true' : 'false';
      });
    }

    function renderSelectionPreview(groupCode, code, label, extra) {
      const row = root.querySelector(`[data-configurator-selection-row="${CSS.escape(groupCode)}"]`);
      if (!row) return;

      const value = row.querySelector('[data-configurator-selection-value]');
      const addition = row.querySelector('[data-configurator-selection-extra]');
      if (value) value.textContent = code ? label : 'Não selecionado';
      if (addition) addition.textContent = code ? `+${formatMoney(Number(extra) || 0, currency, locale)}` : '';
    }

    function setSelection(group, code, label, extra) {
      const groupCode = group.dataset.groupCode;
      if (!code) {
        state.delete(groupCode);
      } else {
        state.set(groupCode, { code, label, extra: Number(extra) || 0 });
      }
      syncSelectedCards(group);

      const property = group.querySelector('[data-configurator-property]');
      const privateCode = group.querySelector('[data-configurator-code]');
      if (property) property.value = code ? label : '';
      if (privateCode) privateCode.value = code || '';

      const error = group.querySelector('[data-configurator-error]');
      if (error) error.hidden = true;
      group.setAttribute('aria-invalid', 'false');
      group.querySelectorAll('[aria-invalid="true"]').forEach((control) => control.setAttribute('aria-invalid', 'false'));
      renderSelectionPreview(groupCode, code, label, extra);
      renderSummary();

      document.dispatchEvent(new CustomEvent('ammis:configurator:selection', {
        detail: { productId: root.dataset.productId, groupCode, code, label, extra: Number(extra) || 0 }
      }));
    }

    function applyPeerSelection(detail) {
      if (!detail || detail.productId !== root.dataset.productId) return;
      const group = Array.from(root.querySelectorAll('[data-configurator-group]'))
        .find((item) => item.dataset.groupCode === detail.groupCode);
      if (!group) return;

      const control = Array.from(group.querySelectorAll('[data-configurator-option], [data-configurator-select]'))
        .find((item) => item.value === detail.code);
      if (control?.matches('[data-configurator-option]')) control.checked = true;
      if (control?.matches('[data-configurator-select]')) control.value = detail.code;
      if (!detail.code) {
        group.querySelectorAll('[data-configurator-option]').forEach((item) => { item.checked = false; });
        const select = group.querySelector('[data-configurator-select]');
        if (select) select.value = '';
      }
      syncSelectedCards(group);

      const property = group.querySelector('[data-configurator-property]');
      const privateCode = group.querySelector('[data-configurator-code]');
      if (property) property.value = detail.code ? detail.label : '';
      if (privateCode) privateCode.value = detail.code || '';
      renderSelectionPreview(detail.groupCode, detail.code, detail.label, detail.extra);
      if (detail.code) state.set(detail.groupCode, { code: detail.code, label: detail.label, extra: Number(detail.extra) || 0 });
      else state.delete(detail.groupCode);
      const error = group.querySelector('[data-configurator-error]');
      if (error) error.hidden = true;
      group.setAttribute('aria-invalid', 'false');
      renderSummary();
    }

    function updateFromControl(control) {
      const group = control.closest('[data-configurator-group]');
      if (!group) return;

      if (control.matches('[data-configurator-select]')) {
        const selected = control.selectedOptions[0];
        setSelection(group, control.value, selected?.dataset.optionName || '', selected?.dataset.extraCents);
      } else if (control.matches('[data-configurator-option]')) {
        setSelection(group, control.value, control.dataset.optionName, control.dataset.extraCents);
      }
    }

    function invalidGroups() {
      return Array.from(root.querySelectorAll('[data-configurator-group][data-required="true"]'))
        .filter((group) => !state.has(group.dataset.groupCode));
    }

    function validateRequired() {
      const invalid = invalidGroups();
      if (!invalid.length) return true;

      invalid.forEach((group) => {
        const error = group.querySelector('[data-configurator-error]');
        const control = group.querySelector('[data-configurator-select], [data-configurator-option]:not(:disabled)');
        if (error) error.hidden = false;
        group.setAttribute('aria-invalid', 'true');
        if (control) control.setAttribute('aria-invalid', 'true');
      });

      const first = invalid[0];
      const focusTarget = first.querySelector('[data-configurator-select], [data-configurator-option]:not(:disabled)');
      const announcement = root.querySelector('[data-configurator-announcement]');
      if (announcement) announcement.textContent = `Selecione uma opção para ${first.dataset.groupTitle}.`;
      if (focusTarget) focusTarget.focus();
      return false;
    }

    function updateBasePrice() {
      const variantData = section?.querySelector('variant-radios script[type="application/json"]');
      const variantInput = section?.querySelector('product-form [name="id"]');
      if (!variantData || !variantInput) return;

      try {
        const variants = JSON.parse(variantData.textContent);
        const variant = variants.find((item) => String(item.id) === String(variantInput.value));
        if (variant && Number.isFinite(Number(variant.price))) {
          basePrice = Number(variant.price);
          renderSummary();
        }
      } catch (error) {
        // If theme variant data is unavailable, keep the Liquid-rendered base price.
      }
    }

    root.addEventListener('change', (event) => updateFromControl(event.target));
    document.addEventListener('ammis:configurator:selection', (event) => applyPeerSelection(event.detail));
    root.querySelectorAll('[data-configurator-group]').forEach(syncSelectedCards);

    section?.addEventListener('change', (event) => {
      if (event.target.closest?.('variant-radios')) updateBasePrice();
    });

    section?.addEventListener('submit', (event) => {
      if (!validateRequired()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    section?.addEventListener('click', (event) => {
      const submitter = event.target.closest?.('button[type="submit"], [data-buy-now]');
      if (!submitter || !section.contains(submitter) || validateRequired()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    if (productSection && !observedSections.has(productSection)) {
      observedSections.add(productSection);
      const observer = new MutationObserver((records) => {
        records.forEach((record) => record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) initializeWithin(node);
        }));
      });
      observer.observe(productSection, { childList: true, subtree: true });
    }

    renderSummary();
    updateBasePrice();

    document.querySelectorAll('[data-product-configurator]').forEach((peer) => {
      if (peer === root || peer.dataset.productId !== root.dataset.productId) return;
      peer.querySelectorAll('[data-configurator-group]').forEach((peerGroup) => {
        const peerCode = peerGroup.querySelector('[data-configurator-code]')?.value;
        if (!peerCode) return;
        const peerControl = Array.from(peerGroup.querySelectorAll('[data-configurator-option], [data-configurator-select]'))
          .find((item) => item.value === peerCode);
        const peerProperty = peerGroup.querySelector('[data-configurator-property]')?.value || '';
        applyPeerSelection({
          productId: root.dataset.productId,
          groupCode: peerGroup.dataset.groupCode,
          code: peerCode,
          label: peerProperty,
          extra: peerControl?.dataset.extraCents || 0
        });
      });
    });
  }

  function initializeWithin(container) {
    if (container.matches?.('[data-product-configurator]')) initialize(container);
    container.querySelectorAll?.('[data-product-configurator]').forEach(initialize);
  }

  // The theme's sticky form injects a second ProductInfo fragment at runtime.
  window[registryKey] = { initializeWithin };
  initializeWithin(document);
  document.addEventListener('shopify:section:load', (event) => initializeWithin(event.target));
})();
