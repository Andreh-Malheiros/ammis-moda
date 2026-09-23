(() => {
  const registryKey = '__ammisProductConfigurator';
  if (window[registryKey]) {
    window[registryKey].initializeWithin(document);
    return;
  }

  const initialized = new WeakSet();
  const observedSections = new WeakSet();
  const activeDialogs = new Set();
  const authorizedSubmitForms = new WeakSet();
  const openerHandlers = new WeakMap();

  document.addEventListener('click', (event) => {
    const opener = event.target?.closest?.('[data-configurator-open]');
    const root = opener?.closest?.('[data-product-configurator]');
    if (!opener) return;
    const handler = root && openerHandlers.get(root);
    if (!handler) return;
    handler(event, opener);
  }, true);

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

    const section = root.closest('[data-section]') || root.parentElement;
    const productSection = root.closest('section[id^="MainProduct-"]') || section;
    const state = new Map();
    const currency = root.dataset.currency;
    const locale = root.dataset.locale;
    const productId = root.dataset.productId;
    const dialog = root.querySelector('[data-configurator-dialog]');
    const opener = root.querySelector('[data-configurator-open]');
    const closeButton = root.querySelector('[data-configurator-close]');
    const groups = Array.from(root.querySelectorAll('[data-configurator-group]'));
    const review = root.querySelector('[data-configurator-review]');
    const progressCopy = root.querySelector('[data-configurator-progress-copy]');
    const progress = root.querySelector('[data-configurator-progress]');
    const progressBar = root.querySelector('[data-configurator-progress-bar]');
    const backButton = root.querySelector('[data-configurator-back]');
    const nextButton = root.querySelector('[data-configurator-next]');
    const addToCartButton = root.querySelector('[data-configurator-add-to-cart]');
    const addToCartSpinner = root.querySelector('[data-configurator-add-to-cart-spinner]');
    const cartError = root.querySelector('[data-configurator-cart-error]');
    const announcement = root.querySelector('[data-configurator-announcement]');
    const stepTemplate = root.dataset.stepTemplate || 'Step __CURRENT__ of __TOTAL__';
    const reviewLabel = root.dataset.reviewLabel || 'Review';
    const continueLabel = root.dataset.continueLabel || 'Continue';
    const reviewButtonLabel = root.dataset.reviewButton || 'Review configuration';
    const addToCartError = root.dataset.addToCartError || 'Unable to add this configuration to your cart. Please try again.';
    let basePrice = Number(root.dataset.basePrice) || 0;
    let currentStep = 0;
    let authorizedSubmitForm;
    let isAddingToCart = false;
    let addToCartTimeout;
    let cartUpdateUnsubscribe;
    let cartErrorUnsubscribe;
    if (
      !productSection
      || !dialog
      || !opener
      || !groups.length
      || !addToCartButton
      || typeof subscribe !== 'function'
      || typeof PUB_SUB_EVENTS === 'undefined'
    ) {
      return;
    }

    initialized.add(root);
    root.dataset.configuratorInitialized = 'true';

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

    function renderSelectionPreview(groupCode, code, label, extra, image, imageAlt) {
      const row = root.querySelector(`[data-configurator-selection-row="${CSS.escape(groupCode)}"]`);
      if (!row) return;

      const value = row.querySelector('[data-configurator-selection-value]');
      const addition = row.querySelector('[data-configurator-selection-extra]');
      const imageElement = row.querySelector('[data-configurator-selection-image]');
      if (value) value.textContent = code ? label : value.dataset.emptyLabel || 'Not selected';
      if (addition) addition.textContent = code ? `+${formatMoney(Number(extra) || 0, currency, locale)}` : '';
      if (imageElement) {
        if (image) {
          imageElement.src = image;
          imageElement.alt = imageAlt || label;
          imageElement.hidden = false;
        } else {
          imageElement.removeAttribute('src');
          imageElement.alt = '';
          imageElement.hidden = true;
        }
      }
    }

    function setSelection(group, code, label, extra, image, imageAlt) {
      const groupCode = group.dataset.groupCode;
      if (!code) {
        state.delete(groupCode);
      } else {
        state.set(groupCode, { code, label, extra: Number(extra) || 0, image: image || '', imageAlt: imageAlt || '' });
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
      renderSelectionPreview(groupCode, code, label, extra, image, imageAlt);
      renderSummary();

      document.dispatchEvent(new CustomEvent('ammis:configurator:selection', {
        detail: { productId, groupCode, code, label, extra: Number(extra) || 0, image: image || '', imageAlt: imageAlt || '' }
      }));
    }

    function applyPeerSelection(detail) {
      if (!detail || detail.productId !== productId) return;
      const group = groups.find((item) => item.dataset.groupCode === detail.groupCode);
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
      renderSelectionPreview(detail.groupCode, detail.code, detail.label, detail.extra, detail.image, detail.imageAlt);
      if (detail.code) state.set(detail.groupCode, {
        code: detail.code,
        label: detail.label,
        extra: Number(detail.extra) || 0,
        image: detail.image || '',
        imageAlt: detail.imageAlt || ''
      });
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
        setSelection(
          group,
          control.value,
          selected?.dataset.optionName || '',
          selected?.dataset.extraCents,
          selected?.dataset.optionImage,
          selected?.dataset.optionImageAlt
        );
      } else if (control.matches('[data-configurator-option]')) {
        setSelection(
          group,
          control.value,
          control.dataset.optionName,
          control.dataset.extraCents,
          control.dataset.optionImage,
          control.dataset.optionImageAlt
        );
      }
    }

    function invalidGroups() {
      return groups.filter((group) => group.dataset.required === 'true' && !state.has(group.dataset.groupCode));
    }

    function focusCurrentStep() {
      if (currentStep >= groups.length) {
        root.querySelector('[data-configurator-review-title]')?.focus();
        return;
      }
      const group = groups[currentStep];
      const target = group?.querySelector('[data-configurator-select], [data-configurator-option]:not(:disabled)');
      (target || group)?.focus?.();
    }

    function setCurrentStep(index, focus = false) {
      currentStep = Math.max(0, Math.min(index, groups.length));
      groups.forEach((group, groupIndex) => { group.hidden = groupIndex !== currentStep; });
      if (review) review.hidden = currentStep !== groups.length;
      if (backButton) backButton.hidden = currentStep === 0;
      if (nextButton) {
        nextButton.hidden = currentStep >= groups.length;
        nextButton.textContent = currentStep === groups.length - 1 ? reviewButtonLabel : continueLabel;
      }
      if (addToCartButton) addToCartButton.hidden = currentStep !== groups.length;

      if (progressCopy) {
        progressCopy.textContent = currentStep === groups.length
          ? reviewLabel
          : stepTemplate.replace('__CURRENT__', String(currentStep + 1)).replace('__TOTAL__', String(groups.length));
      }
      if (progress) {
        progress.setAttribute('aria-valuemax', String(groups.length));
        progress.setAttribute('aria-valuenow', String(Math.min(currentStep + 1, groups.length)));
      }
      if (progressBar) progressBar.style.width = `${currentStep === groups.length ? 100 : ((currentStep + 1) / groups.length) * 100}%`;
      if (focus) requestAnimationFrame(focusCurrentStep);
    }

    function openAtStep(index = 0) {
      if (!dialog || typeof dialog.showModal !== 'function') return false;
      if (!dialog.open) {
        dialog.showModal();
        activeDialogs.add(dialog);
        document.body.classList.add('ammis-configurator-modal-open');
      }
      setCurrentStep(index, true);
      return true;
    }

    function closeDialog() {
      if (isAddingToCart) return;
      if (dialog?.open) dialog.close();
      activeDialogs.delete(dialog);
      if (!activeDialogs.size) document.body.classList.remove('ammis-configurator-modal-open');
      opener?.focus();
    }

    function showGroupError(group) {
      if (!group) return;
      const error = group.querySelector('[data-configurator-error]');
      const target = group.querySelector('[data-configurator-select], [data-configurator-option]:not(:disabled)');
      if (error) error.hidden = false;
      group.setAttribute('aria-invalid', 'true');
      if (target) target.setAttribute('aria-invalid', 'true');
      if (announcement) announcement.textContent = error?.textContent.trim() || `Select an option for ${group.dataset.groupTitle}.`;
      const index = groups.indexOf(group);
      openAtStep(index < 0 ? 0 : index);
    }

    function validateRequired() {
      const invalid = invalidGroups();
      if (!invalid.length) return true;
      showGroupError(invalid[0]);
      return false;
    }

    function updateVariantColor(variant) {
      const index = Number(root.dataset.variantColorIndex);
      const colorReview = root.querySelector('[data-configurator-variant-color]');
      const colorValue = root.querySelector('[data-configurator-variant-color-value]');
      if (index < 0 || !colorReview || !colorValue) return;
      const color = variant?.options?.[index];
      if (color && color !== 'Default Title') {
        colorValue.textContent = color;
        colorReview.hidden = false;
      } else {
        colorValue.textContent = '';
        colorReview.hidden = true;
      }
    }

    function updateBasePrice() {
      const variantData = section?.querySelector('variant-radios script[type="application/json"], variant-selects script[type="application/json"]');
      const variantInput = section?.querySelector('product-form [name="id"]');
      if (!variantData || !variantInput) return;

      try {
        const variants = JSON.parse(variantData.textContent);
        const variant = variants.find((item) => String(item.id) === String(variantInput.value));
        if (variant) {
          if (Number.isFinite(Number(variant.price))) basePrice = Number(variant.price);
          updateVariantColor(variant);
          renderSummary();
        }
      } catch {
        return;
      }
    }

    function showCartError(message = addToCartError) {
      resetAddToCartState();
      if (cartError) {
        cartError.textContent = message;
        cartError.hidden = false;
      }
      if (announcement) announcement.textContent = message;
      addToCartButton.disabled = false;
      addToCartButton.removeAttribute('aria-disabled');
      addToCartButton.removeAttribute('aria-busy');
      if (dialog?.open && document.activeElement === addToCartButton) backButton?.focus();
    }

    function clearCartError() {
      if (cartError) {
        cartError.textContent = '';
        cartError.hidden = true;
      }
      if (announcement) announcement.textContent = '';
    }

    function setAddToCartLoading(loading) {
      addToCartButton.disabled = loading;
      addToCartButton.setAttribute('aria-disabled', String(loading));
      addToCartButton.setAttribute('aria-busy', String(loading));
      addToCartButton.classList.toggle('is-loading', loading);
      if (addToCartSpinner) addToCartSpinner.classList.toggle('hidden', !loading);
    }

    function removeCartListeners() {
      cartUpdateUnsubscribe?.();
      cartErrorUnsubscribe?.();
      cartUpdateUnsubscribe = undefined;
      cartErrorUnsubscribe = undefined;
    }

    function resetAddToCartState() {
      window.clearTimeout(addToCartTimeout);
      addToCartTimeout = undefined;
      removeCartListeners();
      if (authorizedSubmitForm) {
        authorizedSubmitForms.delete(authorizedSubmitForm);
        authorizedSubmitForm = undefined;
      }
      isAddingToCart = false;
      setAddToCartLoading(false);
    }

    function syncProperties(productForm) {
      groups.forEach((group) => {
        const selection = state.get(group.dataset.groupCode);
        const property = group.querySelector('[data-configurator-property]');
        const privateCode = group.querySelector('[data-configurator-code]');
        if (property) property.value = selection?.label || '';
        if (privateCode) privateCode.value = selection?.code || '';
      });

      const ownedInputs = new Set(root.querySelectorAll('[data-configurator-property], [data-configurator-code]'));
      return [...productForm.elements].every((input) => {
        if (!input.name || !input.name.startsWith('properties[') || ownedInputs.has(input)) return true;
        return ![...ownedInputs].some((ownedInput) => ownedInput.name === input.name);
      });
    }

    function applyNativePurchaseVisibility() {
      const nativePurchaseSelectors = [
        'product-form .product-form__submit',
        'product-form .product-form__checkout',
        'product-form .shopify-payment-button',
        'product-form [data-buy-now]',
        'product-form button[name="checkout"]',
        'product-form input[type="submit"][name="add"]'
      ];

      productSection.classList.add('ammis-configurator-purchase-required');
      productSection.dataset.configuratorActive = 'true';
      productSection.querySelectorAll(nativePurchaseSelectors.join(',')).forEach((control) => {
        control.hidden = true;
        control.setAttribute('aria-hidden', 'true');
      });
    }

    function activateRequiredPurchaseFlow() {
      const productForm = document.getElementById(root.dataset.productFormId)
        || productSection.querySelector('product-form form[data-type="add-to-cart-form"]');
      const nativeSubmit = productForm?.querySelector('button[type="submit"][name="add"]')
        || productSection.querySelector('product-form button[type="submit"]');
      if (!nativeSubmit || typeof productForm?.requestSubmit !== 'function') return false;

      applyNativePurchaseVisibility();
      root.dataset.configuratorReady = 'true';
      return true;
    }

    function handleAddToCart() {
      if (isAddingToCart || !validateRequired()) {
        return;
      }

      const productForm = document.getElementById(root.dataset.productFormId)
        || productSection.querySelector('product-form form[data-type="add-to-cart-form"]');
      const nativeSubmit = productForm?.querySelector('button[type="submit"][name="add"]');
      if (!productForm || !nativeSubmit || typeof productForm.requestSubmit !== 'function') {
        showCartError();
        return;
      }
      if (!syncProperties(productForm)) {
        showCartError();
        return;
      }

      clearCartError();
      isAddingToCart = true;
      setAddToCartLoading(true);
      const variantId = productForm.querySelector('[name="id"]')?.value;

      if (typeof subscribe !== 'function' || typeof PUB_SUB_EVENTS === 'undefined' || !PUB_SUB_EVENTS.cartUpdate || !PUB_SUB_EVENTS.cartError) {
        resetAddToCartState();
        showCartError();
        return;
      }

      cartUpdateUnsubscribe = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
        if (event?.source !== 'product-form' || String(event.productVariantId) !== String(variantId)) return;
        resetAddToCartState();
        closeDialog();
      });
      cartErrorUnsubscribe = subscribe(PUB_SUB_EVENTS.cartError, (event) => {
        if (event?.source !== 'product-form' || String(event.productVariantId) !== String(variantId)) return;
        resetAddToCartState();
        showCartError(event.message || event.errors || addToCartError);
      });
      addToCartTimeout = window.setTimeout(() => {
        resetAddToCartState();
        showCartError();
      }, 15000);

      try {
        authorizedSubmitForm = productForm;
        authorizedSubmitForms.add(productForm);
        productForm.requestSubmit(nativeSubmit);
      } catch (error) {
        resetAddToCartState();
        showCartError();
      }
    }

    function guardProductAction(event) {
      const form = event.target instanceof HTMLFormElement ? event.target : event.target?.closest?.('form');
      const authorized = Boolean(form && authorizedSubmitForms.has(form));
      if (authorized) {
        authorizedSubmitForms.delete(form);
        if (authorizedSubmitForm === form) authorizedSubmitForm = undefined;
        return;
      }
      const invalid = invalidGroups();
      if (invalid.length) {
        event.preventDefault();
        event.stopPropagation();
        showGroupError(invalid[0]);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openAtStep(groups.length);
      addToCartButton.focus();
    }

    root.addEventListener('change', (event) => updateFromControl(event.target));
    document.addEventListener('ammis:configurator:selection', (event) => applyPeerSelection(event.detail));
    groups.forEach(syncSelectedCards);

    openerHandlers.set(root, (event, trigger) => {
      openAtStep(0);
    });
    closeButton?.addEventListener('click', closeDialog);
    dialog?.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog();
    });
    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog();
    });
    dialog?.addEventListener('close', () => {
      activeDialogs.delete(dialog);
      if (!activeDialogs.size) document.body.classList.remove('ammis-configurator-modal-open');
    });

    backButton?.addEventListener('click', () => setCurrentStep(currentStep - 1, true));
    nextButton?.addEventListener('click', () => {
      const group = groups[currentStep];
      if (!group) return;
      if (group.dataset.required === 'true' && !state.has(group.dataset.groupCode)) {
        showGroupError(group);
        return;
      }
      setCurrentStep(currentStep + 1, true);
    });
    addToCartButton.addEventListener('click', (event) => {
      event.preventDefault();
      handleAddToCart();
    });

    root.addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-configurator-edit]');
      if (!editButton || !root.contains(editButton)) return;
      const index = groups.findIndex((group) => group.dataset.groupCode === editButton.dataset.configuratorEdit);
      if (index >= 0) openAtStep(index);
    });

    section?.addEventListener('change', (event) => {
      if (!event.target.closest?.('variant-radios, variant-selects')) return;
      updateBasePrice();
    });

    section?.addEventListener('submit', guardProductAction, true);
    section?.addEventListener('click', (event) => {
      const submitter = event.target.closest?.('button[type="submit"], [data-buy-now]');
      if (!submitter || !section.contains(submitter)) return;
      guardProductAction(event);
    }, true);

    if (productSection && !observedSections.has(productSection)) {
      observedSections.add(productSection);
      const observer = new MutationObserver((records) => {
        applyNativePurchaseVisibility();
        records.forEach((record) => record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) initializeWithin(node);
        }));
      });
      observer.observe(productSection, { childList: true, subtree: true });
    }

    renderSummary();
    updateBasePrice();

    document.querySelectorAll('[data-product-configurator]').forEach((peer) => {
      if (peer === root || peer.dataset.productId !== productId) return;
      peer.querySelectorAll('[data-configurator-group]').forEach((peerGroup) => {
        const peerCode = peerGroup.querySelector('[data-configurator-code]')?.value;
        if (!peerCode) return;
        const peerControl = Array.from(peerGroup.querySelectorAll('[data-configurator-option], [data-configurator-select]'))
          .find((item) => item.value === peerCode);
        const peerProperty = peerGroup.querySelector('[data-configurator-property]')?.value || '';
        applyPeerSelection({
          productId,
          groupCode: peerGroup.dataset.groupCode,
          code: peerCode,
          label: peerProperty,
          extra: peerControl?.dataset.extraCents || 0,
          image: peerControl?.dataset.optionImage || '',
          imageAlt: peerControl?.dataset.optionImageAlt || ''
        });
      });
    });

    setCurrentStep(0);
    activateRequiredPurchaseFlow();
  }

  function initializeWithin(container) {
    if (container.matches?.('[data-product-configurator]')) {
      initialize(container);
    }
    container.querySelectorAll?.('[data-product-configurator]').forEach((root) => {
      initialize(root);
    });
  }

  window[registryKey] = { initializeWithin };
  initializeWithin(document);
  document.addEventListener('shopify:section:load', (event) => initializeWithin(event.target));
})();
