(() => {
  'use strict';

  const host = typeof globalThis !== 'undefined' ? globalThis : {};
  const REGISTRY_KEY = '__ammisConfigurablePDP';
  const SUPPORTED_PAYLOAD_VERSION = 1;
  const CART_UPDATE_EVENT = 'cart-update';
  const CART_ERROR_EVENT = 'cart-error';
  const rootRegistry = new Map();
  let scrollLockCount = 0;
  let lifecycleInstalled = false;

  if (host[REGISTRY_KEY] && typeof host[REGISTRY_KEY].mountAll === 'function') {
    host[REGISTRY_KEY].mountAll();
    return;
  }

  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
  const isInteger = (value) => Number.isInteger(value);

  function normalizeCode(value) {
    if (!isNonEmptyString(value)) return '';
    return value.trim().normalize('NFC').toLowerCase();
  }

  function normalizeLabel(value, fallback = '') {
    return isNonEmptyString(value) ? value.trim() : fallback;
  }

  function orderValue(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : Infinity;
  }

  function sortByOrderAndSourceIndex(items, orderKey = 'order') {
    return [...items].sort((left, right) => {
      const orderDifference = orderValue(left[orderKey]) - orderValue(right[orderKey]);
      if (orderDifference !== 0) return orderDifference;
      return (Number.isInteger(left.sourceIndex) ? left.sourceIndex : Infinity) - (Number.isInteger(right.sourceIndex) ? right.sourceIndex : Infinity);
    });
  }

  function normalizeMedia(raw) {
    if (!isObject(raw) || !isNonEmptyString(raw.src)) return null;
    const media = {
      src: raw.src.trim(),
      alt: raw.alt === null || raw.alt === undefined ? null : normalizeLabel(raw.alt) || null,
      width: isInteger(raw.width) && raw.width > 0 ? raw.width : null,
      height: isInteger(raw.height) && raw.height > 0 ? raw.height : null,
      srcset: isNonEmptyString(raw.srcset) ? raw.srcset.trim() : null,
      sizes: isNonEmptyString(raw.sizes) ? raw.sizes.trim() : null
    };
    return media;
  }

  function normalizePayload(rawPayload) {
    const errors = [];
    const warnings = [];

    if (!isObject(rawPayload)) {
      return { valid: false, errors: ['INVALID_PAYLOAD'], warnings, payload: null };
    }
    if (rawPayload.version !== SUPPORTED_PAYLOAD_VERSION) {
      return {
        valid: false,
        errors: [rawPayload.version > SUPPORTED_PAYLOAD_VERSION ? 'UNSUPPORTED_PAYLOAD_VERSION' : 'INVALID_PAYLOAD_VERSION'],
        warnings,
        payload: null
      };
    }

    const locale = isNonEmptyString(rawPayload.locale) ? rawPayload.locale.trim() : '';
    const currency = isNonEmptyString(rawPayload.currency) ? rawPayload.currency.trim().toUpperCase() : '';
    if (!locale) errors.push('MISSING_LOCALE');
    if (!/^[A-Z]{3}$/.test(currency)) errors.push('UNSUPPORTED_CURRENCY');

    const rawProduct = rawPayload.product;
    if (!isObject(rawProduct)) {
      errors.push('MISSING_PRODUCT');
    }
    const product = {
      id: isObject(rawProduct) && isNonEmptyString(rawProduct.id) ? rawProduct.id.trim() : '',
      title: isObject(rawProduct) ? normalizeLabel(rawProduct.title) : '',
      handle: isObject(rawProduct) ? normalizeLabel(rawProduct.handle) : '',
      featuredImage: isObject(rawProduct) ? normalizeMedia(rawProduct.featuredImage) : null,
      configuratorEnabled: isObject(rawProduct) && rawProduct.configuratorEnabled === true
    };
    if (!product.id) errors.push('MISSING_PRODUCT_ID');
    if (!product.title && product.handle) product.title = product.handle;
    if (!product.title) errors.push('MISSING_PRODUCT_TITLE');
    if (!product.configuratorEnabled) errors.push('PRODUCT_NOT_CONFIGURABLE');

    const rawGroups = Array.isArray(rawPayload.groups) ? rawPayload.groups : null;
    if (!rawGroups) errors.push('INVALID_GROUPS');
    const groupCodes = new Set();
    const groups = [];

    (rawGroups || []).forEach((rawGroup, groupIndex) => {
      if (!isObject(rawGroup)) {
        warnings.push('INVALID_GROUP');
        return;
      }
      const code = normalizeCode(rawGroup.code);
      if (!code) {
        errors.push('INVALID_GROUP_CODE');
        return;
      }
      if (groupCodes.has(code)) {
        errors.push('DUPLICATE_GROUP_CODE');
        return;
      }
      groupCodes.add(code);
      const required = rawGroup.required !== false;
      const rawOptions = Array.isArray(rawGroup.options) ? rawGroup.options : [];
      const optionCodes = new Set();
      const options = [];

      rawOptions.forEach((rawOption, optionIndex) => {
        if (!isObject(rawOption)) {
          warnings.push('INVALID_OPTION');
          return;
        }
        const optionCode = normalizeCode(rawOption.code);
        if (!optionCode) {
          warnings.push('INVALID_OPTION_CODE');
          return;
        }
        if (optionCodes.has(optionCode)) {
          errors.push('DUPLICATE_OPTION_CODE');
          return;
        }
        optionCodes.add(optionCode);
        if (!isInteger(rawOption.priceAdditionCents) || rawOption.priceAdditionCents < 0) {
          warnings.push('INVALID_PRICE_ADDITION');
          return;
        }
        options.push({
          name: normalizeLabel(rawOption.name, optionCode),
          code: optionCode,
          description: isNonEmptyString(rawOption.description) ? rawOption.description.trim() : null,
          image: normalizeMedia(rawOption.image),
          color: isNonEmptyString(rawOption.color) ? rawOption.color.trim() : null,
          priceAdditionCents: rawOption.priceAdditionCents,
          available: rawOption.available !== false,
          order: orderValue(rawOption.order) === Infinity ? null : rawOption.order,
          sourceIndex: Number.isInteger(rawOption.sourceIndex) ? rawOption.sourceIndex : optionIndex
        });
      });

      const sortedOptions = sortByOrderAndSourceIndex(options);
      if (required && !sortedOptions.some((option) => option.available)) {
        errors.push('REQUIRED_GROUP_WITHOUT_VALID_OPTIONS');
        return;
      }
      if (!required && !sortedOptions.some((option) => option.available)) return;
      groups.push({
        title: normalizeLabel(rawGroup.title, code),
        code,
        description: isNonEmptyString(rawGroup.description) ? rawGroup.description.trim() : null,
        required,
        interfaceType: ['buttons', 'swatches', 'image_cards', 'select'].includes(rawGroup.interfaceType) ? rawGroup.interfaceType : 'buttons',
        order: orderValue(rawGroup.order) === Infinity ? null : rawGroup.order,
        sourceIndex: Number.isInteger(rawGroup.sourceIndex) ? rawGroup.sourceIndex : groupIndex,
        options: sortedOptions
      });
      if (!['buttons', 'swatches', 'image_cards', 'select'].includes(rawGroup.interfaceType)) {
        warnings.push('UNKNOWN_INTERFACE_TYPE');
      }
    });

    const sortedGroups = sortByOrderAndSourceIndex(groups);
    if (!sortedGroups.length) errors.push('NO_VALID_GROUPS');

    const rawVariants = Array.isArray(rawPayload.variants) ? rawPayload.variants : null;
    if (!rawVariants) errors.push('INVALID_VARIANTS');
    const variants = [];
    (rawVariants || []).forEach((rawVariant) => {
      if (!isObject(rawVariant) || !isNonEmptyString(rawVariant.id) || !isInteger(rawVariant.priceCents) || rawVariant.priceCents < 0 || !Array.isArray(rawVariant.selectedOptions) || !isNonEmptyString(rawVariant.sizeValue)) {
        warnings.push('INVALID_VARIANT');
        return;
      }
      const selectedOptions = rawVariant.selectedOptions
        .filter((option) => isObject(option) && isNonEmptyString(option.name) && isNonEmptyString(option.value))
        .map((option) => ({ name: option.name.trim(), value: option.value.trim() }));
      if (!selectedOptions.length) {
        warnings.push('INVALID_VARIANT_OPTIONS');
        return;
      }
      variants.push({
        id: rawVariant.id.trim(),
        title: normalizeLabel(rawVariant.title, rawVariant.sizeValue.trim()),
        selectedOptions,
        sizeValue: rawVariant.sizeValue.trim(),
        priceCents: rawVariant.priceCents,
        available: rawVariant.available !== false
      });
    });
    if (!variants.length) errors.push('NO_VALID_VARIANTS');
    if (!variants.some((variant) => variant.available)) errors.push('NO_AVAILABLE_VARIANTS');

    const sizeOptionName = isNonEmptyString(rawPayload.sizeOptionName) ? rawPayload.sizeOptionName.trim() : '';
    const sizeOptionCode = normalizeCode(sizeOptionName);
    if (!sizeOptionCode) errors.push('MISSING_SIZE_DIMENSION');
    const dimensionValues = new Map();
    variants.forEach((variant) => {
      variant.selectedOptions.forEach((option) => {
        const code = normalizeCode(option.name);
        if (!dimensionValues.has(code)) dimensionValues.set(code, new Set());
        dimensionValues.get(code).add(normalizeCode(option.value));
      });
    });
    const additionalDimensions = [...dimensionValues.entries()]
      .filter(([code, values]) => code !== sizeOptionCode && values.size > 1)
      .map(([code]) => code);
    if (sizeOptionCode && !dimensionValues.has(sizeOptionCode)) {
      errors.push('MISSING_SIZE_DIMENSION');
    } else if (additionalDimensions.length) {
      errors.push('UNSUPPORTED_VARIANT_CONFIGURATION');
    }

    const rawImageStates = Array.isArray(rawPayload.imageStates) ? rawPayload.imageStates : [];
    const imageStates = [];
    rawImageStates.forEach((rawState, stateIndex) => {
      if (!isObject(rawState) || !Array.isArray(rawState.selections)) return;
      const selections = [];
      const seenGroups = new Set();
      let invalidSelection = false;
      rawState.selections.forEach((selection) => {
        if (!isObject(selection)) {
          invalidSelection = true;
          return;
        }
        const groupCode = normalizeCode(selection.groupCode);
        const optionCode = normalizeCode(selection.optionCode);
        if (!groupCode || !optionCode || seenGroups.has(groupCode)) {
          invalidSelection = true;
          return;
        }
        seenGroups.add(groupCode);
        selections.push({ groupCode, optionCode });
      });
      if (invalidSelection) return;
      imageStates.push({
        selections,
        image: normalizeMedia(rawState.image),
        position: orderValue(rawState.position) === Infinity ? null : rawState.position,
        sourceIndex: Number.isInteger(rawState.sourceIndex) ? rawState.sourceIndex : stateIndex
      });
    });

    const payload = {
      version: SUPPORTED_PAYLOAD_VERSION,
      locale,
      currency,
      product,
      groups: sortedGroups,
      variants,
      imageStates: sortByOrderAndSourceIndex(imageStates, 'position'),
      sizeOptionName
    };
    return { valid: errors.length === 0, errors, warnings, payload };
  }

  function buildSteps(payload) {
    if (!payload) return [];
    const groupSteps = payload.groups.map((group) => ({
      id: `group:${group.code}`,
      type: 'group',
      groupCode: group.code,
      title: group.title,
      required: group.required
    }));
    return [...groupSteps, { id: 'variant:size', type: 'variant', title: payload.sizeOptionName, required: true }, { id: 'review', type: 'review', title: 'Review', required: true }];
  }

  function resolveVariantBySize(sizeValue, payload) {
    if (!payload || !isNonEmptyString(sizeValue)) return { status: 'missing', variant: null };
    const matches = payload.variants.filter((variant) => normalizeCode(variant.sizeValue) === normalizeCode(sizeValue));
    if (matches.length > 1) return { status: 'unsupported', variant: null };
    if (!matches.length) return { status: 'missing', variant: null };
    if (!matches[0].available) return { status: 'unavailable', variant: null };
    return { status: 'selected', variant: matches[0] };
  }

  function findSelectedVariant(state, payload) {
    if (!state || !payload || !state.selectedVariantId) return null;
    return payload.variants.find((variant) => variant.id === state.selectedVariantId) || null;
  }

  function deriveBasePrice(state, payload) {
    const selectedVariant = findSelectedVariant(state, payload);
    if (selectedVariant && selectedVariant.available) return selectedVariant.priceCents;
    const availableVariants = payload.variants.filter((variant) => variant.available);
    if (!availableVariants.length) return null;
    return Math.min(...availableVariants.map((variant) => variant.priceCents));
  }

  function deriveSelectedAdditions(selectedOptions, payload) {
    if (!payload || !selectedOptions) return 0;
    return payload.groups.reduce((sum, group) => {
      const option = group.options.find((candidate) => candidate.code === selectedOptions[group.code]);
      return sum + (option && option.available ? option.priceAdditionCents : 0);
    }, 0);
  }

  function deriveStartingPrice(payload) {
    if (!payload) return null;
    const availableVariants = payload.variants.filter((variant) => variant.available);
    if (!availableVariants.length) return null;
    let result = Math.min(...availableVariants.map((variant) => variant.priceCents));
    for (const group of payload.groups) {
      if (!group.required) continue;
      const additions = group.options.filter((option) => option.available).map((option) => option.priceAdditionCents);
      if (!additions.length) return null;
      result += Math.min(...additions);
    }
    return result;
  }

  function deriveEstimatedTotal(state, payload) {
    const basePriceCents = deriveBasePrice(state, payload);
    if (basePriceCents === null) return null;
    return basePriceCents + deriveSelectedAdditions(state.selectedOptions, payload);
  }

  function validateStep(stepId, state, payload) {
    const step = buildSteps(payload).find((candidate) => candidate.id === stepId);
    if (!step) return { valid: false, code: 'UNKNOWN_STEP' };
    if (step.type === 'group') {
      const group = payload.groups.find((candidate) => candidate.code === step.groupCode);
      const selected = group && group.options.find((option) => option.code === state.selectedOptions[group.code] && option.available);
      if (group && group.required && !selected) return { valid: false, code: 'REQUIRED_SELECTION' };
      return { valid: true };
    }
    if (step.type === 'variant') {
      const variant = findSelectedVariant(state, payload);
      if (!variant) return { valid: false, code: 'REQUIRED_SIZE' };
      if (!variant.available) return { valid: false, code: 'UNAVAILABLE_VARIANT' };
      return { valid: true };
    }
    for (const group of payload.groups) {
      if (group.required && !group.options.some((option) => option.available && option.code === state.selectedOptions[group.code])) {
        return { valid: false, code: 'REQUIRED_SELECTION', groupCode: group.code };
      }
    }
    const variant = findSelectedVariant(state, payload);
    if (!variant || !variant.available) return { valid: false, code: 'REQUIRED_SIZE' };
    return { valid: true };
  }

  function deriveCompletedSteps(state, payload) {
    return buildSteps(payload).filter((step) => validateStep(step.id, state, payload).valid && step.id !== 'review').map((step) => step.id);
  }

  function deriveReview(state, payload) {
    const variant = findSelectedVariant(state, payload);
    return {
      productTitle: payload.product.title,
      groups: payload.groups.map((group) => ({
        stepId: `group:${group.code}`,
        title: group.title,
        option: group.options.find((option) => option.code === state.selectedOptions[group.code]) || null
      })),
      size: variant ? variant.sizeValue : null,
      variantId: variant ? variant.id : null,
      basePriceCents: deriveBasePrice(state, payload),
      selectedAdditionsCents: deriveSelectedAdditions(state.selectedOptions, payload),
      estimatedTotalCents: deriveEstimatedTotal(state, payload),
      image: resolveImage(state.selectedOptions, payload)
    };
  }

  function createImageSignature(selections) {
    return JSON.stringify((selections || []).map((selection) => [normalizeCode(selection.groupCode), normalizeCode(selection.optionCode)]));
  }

  function canonicalSelections(selectedOptions, payload, count = payload.groups.length) {
    return payload.groups.slice(0, count).reduce((selections, group) => {
      const optionCode = selectedOptions[group.code];
      if (isNonEmptyString(optionCode)) selections.push({ groupCode: group.code, optionCode });
      return selections;
    }, []);
  }

  function indexImageStates(payload) {
    const index = new Map();
    if (!payload) return index;
    payload.imageStates.forEach((state) => {
      const selections = state.selections
        .map((selection) => ({ groupCode: normalizeCode(selection.groupCode), optionCode: normalizeCode(selection.optionCode) }))
        .sort((left, right) => {
          const leftIndex = payload.groups.findIndex((group) => group.code === left.groupCode);
          const rightIndex = payload.groups.findIndex((group) => group.code === right.groupCode);
          return leftIndex - rightIndex;
        });
      const signature = createImageSignature(selections);
      if (!index.has(signature)) index.set(signature, []);
      index.get(signature).push({ ...state, selections });
    });
    index.forEach((states) => states.sort((left, right) => (orderValue(left.position) - orderValue(right.position)) || (left.sourceIndex - right.sourceIndex)));
    return index;
  }

  function resolveImage(selectedOptions, payload, imageIndex = indexImageStates(payload), failedSources = new Set()) {
    if (!payload) return { image: null, source: 'none', signature: '[]' };
    const allSelections = canonicalSelections(selectedOptions || {}, payload);
    for (let count = allSelections.length; count >= 0; count -= 1) {
      const selections = allSelections.slice(0, count);
      const signature = createImageSignature(selections);
      const candidates = imageIndex.get(signature) || [];
      for (const candidate of candidates) {
        if (candidate.image && !failedSources.has(candidate.image.src)) {
          return { image: candidate.image, source: count ? 'image-state' : 'initial', signature };
        }
      }
      if (count === 0) break;
    }
    if (payload.product.featuredImage && !failedSources.has(payload.product.featuredImage.src)) {
      return { image: payload.product.featuredImage, source: 'featured', signature: '[]' };
    }
    return { image: null, source: 'none', signature: '[]' };
  }

  function buildCartProperties(state, payload) {
    const properties = { _configurator_version: String(SUPPORTED_PAYLOAD_VERSION) };
    payload.groups.forEach((group, index) => {
      const option = group.options.find((candidate) => candidate.code === state.selectedOptions[group.code]);
      if (option) properties[`Configuração ${index + 1}`] = `${group.title}: ${option.name}`;
    });
    const variant = findSelectedVariant(state, payload);
    if (variant) properties.Tamanho = variant.sizeValue;
    return properties;
  }

  function createInitialState(payload) {
    const steps = buildSteps(payload);
    return {
      isOpen: false,
      currentStepId: steps[0] ? steps[0].id : 'review',
      selectedOptions: Object.create(null),
      selectedVariantId: null,
      isZoomOpen: false,
      isSizeChartOpen: false,
      validationErrors: Object.create(null),
      cartState: 'idle',
      cartError: null
    };
  }

  function translated(root, key, fallback) {
    return root.dataset[key] || fallback;
  }

  function replaceTokens(template, values) {
    return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`__${key.toUpperCase()}__`, String(value)), template);
  }

  function makeElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
  }

  function lockDocument() {
    scrollLockCount += 1;
    if (scrollLockCount === 1) {
      document.documentElement.classList.add('configurable-product-scroll-locked');
      document.body.classList.add('configurable-product-scroll-locked');
    }
  }

  function unlockDocument() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0 && document.documentElement && document.body) {
      document.documentElement.classList.remove('configurable-product-scroll-locked');
      document.body.classList.remove('configurable-product-scroll-locked');
    }
  }

  class ConfigurableProductController {
    constructor(root) {
      this.root = root;
      this.sectionId = root.dataset.sectionId || '';
      this.abortController = typeof AbortController === 'function' ? new AbortController() : null;
      this.returnFocusTarget = null;
      this.failedImageSources = new Set();
      this.imageIndex = new Map();
      this.cartTimeout = null;
      this.isRequestingSubmit = false;
      this.lockHeld = false;
      this.mounted = false;
      this.refs = {};
      this.payloadResult = null;
      this.payload = null;
      this.state = null;
      this.unsubscribeCartUpdate = null;
      this.unsubscribeCartError = null;
    }

    eventOptions() {
      return this.abortController ? { signal: this.abortController.signal } : undefined;
    }

    mount() {
      if (this.mounted) return this;
      this.mounted = true;
      this.collectRefs();
      this.parsePayload();
      if (!this.payloadResult || !this.payloadResult.valid) {
        this.showFailure(this.payloadResult?.errors?.[0] || 'INVALID_PAYLOAD');
        return this;
      }
      this.payload = this.payloadResult.payload;
      this.state = createInitialState(this.payload);
      this.imageIndex = indexImageStates(this.payload);
      this.renderOverview();
      this.attachListeners();
      this.attachCartSubscriptions();
      this.renderState();
      return this;
    }

    collectRefs() {
      const query = (selector) => this.root.querySelector(selector);
      this.refs.payload = query('[data-configurable-payload]');
      this.refs.dialog = query('[data-configurable-dialog]');
      this.refs.start = query('[data-configurable-start]');
      this.refs.close = query('[data-configurable-close]');
      this.refs.status = query('[data-configurable-status]');
      this.refs.title = query('[data-configurable-product-title]');
      this.refs.startingPrice = query('[data-configurable-starting-price]');
      this.refs.summary = query('[data-configurable-summary]');
      this.refs.overviewSteps = query('[data-configurable-overview-steps]');
      this.refs.imageFigure = query('[data-configurable-visual]');
      this.refs.image = query('[data-configurable-main-image]');
      this.refs.imageFallback = query('[data-configurable-image-fallback]');
      this.refs.zoomOpen = query('[data-configurable-zoom-open]');
      this.refs.stepContent = query('[data-configurable-step-content]');
      this.refs.review = query('[data-configurable-review]');
      this.refs.back = query('[data-configurable-back]');
      this.refs.next = query('[data-configurable-next]');
      this.refs.live = query('[data-configurable-live]');
      this.refs.progress = query('[data-configurable-progress]');
      this.refs.progressLabel = query('[data-configurable-progress-label]');
      this.refs.progressBar = query('[data-configurable-progress-bar]');
      this.refs.productFormElement = query('[data-configurable-product-form]');
      this.refs.form = query('[data-configurable-product-form] form');
      this.refs.variantId = query('[data-configurable-variant-id]');
      this.refs.quantity = query('[data-configurable-quantity]');
      this.refs.properties = query('[data-configurable-properties]');
      this.refs.submit = query('[data-configurable-submit]');
      this.refs.formError = query('[data-configurable-form-error]');
      this.refs.formErrorMessage = query('[data-configurable-form-error-message]');
      this.refs.zoom = query('[data-configurable-zoom]');
      this.refs.zoomImage = query('[data-configurable-zoom-image]');
      this.refs.zoomClose = query('[data-configurable-zoom-close]');
      this.refs.dialogTitle = query('.configurable-product__dialog-title');
    }

    parsePayload() {
      if (!this.refs.payload) {
        this.payloadResult = { valid: false, errors: ['MISSING_PAYLOAD'], warnings: [], payload: null };
        return;
      }
      try {
        this.payloadResult = normalizePayload(JSON.parse(this.refs.payload.textContent || ''));
      } catch (error) {
        this.payloadResult = { valid: false, errors: ['INVALID_PAYLOAD_JSON'], warnings: [], payload: null };
      }
    }

    attachListeners() {
      const options = this.eventOptions();
      this.root.addEventListener('click', (event) => this.handleClick(event), options);
      this.root.addEventListener('change', (event) => this.handleChange(event), options);
      this.root.addEventListener('error', (event) => this.handleAssetError(event), { ...(options || {}), capture: true });
      if (this.refs.dialog) {
        this.refs.dialog.addEventListener('cancel', (event) => this.handleCancel(event), options);
        this.refs.dialog.addEventListener('close', () => this.handleDialogClose(), options);
        this.refs.dialog.addEventListener('keydown', (event) => this.handleDialogKeydown(event), options);
      }
      if (this.refs.form) {
        this.refs.form.addEventListener('submit', (event) => this.handleFormSubmit(event), { ...(options || {}), capture: true });
      }
    }

    attachCartSubscriptions() {
      const subscribeFunction = typeof host.subscribe === 'function' ? host.subscribe : null;
      if (!subscribeFunction) return;
      this.unsubscribeCartUpdate = subscribeFunction(CART_UPDATE_EVENT, (data) => this.handleCartUpdate(data));
      this.unsubscribeCartError = subscribeFunction(CART_ERROR_EVENT, (data) => this.handleCartError(data));
    }

    handleClick(event) {
      const element = event.target instanceof Element ? event.target.closest('[data-configurable-start], [data-configurable-close], [data-configurable-back], [data-configurable-next], [data-configurable-clear], [data-configurable-edit], [data-configurable-submit], [data-configurable-zoom-open], [data-configurable-zoom-close]') : null;
      if (!element || !this.root.contains(element)) return;
      if (element.matches('[data-configurable-start]')) return this.openDialog();
      if (element.matches('[data-configurable-close]')) return this.closeDialog();
      if (element.matches('[data-configurable-back]')) return this.goBack();
      if (element.matches('[data-configurable-next]')) return this.goNext();
      if (element.matches('[data-configurable-clear]')) return this.clearSelection(element.dataset.groupCode);
      if (element.matches('[data-configurable-edit]')) return this.editStep(element.dataset.stepId);
      if (element.matches('[data-configurable-zoom-open]')) return this.openZoom();
      if (element.matches('[data-configurable-zoom-close]')) return this.closeZoom();
      if (element.matches('[data-configurable-submit]')) {
        event.preventDefault();
        return this.requestNativeSubmit();
      }
    }

    handleChange(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.matches('[data-configurable-option-input], [data-configurable-option-select]')) {
        const groupCode = target.dataset.groupCode;
        const optionCode = target.value;
        if (!groupCode || !optionCode || target.disabled) return;
        this.state.selectedOptions[groupCode] = optionCode;
        this.reconcileState();
        this.state.cartError = null;
        if (this.state.cartState === 'error') this.state.cartState = 'idle';
        this.renderState();
      } else if (target.matches('[data-configurable-size-input]')) {
        if (target.disabled) return;
        const result = resolveVariantBySize(target.dataset.sizeValue, this.payload);
        this.state.selectedVariantId = result.status === 'selected' ? result.variant.id : null;
        this.reconcileState();
        this.state.cartError = null;
        if (this.state.cartState === 'error') this.state.cartState = 'idle';
        this.renderState();
      }
    }

    handleAssetError(event) {
      const target = event.target;
      if (!(target instanceof HTMLImageElement) || !target.currentSrc && !target.src) return;
      if (!target.matches('[data-configurable-main-image], [data-configurable-zoom-image]')) return;
      const source = target.currentSrc || target.src;
      this.failedImageSources.add(source);
      if (target.matches('[data-configurable-main-image]')) {
        this.applyImage(resolveImage(this.state?.selectedOptions || {}, this.payload, this.imageIndex, this.failedImageSources));
      }
    }

    handleCancel(event) {
      event.preventDefault();
      if (this.state?.isZoomOpen) {
        this.closeZoom();
        return;
      }
      this.closeDialog();
    }

    handleDialogKeydown(event) {
      if (event.key === 'Escape' && this.state?.isZoomOpen) {
        event.preventDefault();
        this.closeZoom();
      }
    }

    openDialog() {
      if (!this.payload || !this.refs.dialog || typeof this.refs.dialog.showModal !== 'function') {
        this.showFailure('DIALOG_UNSUPPORTED');
        return;
      }
      if (this.refs.dialog.open) return;
      this.returnFocusTarget = document.activeElement;
      try {
        this.refs.dialog.showModal();
      } catch (error) {
        this.showFailure('DIALOG_OPEN_FAILED');
        return;
      }
      if (!this.refs.dialog.open) {
        this.showFailure('DIALOG_OPEN_FAILED');
        return;
      }
      this.state.isOpen = true;
      if (!this.lockHeld) {
        lockDocument();
        this.lockHeld = true;
      }
      this.renderState();
      (this.refs.stepContent.querySelector('input, select, button') || this.refs.dialogTitle)?.focus();
    }

    closeDialog() {
      if (this.state?.cartState === 'submitting') return;
      if (this.state) this.state.isOpen = false;
      if (this.refs.dialog?.open && typeof this.refs.dialog.close === 'function') {
        this.refs.dialog.close();
      } else {
        this.handleDialogClose();
      }
    }

    handleDialogClose() {
      if (this.lockHeld) {
        unlockDocument();
        this.lockHeld = false;
      }
      if (this.state) {
        this.state.isOpen = false;
        this.state.isZoomOpen = false;
      }
      this.closeZoom(true);
      if (this.returnFocusTarget && this.returnFocusTarget.isConnected) this.returnFocusTarget.focus();
      this.returnFocusTarget = null;
    }

    openZoom() {
      const image = resolveImage(this.state?.selectedOptions || {}, this.payload, this.imageIndex, this.failedImageSources).image;
      if (!image || !this.refs.zoom || !this.refs.zoomImage) return;
      this.refs.zoomImage.src = image.src;
      this.refs.zoomImage.alt = image.alt || this.payload.product.title;
      this.refs.zoom.hidden = false;
      this.state.isZoomOpen = true;
      this.refs.zoomClose?.focus();
    }

    closeZoom(force = false) {
      if (!this.refs.zoom || (!this.state?.isZoomOpen && !force)) return;
      this.refs.zoom.hidden = true;
      if (this.state) this.state.isZoomOpen = false;
      if (!force && this.refs.stepContent) (this.refs.stepContent.querySelector('input, select, button') || this.refs.dialogTitle)?.focus();
    }

    goBack() {
      const steps = buildSteps(this.payload);
      const currentIndex = steps.findIndex((step) => step.id === this.state.currentStepId);
      if (currentIndex > 0) {
        this.state.currentStepId = steps[currentIndex - 1].id;
        this.state.validationErrors = Object.create(null);
        this.renderState();
      }
    }

    goNext() {
      const steps = buildSteps(this.payload);
      const currentIndex = steps.findIndex((step) => step.id === this.state.currentStepId);
      const validation = validateStep(this.state.currentStepId, this.state, this.payload);
      if (!validation.valid) {
        this.state.validationErrors[this.state.currentStepId] = validation.code;
        this.announceValidation(validation);
        this.renderState();
        return;
      }
      if (currentIndex < steps.length - 1) {
        this.state.currentStepId = steps[currentIndex + 1].id;
        this.state.validationErrors = Object.create(null);
        this.renderState();
      }
    }

    editStep(stepId) {
      if (!buildSteps(this.payload).some((step) => step.id === stepId)) return;
      this.state.currentStepId = stepId;
      this.state.validationErrors = Object.create(null);
      this.renderState();
    }

    clearSelection(groupCode) {
      if (!groupCode) return;
      const group = this.payload.groups.find((candidate) => candidate.code === groupCode);
      if (!group || group.required) return;
      delete this.state.selectedOptions[groupCode];
      this.reconcileState();
      this.renderState();
    }

    reconcileState() {
      this.payload.groups.forEach((group) => {
        const option = group.options.find((candidate) => candidate.code === this.state.selectedOptions[group.code]);
        if (!option || !option.available) delete this.state.selectedOptions[group.code];
      });
      const selectedVariant = findSelectedVariant(this.state, this.payload);
      if (selectedVariant && !selectedVariant.available) this.state.selectedVariantId = null;
      const steps = buildSteps(this.payload);
      if (!steps.some((step) => step.id === this.state.currentStepId)) this.state.currentStepId = steps[0]?.id || 'review';
    }

    announceValidation(validation) {
      if (validation.code === 'REQUIRED_SELECTION') {
        const group = this.payload.groups.find((candidate) => candidate.code === (validation.groupCode || this.state.currentStepId.replace('group:', '')));
        const message = replaceTokens(translated(this.root, 'labelRequiredError', 'Select an option for __GROUP__.'), { group: group?.title || '' });
        this.setLive(message);
      } else if (validation.code === 'REQUIRED_SIZE') {
        this.setLive(translated(this.root, 'labelSelectOption', 'Select an option'));
      } else {
        this.setLive(translated(this.root, 'labelError', 'This configuration cannot continue.'));
      }
    }

    renderOverview() {
      if (!this.payload) return;
      if (this.refs.title) this.refs.title.textContent = this.payload.product.title;
      this.renderSummary();
      this.renderOverviewSteps();
      this.applyImage(resolveImage({}, this.payload, this.imageIndex, this.failedImageSources));
      const startingPrice = deriveStartingPrice(this.payload);
      if (this.refs.startingPrice) this.refs.startingPrice.textContent = startingPrice === null ? '—' : this.formatMoney(startingPrice);
      if (this.refs.zoomOpen) this.refs.zoomOpen.hidden = !this.payload.product.featuredImage;
    }

    renderSummary() {
      if (!this.refs.summary) return;
      this.refs.summary.replaceChildren();
      const list = makeElement('ul', 'configurable-product__addition-list');
      this.payload.groups.forEach((group) => {
        const groupItem = makeElement('li', 'configurable-product__addition-group');
        groupItem.append(makeElement('h3', 'configurable-product__addition-title', group.title));
        const options = makeElement('ul', 'configurable-product__option-list');
        group.options.forEach((option) => {
          const item = makeElement('li', 'configurable-product__option-row');
          item.append(makeElement('span', '', option.name));
          const addition = option.available && option.priceAdditionCents > 0 ? `+${this.formatMoney(option.priceAdditionCents)}` : translated(this.root, 'labelNoAddition', 'No addition');
          const amount = makeElement('span', '', addition);
          if (!option.available) amount.append(` — ${translated(this.root, 'labelUnavailable', 'Unavailable')}`);
          item.append(amount);
          options.append(item);
        });
        groupItem.append(options);
        list.append(groupItem);
      });
      this.refs.summary.append(list, makeElement('p', 'configurable-product__display-note', translated(this.root, 'labelDisplayOnly', 'Visual estimate only.')));
    }

    renderOverviewSteps() {
      if (!this.refs.overviewSteps) return;
      this.refs.overviewSteps.replaceChildren();
      buildSteps(this.payload).forEach((step, index) => {
        const item = makeElement('li', 'configurable-product__step-item');
        item.dataset.stepId = step.id;
        item.append(makeElement('span', 'configurable-product__step-number', String(index + 1)));
        const copy = makeElement('span', 'configurable-product__step-copy');
        copy.append(makeElement('span', 'configurable-product__step-title', step.id === 'review' ? translated(this.root, 'labelReview', 'Review') : step.title));
        copy.append(makeElement('span', 'configurable-product__step-hint', step.required ? translated(this.root, 'labelRequired', 'Required') : translated(this.root, 'labelOptional', 'Optional')));
        item.append(copy);
        this.refs.overviewSteps.append(item);
      });
    }

    renderState() {
      if (!this.payload || !this.state) return;
      this.reconcileState();
      this.renderOverviewStepsState();
      this.renderProgress();
      this.renderCurrentStep();
      this.renderFormState();
      this.applyImage(resolveImage(this.state.selectedOptions, this.payload, this.imageIndex, this.failedImageSources));
    }

    renderOverviewStepsState() {
      const completed = new Set(deriveCompletedSteps(this.state, this.payload));
      const current = this.state.currentStepId;
      this.refs.overviewSteps?.querySelectorAll('[data-step-id]').forEach((item) => {
        item.classList.toggle('configurable-product__step-item--current', item.dataset.stepId === current);
        item.classList.toggle('configurable-product__step-item--completed', completed.has(item.dataset.stepId));
        item.setAttribute('aria-current', item.dataset.stepId === current ? 'step' : 'false');
      });
    }

    renderProgress() {
      const steps = buildSteps(this.payload);
      const currentIndex = Math.max(0, steps.findIndex((step) => step.id === this.state.currentStepId));
      const current = steps[currentIndex] || steps[0];
      if (!current) return;
      const label = replaceTokens(translated(this.root, 'labelStep', 'Step __CURRENT__ of __TOTAL__'), { current: currentIndex + 1, total: steps.length });
      if (this.refs.progressLabel) this.refs.progressLabel.textContent = label;
      if (this.refs.progress) {
        this.refs.progress.setAttribute('aria-valuemax', String(steps.length));
        this.refs.progress.setAttribute('aria-valuenow', String(currentIndex + 1));
      }
      if (this.refs.progressBar) this.refs.progressBar.style.width = `${((currentIndex + 1) / steps.length) * 100}%`;
    }

    renderCurrentStep() {
      const steps = buildSteps(this.payload);
      const current = steps.find((step) => step.id === this.state.currentStepId) || steps[0];
      if (!current || !this.refs.stepContent || !this.refs.review) return;
      this.refs.stepContent.replaceChildren();
      this.refs.review.replaceChildren();
      setHidden(this.refs.review, current.type !== 'review');
      if (current.type === 'group') this.refs.stepContent.append(this.createGroupStep(current));
      if (current.type === 'variant') this.refs.stepContent.append(this.createVariantStep(current));
      if (current.type === 'review') this.renderReview();
      setHidden(this.refs.back, steps.indexOf(current) === 0);
      setHidden(this.refs.next, current.type === 'review');
      if (this.refs.next) this.refs.next.textContent = current.type === 'review' ? translated(this.root, 'labelReview', 'Review') : translated(this.root, 'labelContinue', 'Continue');
      if (this.refs.live && this.state.isOpen) this.refs.live.textContent = replaceTokens(translated(this.root, 'labelStep', 'Step __CURRENT__ of __TOTAL__'), { current: steps.indexOf(current) + 1, total: steps.length });
    }

    createGroupStep(step) {
      const group = this.payload.groups.find((candidate) => candidate.code === step.groupCode);
      const fieldset = makeElement('fieldset', `configurable-product__option-step configurable-product__option-step--${group.interfaceType}`);
      fieldset.dataset.groupCode = group.code;
      const legend = makeElement('legend', 'configurable-product__option-legend');
      legend.append(makeElement('span', 'configurable-product__step-label', replaceTokens(translated(this.root, 'labelChoose', 'Choose __GROUP__'), { group: group.title })));
      if (group.required) legend.append(makeElement('span', 'configurable-product__required-mark', ` * ${translated(this.root, 'labelRequired', 'Required')}`));
      else legend.append(makeElement('span', 'configurable-product__required-mark', ` (${translated(this.root, 'labelOptional', 'Optional')})`));
      fieldset.append(legend);
      if (group.description) fieldset.append(makeElement('p', 'configurable-product__option-description', group.description));
      const controlId = `ConfigurableOption-${this.sectionId}-${group.code}`;
      if (group.interfaceType === 'select') {
        const select = makeElement('select', 'configurable-product__select');
        select.id = controlId;
        select.name = controlId;
        select.dataset.configurableOptionSelect = '';
        select.dataset.groupCode = group.code;
        select.setAttribute('aria-label', group.title);
        const placeholder = makeElement('option', '', translated(this.root, 'labelSelectOption', 'Select an option'));
        placeholder.value = '';
        select.append(placeholder);
        group.options.forEach((option) => {
          const optionElement = makeElement('option', '', option.available ? option.name : `${option.name} — ${translated(this.root, 'labelUnavailable', 'Unavailable')}`);
          optionElement.value = option.code;
          optionElement.disabled = !option.available;
          optionElement.selected = this.state.selectedOptions[group.code] === option.code;
          select.append(optionElement);
        });
        fieldset.append(select);
      } else {
        const list = makeElement('div', 'configurable-product__option-grid');
        group.options.forEach((option, index) => {
          const id = `${controlId}-${index}`;
          const label = makeElement('label', 'configurable-product__option-card');
          label.htmlFor = id;
          label.dataset.optionCode = option.code;
          const input = makeElement('input');
          input.type = 'radio';
          input.id = id;
          input.name = controlId;
          input.value = option.code;
          input.dataset.configurableOptionInput = '';
          input.dataset.groupCode = group.code;
          input.checked = this.state.selectedOptions[group.code] === option.code;
          input.disabled = !option.available;
          if (!option.available) label.classList.add('is-unavailable');
          const content = makeElement('span', 'configurable-product__option-card-content');
          if (option.image && ['image_cards', 'buttons'].includes(group.interfaceType)) {
            const image = makeElement('img', 'configurable-product__option-image');
            image.src = option.image.src;
            image.alt = option.image.alt || option.name;
            image.loading = 'lazy';
            if (option.image.width) image.width = option.image.width;
            if (option.image.height) image.height = option.image.height;
            content.append(image);
          }
          if (group.interfaceType === 'swatches' && option.color) {
            const swatch = makeElement('span', 'configurable-product__swatch');
            swatch.style.setProperty('--configurable-swatch-color', option.color);
            swatch.setAttribute('aria-hidden', 'true');
            content.append(swatch);
          }
          content.append(makeElement('span', 'configurable-product__option-name', option.name));
          if (option.priceAdditionCents > 0) content.append(makeElement('span', 'configurable-product__option-price', `+${this.formatMoney(option.priceAdditionCents)}`));
          if (!option.available) content.append(makeElement('span', 'configurable-product__option-unavailable', translated(this.root, 'labelUnavailable', 'Unavailable')));
          if (option.description) content.append(makeElement('span', 'configurable-product__option-description', option.description));
          label.append(input, content);
          list.append(label);
        });
        fieldset.append(list);
      }
      if (!group.required) {
        const clear = makeElement('button', 'configurable-product__clear', translated(this.root, 'labelClear', 'Clear selection'));
        clear.type = 'button';
        clear.dataset.configurableClear = '';
        clear.dataset.groupCode = group.code;
        clear.disabled = !this.state.selectedOptions[group.code];
        fieldset.append(clear);
      }
      const error = this.state.validationErrors[step.id];
      if (error) {
        const errorMessage = makeElement('p', 'configurable-product__field-error', replaceTokens(translated(this.root, 'labelRequiredError', 'Select an option for __GROUP__.'), { group: group.title }));
        errorMessage.setAttribute('role', 'alert');
        fieldset.append(errorMessage);
      }
      return fieldset;
    }

    createVariantStep(step) {
      const fieldset = makeElement('fieldset', 'configurable-product__option-step configurable-product__option-step--variant');
      const legend = makeElement('legend', 'configurable-product__option-legend', replaceTokens(translated(this.root, 'labelChoose', 'Choose __GROUP__'), { group: step.title }));
      fieldset.append(legend);
      const list = makeElement('div', 'configurable-product__option-grid configurable-product__option-grid--sizes');
      const values = [];
      this.payload.variants.forEach((variant) => {
        if (!values.some((value) => normalizeCode(value) === normalizeCode(variant.sizeValue))) values.push(variant.sizeValue);
      });
      values.forEach((sizeValue, index) => {
        const result = resolveVariantBySize(sizeValue, this.payload);
        const id = `ConfigurableSize-${this.sectionId}-${index}`;
        const label = makeElement('label', 'configurable-product__option-card configurable-product__size-card');
        label.htmlFor = id;
        const input = makeElement('input');
        input.type = 'radio';
        input.id = id;
        input.name = `ConfigurableSize-${this.sectionId}`;
        input.value = sizeValue;
        input.dataset.configurableSizeInput = '';
        input.dataset.sizeValue = sizeValue;
        input.checked = this.state.selectedVariantId === result.variant?.id;
        input.disabled = result.status !== 'selected';
        if (input.disabled) label.classList.add('is-unavailable');
        label.append(input, makeElement('span', 'configurable-product__option-name', sizeValue));
        if (result.status !== 'selected') label.append(makeElement('span', 'configurable-product__option-unavailable', translated(this.root, 'labelUnavailable', 'Unavailable')));
        list.append(label);
      });
      fieldset.append(list);
      if (this.state.validationErrors[step.id]) fieldset.append(makeElement('p', 'configurable-product__field-error', translated(this.root, 'labelSelectOption', 'Select an option')));
      return fieldset;
    }

    renderReview() {
      const review = deriveReview(this.state, this.payload);
      const wrapper = makeElement('section', 'configurable-product__review-content');
      wrapper.append(makeElement('h3', 'configurable-product__review-title', translated(this.root, 'labelReviewTitle', 'Review your configuration')));
      wrapper.append(makeElement('p', 'configurable-product__review-intro', translated(this.root, 'labelReviewIntro', 'Check your selections before adding this product to your cart.')));
      const list = makeElement('dl', 'configurable-product__review-list');
      review.groups.forEach((group) => {
        const name = makeElement('dt', '', group.title);
        const value = makeElement('dd', '', group.option?.name || translated(this.root, 'labelNotSelected', 'Not selected'));
        const edit = makeElement('button', 'configurable-product__edit', translated(this.root, 'labelEdit', 'Edit'));
        edit.type = 'button';
        edit.dataset.configurableEdit = '';
        edit.dataset.stepId = group.stepId;
        value.append(' ', edit);
        list.append(name, value);
      });
      list.append(makeElement('dt', '', this.payload.sizeOptionName), makeElement('dd', '', review.size || translated(this.root, 'labelNotSelected', 'Not selected')));
      wrapper.append(list);
      const prices = makeElement('dl', 'configurable-product__review-prices');
      prices.append(makeElement('dt', '', translated(this.root, 'labelBasePrice', 'Base price')), makeElement('dd', '', review.basePriceCents === null ? '—' : this.formatMoney(review.basePriceCents)));
      prices.append(makeElement('dt', '', translated(this.root, 'labelCustomizations', 'Customizations')), makeElement('dd', '', this.formatMoney(review.selectedAdditionsCents)));
      prices.append(makeElement('dt', 'configurable-product__review-total-label', translated(this.root, 'labelEstimatedTotal', 'Estimated total')), makeElement('dd', 'configurable-product__review-total-value', review.estimatedTotalCents === null ? '—' : this.formatMoney(review.estimatedTotalCents)));
      wrapper.append(prices, makeElement('p', 'configurable-product__display-note', translated(this.root, 'labelDisplayOnly', 'Visual estimate only.')));
      this.refs.review.append(wrapper);
    }

    renderFormState() {
      const reviewValid = validateStep('review', this.state, this.payload).valid;
      const onReview = this.state.currentStepId === 'review';
      setHidden(this.refs.productFormElement, !onReview);
      if (this.refs.submit) {
        const canSubmit = onReview && reviewValid && this.state.cartState !== 'submitting' && this.hasOwnedProductForm();
        this.refs.submit.disabled = !canSubmit;
        this.refs.submit.setAttribute('aria-disabled', canSubmit ? 'false' : 'true');
      }
      if (this.refs.variantId) this.refs.variantId.value = findSelectedVariant(this.state, this.payload)?.id || '';
      if (this.refs.quantity) this.refs.quantity.value = '1';
      this.syncFormProperties();
      if (this.state.cartState === 'error') {
        setHidden(this.refs.formError, false);
        if (this.refs.formErrorMessage) this.refs.formErrorMessage.textContent = this.state.cartError || translated(this.root, 'labelCartError', 'Unable to add this configuration.');
      } else {
        setHidden(this.refs.formError, true);
      }
    }

    hasOwnedProductForm() {
      if (!this.refs.productFormElement || !this.refs.form || !this.refs.submit || !this.refs.variantId || !this.refs.quantity) return false;
      const expectedId = `ConfigurableProductForm-${this.sectionId}`;
      return this.refs.form.id === expectedId && this.refs.form.closest('[data-configurable-pdp]') === this.root && Boolean(host.customElements?.get?.('product-form'));
    }

    syncFormProperties() {
      if (!this.refs.properties || !this.payload || !this.state) return;
      this.refs.properties.replaceChildren();
      const properties = buildCartProperties(this.state, this.payload);
      Object.entries(properties).forEach(([key, value]) => {
        const input = makeElement('input');
        input.type = 'hidden';
        input.name = `properties[${key}]`;
        input.value = value;
        this.refs.properties.append(input);
      });
    }

    requestNativeSubmit() {
      if (!this.refs.form || !this.refs.submit || this.isRequestingSubmit) return;
      if (!validateStep('review', this.state, this.payload).valid || !this.hasOwnedProductForm()) {
        this.state.validationErrors.review = 'INVALID_REVIEW';
        this.setLive(translated(this.root, 'labelCartError', 'This configuration cannot be added yet.'));
        this.renderState();
        return;
      }
      this.syncFormProperties();
      this.isRequestingSubmit = true;
      try {
        if (typeof this.refs.form.requestSubmit !== 'function') throw new Error('REQUEST_SUBMIT_UNSUPPORTED');
        this.refs.form.requestSubmit(this.refs.submit);
      } catch (error) {
        this.state.cartState = 'error';
        this.state.cartError = translated(this.root, 'labelCartError', 'Unable to add this configuration.');
        this.renderState();
      } finally {
        this.isRequestingSubmit = false;
      }
    }

    handleFormSubmit(event) {
      if (!this.state || !this.payload) return;
      const validation = validateStep('review', this.state, this.payload);
      if (!validation.valid || !this.hasOwnedProductForm()) {
        event.preventDefault();
        this.state.cartState = 'error';
        this.state.cartError = translated(this.root, 'labelCartError', 'Unable to add this configuration.');
        this.renderState();
        return;
      }
      this.syncFormProperties();
      this.state.cartState = 'submitting';
      this.state.cartError = null;
      this.startCartTimeout();
      this.renderFormState();
    }

    startCartTimeout() {
      if (this.cartTimeout) clearTimeout(this.cartTimeout);
      this.cartTimeout = setTimeout(() => {
        if (this.state?.cartState !== 'submitting') return;
        this.state.cartState = 'error';
        this.state.cartError = translated(this.root, 'labelCartError', 'Unable to add this configuration.');
        this.renderFormState();
        this.setLive(this.state.cartError);
      }, 15000);
    }

    clearCartTimeout() {
      if (this.cartTimeout) clearTimeout(this.cartTimeout);
      this.cartTimeout = null;
    }

    matchesCurrentVariant(data) {
      return data && data.source === 'product-form' && String(data.productVariantId || '') === String(this.state?.selectedVariantId || '');
    }

    handleCartUpdate(data) {
      if (!this.matchesCurrentVariant(data)) return;
      this.clearCartTimeout();
      this.state.cartState = 'success';
      this.state.cartError = null;
      this.closeDialog();
      this.renderFormState();
    }

    handleCartError(data) {
      if (!this.matchesCurrentVariant(data)) return;
      this.clearCartTimeout();
      this.state.cartState = 'error';
      this.state.cartError = translated(this.root, 'labelCartError', 'Unable to add this configuration.');
      this.renderFormState();
      this.setLive(this.state.cartError);
    }

    applyImage(result) {
      const image = result?.image || null;
      if (!this.refs.imageFigure) return;
      if (image) {
        if (!this.refs.image) {
          this.refs.image = makeElement('img', 'configurable-product__image');
          this.refs.image.dataset.configurableMainImage = '';
          this.refs.imageFigure.insertBefore(this.refs.image, this.refs.zoomOpen || null);
        }
        this.refs.image.src = image.src;
        this.refs.image.alt = image.alt || this.payload.product.title;
        if (image.width) this.refs.image.width = image.width; else this.refs.image.removeAttribute('width');
        if (image.height) this.refs.image.height = image.height; else this.refs.image.removeAttribute('height');
        if (image.srcset) this.refs.image.srcset = image.srcset; else this.refs.image.removeAttribute('srcset');
        if (image.sizes) this.refs.image.sizes = image.sizes; else this.refs.image.removeAttribute('sizes');
        setHidden(this.refs.image, false);
        setHidden(this.refs.imageFallback, true);
        setHidden(this.refs.zoomOpen, false);
      } else {
        setHidden(this.refs.image, true);
        setHidden(this.refs.imageFallback, false);
        setHidden(this.refs.zoomOpen, true);
      }
    }

    applyFailureClasses() {
      this.root.classList.add('configurable-product--error');
      this.root.classList.remove('configurable-product--ready');
    }

    showFailure(code) {
      this.applyFailureClasses();
      if (this.refs.start) {
        this.refs.start.disabled = true;
        this.refs.start.setAttribute('aria-disabled', 'true');
      }
      if (this.refs.status) {
        this.refs.status.hidden = false;
        this.refs.status.textContent = translated(this.root, 'labelError', 'This configurable product is not available right now.');
      }
      if (this.refs.productFormElement) this.refs.productFormElement.hidden = true;
      if (this.refs.submit) {
        this.refs.submit.disabled = true;
        this.refs.submit.setAttribute('aria-disabled', 'true');
      }
      this.root.dataset.configurableError = code;
    }

    setLive(message) {
      if (this.refs.live) this.refs.live.textContent = message || '';
      if (this.refs.status && !this.state?.isOpen) {
        this.refs.status.hidden = !message;
        this.refs.status.textContent = message || '';
      }
    }

    formatMoney(cents) {
      if (!Number.isInteger(cents) || !/^[A-Z]{3}$/.test(this.payload.currency)) return '—';
      try {
        return new Intl.NumberFormat(this.payload.locale || undefined, { style: 'currency', currency: this.payload.currency }).format(cents / 100);
      } catch (error) {
        return '—';
      }
    }

    teardown() {
      this.clearCartTimeout();
      if (typeof this.unsubscribeCartUpdate === 'function') this.unsubscribeCartUpdate();
      if (typeof this.unsubscribeCartError === 'function') this.unsubscribeCartError();
      this.unsubscribeCartUpdate = null;
      this.unsubscribeCartError = null;
      if (this.refs.dialog?.open && typeof this.refs.dialog.close === 'function') this.refs.dialog.close();
      if (this.lockHeld) {
        unlockDocument();
        this.lockHeld = false;
      }
      this.closeZoom(true);
      this.abortController?.abort();
      this.mounted = false;
    }
  }

  function mountRoot(root) {
    if (!root || rootRegistry.has(root)) return rootRegistry.get(root);
    const controller = new ConfigurableProductController(root);
    rootRegistry.set(root, controller);
    return controller.mount();
  }

  function unmountRoot(root) {
    const controller = rootRegistry.get(root);
    if (!controller) return;
    controller.teardown();
    rootRegistry.delete(root);
  }

  function rootsWithin(target) {
    const roots = [];
    if (target instanceof Element && target.matches('[data-configurable-pdp]')) roots.push(target);
    if (target?.querySelectorAll) roots.push(...target.querySelectorAll('[data-configurable-pdp]'));
    return [...new Set(roots)];
  }

  function mountAll() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-configurable-pdp]').forEach((root) => mountRoot(root));
  }

  function installLifecycle() {
    if (lifecycleInstalled || typeof document === 'undefined') return;
    lifecycleInstalled = true;
    document.addEventListener('shopify:section:load', (event) => {
      rootsWithin(event.target).forEach((root) => {
        unmountRoot(root);
        mountRoot(root);
      });
    });
    document.addEventListener('shopify:section:unload', (event) => {
      rootsWithin(event.target).forEach((root) => unmountRoot(root));
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll, { once: true });
    else mountAll();
  }

  const api = {
    SUPPORTED_PAYLOAD_VERSION,
    normalizeCode,
    sortByOrderAndSourceIndex,
    normalizePayload,
    buildSteps,
    validateStep,
    resolveVariantBySize,
    deriveStartingPrice,
    deriveSelectedAdditions,
    deriveEstimatedTotal,
    createImageSignature,
    indexImageStates,
    resolveImage,
    deriveCompletedSteps,
    deriveReview,
    buildCartProperties,
    createInitialState,
    mountAll,
    mountRoot,
    unmountRoot,
    registry: rootRegistry
  };
  host[REGISTRY_KEY] = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  installLifecycle();
})();
