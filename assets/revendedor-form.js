(function () {
  const SECTION_SELECTOR = '[data-revendedor-form-section]';
  const FORM_SELECTOR = '[data-revendedor-form]';
  const VIA_CEP_URL = 'https://viacep.com.br/ws/{cep}/json/';
  const IBGE_CITIES_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios';
  const REQUEST_TIMEOUT = 8000;
  const SUBMIT_TIMEOUT = 15000;
  const ANTISPAM_VERSION = 'ammis-revendedor-v1';

  const cityCache = new Map();
  const cepCache = new Map();

  const messages = {
    required: 'Preencha este campo.',
    cnpj: 'Informe um CNPJ valido.',
    email: 'Informe um e-mail valido.',
    instagram: 'Informe o Instagram da loja ou marque a opcao sem Instagram.',
    website: 'Informe um site valido.',
    phone: 'Informe um telefone valido.',
    whatsapp: 'Informe um celular com WhatsApp valido.',
    postalCode: 'Informe um CEP valido.',
    postalCodeNotFound: 'Nao foi possivel localizar este CEP. Preencha o endereco manualmente.',
    postalCodeError: 'Nao foi possivel consultar o CEP agora. Preencha o endereco manualmente.',
    postalCodeLoading: 'Consultando CEP...',
    postalCodeFound: 'CEP localizado. Confira os dados do endereco.',
    cityLoading: 'Carregando cidades...',
    cityLoaded: 'Cidades carregadas.',
    cityError: 'Nao foi possivel carregar as cidades. Digite a cidade manualmente.',
    cityManual: 'Digite a cidade manualmente.',
    state: 'Informe o estado.',
    storeType: 'Selecione o tipo da loja.',
    consent: 'Aceite a Politica de Privacidade para continuar.',
    addressNumber: 'Informe um numero valido.'
  };

  const payloadFields = [
    'company_legal_name',
    'cnpj',
    'instagram',
    'website',
    'other_brands',
    'store_description',
    'responsible_name',
    'email',
    'phone_country',
    'phone',
    'whatsapp_phone',
    'postal_code',
    'address_line',
    'address_number',
    'address_complement',
    'neighborhood',
    'state',
    'city',
    'store_type'
  ];

  const labels = {
    company_legal_name: 'Razao social',
    cnpj: 'CNPJ',
    instagram: 'Instagram da loja',
    website: 'Site ou loja virtual',
    responsible_name: 'Nome completo do responsavel',
    email: 'E-mail',
    phone_country: 'Pais do telefone',
    phone: 'Telefone de contato',
    whatsapp_phone: 'Celular com WhatsApp',
    postal_code: 'CEP',
    address_line: 'Logradouro',
    address_number: 'Numero',
    neighborhood: 'Bairro',
    state: 'Estado',
    city: 'Cidade',
    store_type: 'Tipo da loja',
    privacy_consent: 'Consentimento'
  };

  function onlyDigits(value) {
    return (value || '').replace(/\D/g, '');
  }

  function trimSpaces(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeText(value) {
    return trimSpaces(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function setStatus(element, message, status) {
    if (!element) return;
    element.textContent = message || '';
    if (status) {
      element.dataset.status = status;
    } else {
      delete element.dataset.status;
    }
  }

  function getPostalStatus(form) {
    return form.querySelector('[data-postal-code-status]');
  }

  function getCityStatus(form) {
    return form.querySelector('[data-city-status]');
  }

  function abortController(controller) {
    if (controller) controller.abort();
  }

  function fetchJson(url, controller) {
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    return fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Request failed');
        return response.json();
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
  }

  function getSetting(form, name, fallback) {
    return form.dataset[name] || fallback || '';
  }

  function getSafeServerMessage(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const message = trimSpaces(value);
    if (!message || message.length > 180 || /<[^>]*>/.test(message)) return fallback;
    return message;
  }

  function getPageOrigin() {
    try {
      const url = new URL(window.location.href);
      url.hash = '';
      return url.href;
    } catch (error) {
      return window.location.href.split('#')[0];
    }
  }

  function getUtmValue(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || '';
    } catch (error) {
      return '';
    }
  }

  function parseSubmissionResponse(status, responseText) {
    const text = trimSpaces(responseText);
    if (!text) {
      return {
        ok: false,
        type: 'invalid',
        message: ''
      };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      return {
        ok: false,
        type: 'invalid',
        message: ''
      };
    }

    if (!status.ok) {
      return {
        ok: false,
        type: 'server',
        message: data && data.message
      };
    }

    if (data && data.success === true && data.code === 'CREATED') {
      return {
        ok: true,
        data: data
      };
    }

    return {
      ok: false,
      type: data && data.success === false ? 'server' : 'invalid',
      message: data && data.message
    };
  }

  function isBrazil(form) {
    const country = form.querySelector('[data-country-select]');
    return !country || country.value === 'BR';
  }

  function maskCnpj(value) {
    const digits = onlyDigits(value).slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function maskPostalCode(value) {
    const digits = onlyDigits(value).slice(0, 8);
    return digits.replace(/^(\d{5})(\d)/, '$1-$2');
  }

  function maskBrazilPhone(value, forceLandline) {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (forceLandline || digits.length <= 10) {
      return digits
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .slice(0, 14);
    }
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  }

  function validateCnpj(value) {
    const cnpj = onlyDigits(value);
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

    const calc = function (length) {
      let sum = 0;
      let pos = length - 7;
      for (let i = length; i >= 1; i -= 1) {
        sum += Number(cnpj.charAt(length - i)) * pos;
        pos -= 1;
        if (pos < 2) pos = 9;
      }
      const result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
      return result;
    };

    return calc(12) === Number(cnpj.charAt(12)) && calc(13) === Number(cnpj.charAt(13));
  }

  function normalizeInstagram(value) {
    let text = trimSpaces(value).replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    text = text.replace(/^instagram\.com\//i, '').split(/[/?#]/)[0];
    text = text.replace(/[^a-zA-Z0-9._]/g, '');
    return text ? '@' + text.replace(/^@+/, '') : '';
  }

  function isValidInstagram(value) {
    const normalized = normalizeInstagram(value);
    return /^@[a-zA-Z0-9._]{1,149}$/.test(normalized);
  }

  function isValidWebsite(value) {
    const text = trimSpaces(value);
    if (!text) return true;
    if (/\s/.test(text)) return false;
    const withProtocol = /^https?:\/\//i.test(text) ? text : 'https://' + text;
    try {
      const url = new URL(withProtocol);
      return Boolean(url.hostname && url.hostname.includes('.') && !url.hostname.startsWith('.'));
    } catch (error) {
      return false;
    }
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  function isBrazilMobile(value) {
    const digits = onlyDigits(value);
    return digits.length === 11 && digits.charAt(2) === '9';
  }

  function isBrazilLandline(value) {
    const digits = onlyDigits(value);
    return digits.length === 10;
  }

  function isInternationalPhone(value) {
    const digits = onlyDigits(value);
    return digits.length >= 7 && digits.length <= 18;
  }

  function getField(form, name) {
    const fields = Array.from(form.querySelectorAll('[name="' + name + '"]'));
    return fields.find((field) => !field.disabled && !field.hidden && field.offsetParent !== null) || fields[0];
  }

  function getActiveFieldValue(form, name) {
    const field = getField(form, name);
    if (!field) return '';
    if (field.type === 'radio') {
      const checked = form.querySelector('[name="' + name + '"]:checked');
      return checked ? checked.value : '';
    }
    return trimSpaces(field.value || '');
  }

  function createFormInstanceId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      try {
        return window.crypto.randomUUID();
      } catch (error) {
        // Fallback below keeps the form usable on browsers with partial support.
      }
    }

    return [
      'ammis',
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 12)
    ].join('-');
  }

  function createAntispamState() {
    const startedAtMs = Date.now();
    const safeStartedAtMs = Number.isFinite(startedAtMs) ? startedAtMs : 0;

    return {
      startedAtMs: safeStartedAtMs,
      startedAtIso: new Date(safeStartedAtMs).toISOString(),
      instanceId: createFormInstanceId()
    };
  }

  function getAntispamState(form) {
    if (!form.revendedorAntispamState) {
      form.revendedorAntispamState = createAntispamState();
    }

    return form.revendedorAntispamState;
  }

  function getAntispamPayload(form) {
    const state = getAntispamState(form);
    const submittedAtMs = Date.now();
    const elapsedMs = submittedAtMs - state.startedAtMs;

    return {
      websiteConfirm: getActiveFieldValue(form, 'website_confirm'),
      formStartedAt: state.startedAtIso,
      formSubmittedAt: new Date(Number.isFinite(submittedAtMs) ? submittedAtMs : 0).toISOString(),
      formElapsedMs: Number.isFinite(elapsedMs) && elapsedMs >= 0 ? Math.round(elapsedMs) : 0,
      formInstanceId: state.instanceId,
      antispamVersion: ANTISPAM_VERSION
    };
  }

  function buildPayload(form) {
    const payload = {};
    payloadFields.forEach((name) => {
      payload[name] = getActiveFieldValue(form, name);
    });

    const antispamPayload = getAntispamPayload(form);

    payload.no_instagram = Boolean(form.querySelector('[name="no_instagram"]')?.checked);
    payload.is_landline = Boolean(form.querySelector('[name="is_landline"]')?.checked);
    payload.privacy_consent = Boolean(form.querySelector('[name="privacy_consent"]')?.checked);
    payload.page_origin = getPageOrigin();
    payload.user_agent = navigator.userAgent || '';
    payload.utm_source = getUtmValue('utm_source');
    payload.utm_medium = getUtmValue('utm_medium');
    payload.utm_campaign = getUtmValue('utm_campaign');
    payload.utm_content = getUtmValue('utm_content');
    payload.utm_term = getUtmValue('utm_term');
    payload.website_confirm = antispamPayload.websiteConfirm;
    payload.form_started_at = antispamPayload.formStartedAt;
    payload.form_submitted_at = antispamPayload.formSubmittedAt;
    payload.form_elapsed_ms = antispamPayload.formElapsedMs;
    payload.form_instance_id = antispamPayload.formInstanceId;
    payload.antispam_version = antispamPayload.antispamVersion;

    return payload;
  }

  function getErrorElement(form, name) {
    return form.querySelector('[data-error-for="' + name + '"]');
  }

  function setFieldError(form, name, message) {
    const error = getErrorElement(form, name);
    const field = getField(form, name);
    if (error) error.textContent = message || '';

    if (name === 'store_type') {
      form.querySelectorAll('[name="store_type"]').forEach((radio) => {
        radio.setAttribute('aria-invalid', message ? 'true' : 'false');
      });
      return;
    }

    if (field) {
      if (message) {
        field.setAttribute('aria-invalid', 'true');
      } else {
        field.removeAttribute('aria-invalid');
      }
    }
  }

  function clearFieldError(form, name) {
    setFieldError(form, name, '');
  }

  function addError(errors, form, name, message) {
    setFieldError(form, name, message);
    errors.push({
      name: name,
      label: labels[name] || name,
      message: message,
      field: getField(form, name)
    });
  }

  function validateRequiredText(errors, form, name, minLength) {
    const field = getField(form, name);
    if (!field) return;
    field.value = trimSpaces(field.value);
    if (!field.value || field.value.length < minLength) {
      addError(errors, form, name, messages.required);
    } else {
      clearFieldError(form, name);
    }
  }

  function validateForm(form) {
    const errors = [];
    const brazil = isBrazil(form);
    const noInstagram = form.querySelector('[data-no-instagram]')?.checked;
    const landline = form.querySelector('[data-landline]')?.checked;

    validateRequiredText(errors, form, 'company_legal_name', 2);

    const cnpj = getField(form, 'cnpj');
    if (!cnpj || !validateCnpj(cnpj.value)) addError(errors, form, 'cnpj', messages.cnpj);
    else clearFieldError(form, 'cnpj');

    const instagram = getField(form, 'instagram');
    if (!noInstagram && instagram) {
      instagram.value = normalizeInstagram(instagram.value);
      if (!isValidInstagram(instagram.value)) addError(errors, form, 'instagram', messages.instagram);
      else clearFieldError(form, 'instagram');
    } else {
      clearFieldError(form, 'instagram');
    }

    const website = getField(form, 'website');
    if (website) {
      website.value = trimSpaces(website.value);
      if (!isValidWebsite(website.value)) addError(errors, form, 'website', messages.website);
      else clearFieldError(form, 'website');
    }

    validateRequiredText(errors, form, 'responsible_name', 2);

    const email = getField(form, 'email');
    if (email) {
      email.value = trimSpaces(email.value).toLowerCase();
      if (!email.value || !isValidEmail(email.value)) addError(errors, form, 'email', messages.email);
      else clearFieldError(form, 'email');
    }

    const country = getField(form, 'phone_country');
    if (!country || !country.value) addError(errors, form, 'phone_country', messages.required);
    else clearFieldError(form, 'phone_country');

    const phone = getField(form, 'phone');
    if (phone) {
      const validPhone = brazil ? (landline ? isBrazilLandline(phone.value) : isBrazilMobile(phone.value)) : isInternationalPhone(phone.value);
      if (!validPhone) addError(errors, form, 'phone', messages.phone);
      else clearFieldError(form, 'phone');
    }

    const whatsapp = getField(form, 'whatsapp_phone');
    if (landline && whatsapp) {
      const validWhatsapp = brazil ? isBrazilMobile(whatsapp.value) : isInternationalPhone(whatsapp.value);
      if (!validWhatsapp) addError(errors, form, 'whatsapp_phone', messages.whatsapp);
      else clearFieldError(form, 'whatsapp_phone');
    } else {
      clearFieldError(form, 'whatsapp_phone');
    }

    const postalCode = getField(form, 'postal_code');
    if (postalCode) {
      const validPostal = brazil ? onlyDigits(postalCode.value).length === 8 : trimSpaces(postalCode.value).length >= 3;
      if (!validPostal) addError(errors, form, 'postal_code', messages.postalCode);
      else clearFieldError(form, 'postal_code');
    }

    validateRequiredText(errors, form, 'address_line', 2);

    const addressNumber = getField(form, 'address_number');
    if (addressNumber) {
      addressNumber.value = trimSpaces(addressNumber.value);
      if (!/^(s\/n|[a-zA-Z0-9\-./ ]{1,20})$/i.test(addressNumber.value)) {
        addError(errors, form, 'address_number', messages.addressNumber);
      } else {
        clearFieldError(form, 'address_number');
      }
    }

    validateRequiredText(errors, form, 'neighborhood', 2);
    validateRequiredText(errors, form, 'state', 1);
    validateRequiredText(errors, form, 'city', 2);

    if (!form.querySelector('[name="store_type"]:checked')) addError(errors, form, 'store_type', messages.storeType);
    else clearFieldError(form, 'store_type');

    const consent = getField(form, 'privacy_consent');
    if (!consent || !consent.checked) addError(errors, form, 'privacy_consent', messages.consent);
    else clearFieldError(form, 'privacy_consent');

    return errors;
  }

  function renderSummary(form, errors) {
    const summary = form.querySelector('[data-error-summary]');
    const list = form.querySelector('[data-error-list]');
    const success = form.querySelector('[data-success-message]');
    if (!summary || !list) return;

    list.textContent = '';
    if (success) success.hidden = true;

    if (!errors.length) {
      summary.hidden = true;
      return;
    }

    errors.forEach((error) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = error.field && error.field.id ? '#' + error.field.id : '#';
      link.textContent = error.label + ': ' + error.message;
      item.appendChild(link);
      list.appendChild(item);
    });

    summary.hidden = false;
  }

  function clearSubmitError(form) {
    const submitError = form.querySelector('[data-submit-error]');
    if (!submitError) return;
    submitError.textContent = '';
    submitError.hidden = true;
  }

  function showSubmitError(form, message) {
    const submitError = form.querySelector('[data-submit-error]');
    if (!submitError) return;
    submitError.textContent = message;
    submitError.hidden = false;
    submitError.focus({ preventScroll: true });
  }

  function setSubmittingState(form, isSubmitting) {
    const button = form.querySelector('[data-submit-button]');
    const buttonText = button ? button.querySelector('span') : null;
    const normalLabel = getSetting(form, 'buttonLabel', 'Enviar cadastro');
    const submittingLabel = getSetting(form, 'submittingLabel', 'Enviando cadastro...');

    form.revendedorSubmitting = isSubmitting;
    form.setAttribute('aria-busy', isSubmitting ? 'true' : 'false');

    if (button) {
      button.disabled = isSubmitting;
      button.setAttribute('aria-disabled', isSubmitting ? 'true' : 'false');
      button.classList.toggle('is-loading', isSubmitting);
    }

    if (buttonText) {
      buttonText.textContent = isSubmitting ? submittingLabel : normalLabel;
    }
  }

  function focusFirstError(form, errors) {
    if (!errors.length) return;
    renderSummary(form, errors);
    const summary = form.querySelector('[data-error-summary]');
    if (summary) summary.focus({ preventScroll: true });
    const target = errors[0].field;
    if (target && typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function submitForm(form) {
    const endpointUrl = getSetting(form, 'endpointUrl', '');
    const confirmationUrl = getSetting(form, 'confirmationUrl', '');
    const failureMessage = getSetting(form, 'submitFailureMessage', 'Nao foi possivel enviar o cadastro. Confira sua conexao e tente novamente.');
    const communicationErrorMessage = getSetting(form, 'communicationErrorMessage', failureMessage);
    const invalidResponseMessage = getSetting(form, 'invalidResponseMessage', 'O cadastro nao pode ser confirmado. Tente novamente em alguns instantes.');
    const timeoutMessage = getSetting(form, 'timeoutMessage', 'O envio demorou mais que o esperado. Tente novamente.');

    if (form.revendedorSubmitting) return;

    if (!endpointUrl || !confirmationUrl) {
      showSubmitError(form, communicationErrorMessage);
      return;
    }

    const payload = buildPayload(form);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SUBMIT_TIMEOUT);
    const requestId = Symbol('submit');

    abortController(form.revendedorSubmitController);
    form.revendedorSubmitController = controller;
    form.revendedorSubmitRequestId = requestId;

    clearSubmitError(form);
    setSubmittingState(form, true);

    fetch(endpointUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      redirect: 'follow',
      signal: controller.signal
    })
      .then((response) => {
        return response.text().then((text) => parseSubmissionResponse(response, text));
      })
      .then((result) => {
        if (form.revendedorSubmitRequestId !== requestId || !form.isConnected) return;
        if (result.ok) {
          window.location.assign(confirmationUrl);
          return;
        }

        const message = result.type === 'invalid'
          ? invalidResponseMessage
          : getSafeServerMessage(result.message, failureMessage);
        setSubmittingState(form, false);
        showSubmitError(form, message);
      })
      .catch((error) => {
        if (form.revendedorSubmitRequestId !== requestId || !form.isConnected) return;
        setSubmittingState(form, false);
        showSubmitError(form, error.name === 'AbortError' ? timeoutMessage : communicationErrorMessage);
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
  }

  function updateInstagramState(form) {
    const checkbox = form.querySelector('[data-no-instagram]');
    const instagram = form.querySelector('[data-instagram]');
    if (!checkbox || !instagram) return;
    if (checkbox.checked) {
      instagram.value = '';
      instagram.disabled = true;
      instagram.removeAttribute('required');
      clearFieldError(form, 'instagram');
    } else {
      instagram.disabled = false;
      instagram.setAttribute('required', 'required');
    }
  }

  function updateLandlineState(form) {
    const checkbox = form.querySelector('[data-landline]');
    const group = form.querySelector('[data-whatsapp-group]');
    const whatsapp = form.querySelector('[data-whatsapp]');
    const phone = form.querySelector('[data-phone]');
    if (!checkbox || !group || !whatsapp) return;
    if (checkbox.checked) {
      group.hidden = false;
      whatsapp.disabled = false;
      whatsapp.setAttribute('required', 'required');
    } else {
      group.hidden = true;
      whatsapp.value = '';
      whatsapp.disabled = true;
      whatsapp.removeAttribute('required');
      clearFieldError(form, 'whatsapp_phone');
    }
    if (phone && isBrazil(form)) phone.value = maskBrazilPhone(phone.value, checkbox.checked);
  }

  function createOption(value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
  }

  function setCitySelectOptions(select, cities, placeholder) {
    if (!select) return;
    select.textContent = '';
    select.appendChild(createOption('', placeholder || 'Selecione'));
    cities.forEach((city) => {
      select.appendChild(createOption(city.name, city.name));
    });
  }

  function setCityMode(form, mode, message, status) {
    const citySelectWrap = form.querySelector('[data-city-select-wrap]');
    const citySelect = form.querySelector('[data-city-select]');
    const cityText = form.querySelector('[data-city-text]');
    const label = form.querySelector('[data-city-label]');

    if (!citySelectWrap || !citySelect || !cityText) return;

    if (mode === 'select') {
      citySelectWrap.hidden = false;
      citySelect.disabled = false;
      citySelect.required = true;
      cityText.hidden = true;
      cityText.disabled = true;
      cityText.required = false;
      if (label) label.setAttribute('for', citySelect.id);
    } else if (mode === 'manual') {
      citySelectWrap.hidden = true;
      citySelect.disabled = true;
      citySelect.required = false;
      cityText.hidden = false;
      cityText.disabled = false;
      cityText.required = true;
      if (label) label.setAttribute('for', cityText.id);
    } else {
      citySelectWrap.hidden = false;
      citySelect.disabled = true;
      citySelect.required = true;
      cityText.hidden = true;
      cityText.disabled = true;
      cityText.required = false;
      if (label) label.setAttribute('for', citySelect.id);
    }

    setStatus(getCityStatus(form), message, status);
  }

  function resetCitySelect(form, placeholder) {
    const citySelect = form.querySelector('[data-city-select]');
    if (!citySelect) return;
    setCitySelectOptions(citySelect, [], placeholder || 'Selecione um estado');
    citySelect.value = '';
    setCityMode(form, 'disabled', '', '');
  }

  function parseCities(payload) {
    if (!Array.isArray(payload)) return [];
    const seen = new Set();
    return payload
      .map((item) => {
        if (!item || typeof item.nome !== 'string') return null;
        return { name: trimSpaces(item.nome) };
      })
      .filter((city) => {
        if (!city || !city.name) return false;
        const key = normalizeText(city.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  function loadCities(form, uf, options) {
    const state = trimSpaces(uf).toUpperCase();
    const citySelect = form.querySelector('[data-city-select]');
    const expectedRequest = Symbol('cities');
    const shouldClear = !options || options.clear !== false;
    const targetCity = options && options.targetCity ? trimSpaces(options.targetCity) : '';

    if (!state || state.length !== 2) {
      resetCitySelect(form);
      return Promise.resolve([]);
    }

    form.revendedorCityRequestId = expectedRequest;
    abortController(form.revendedorCitiesController);

    if (shouldClear && citySelect) citySelect.value = '';

    if (cityCache.has(state)) {
      const cachedCities = cityCache.get(state);
      setCitySelectOptions(citySelect, cachedCities, 'Selecione a cidade');
      setCityMode(form, 'select', messages.cityLoaded, 'success');
      selectCity(form, targetCity);
      return Promise.resolve(cachedCities);
    }

    const controller = new AbortController();
    form.revendedorCitiesController = controller;
    setCityMode(form, 'disabled', messages.cityLoading, 'loading');
    if (citySelect) {
      setCitySelectOptions(citySelect, [], 'Carregando cidades...');
    }

    return fetchJson(IBGE_CITIES_URL.replace('{uf}', encodeURIComponent(state)), controller)
      .then((payload) => {
        if (form.revendedorCityRequestId !== expectedRequest || !isBrazil(form)) return [];
        const cities = parseCities(payload);
        if (!cities.length) throw new Error('Invalid cities');
        cityCache.set(state, cities);
        setCitySelectOptions(citySelect, cities, 'Selecione a cidade');
        setCityMode(form, 'select', messages.cityLoaded, 'success');
        selectCity(form, targetCity);
        return cities;
      })
      .catch((error) => {
        if (error.name === 'AbortError') return [];
        if (form.revendedorCityRequestId !== expectedRequest || !isBrazil(form)) return [];
        setCityMode(form, 'manual', messages.cityError, 'warning');
        selectCity(form, targetCity);
        return [];
      });
  }

  function selectCity(form, cityName) {
    const city = trimSpaces(cityName);
    const citySelect = form.querySelector('[data-city-select]');
    const cityText = form.querySelector('[data-city-text]');
    if (!city) return;

    if (citySelect && !citySelect.disabled) {
      const normalizedCity = normalizeText(city);
      const match = Array.from(citySelect.options).find((option) => normalizeText(option.textContent) === normalizedCity);
      if (match) {
        citySelect.value = match.value;
        clearFieldError(form, 'city');
        return;
      }
      citySelect.appendChild(createOption(city, city));
      citySelect.value = city;
      clearFieldError(form, 'city');
      return;
    }

    if (cityText && !cityText.disabled) {
      cityText.value = city;
      clearFieldError(form, 'city');
    }
  }

  function parseCep(payload) {
    if (!payload || typeof payload !== 'object' || payload.erro) return null;
    const uf = typeof payload.uf === 'string' ? trimSpaces(payload.uf).toUpperCase() : '';
    const city = typeof payload.localidade === 'string' ? trimSpaces(payload.localidade) : '';
    if (!uf || uf.length !== 2 || !city) return null;
    return {
      postalCode: typeof payload.cep === 'string' ? payload.cep : '',
      addressLine: typeof payload.logradouro === 'string' ? trimSpaces(payload.logradouro) : '',
      neighborhood: typeof payload.bairro === 'string' ? trimSpaces(payload.bairro) : '',
      state: uf,
      city: city
    };
  }

  function applyCepResult(form, result) {
    const addressLine = getField(form, 'address_line');
    const neighborhood = getField(form, 'neighborhood');
    const state = form.querySelector('[data-state-select]');
    const number = getField(form, 'address_number');

    if (addressLine && result.addressLine) {
      addressLine.value = result.addressLine;
      clearFieldError(form, 'address_line');
    }

    if (neighborhood && result.neighborhood) {
      neighborhood.value = result.neighborhood;
      clearFieldError(form, 'neighborhood');
    }

    if (state && result.state) {
      state.value = result.state;
      clearFieldError(form, 'state');
      loadCities(form, result.state, { targetCity: result.city, clear: true });
    }

    if (number && document.activeElement !== number) {
      number.focus({ preventScroll: true });
    }
  }

  function lookupCep(form, force) {
    const postal = form.querySelector('[data-postal-code]');
    if (!postal || !isBrazil(form)) return;

    const digits = onlyDigits(postal.value);
    if (digits.length !== 8) {
      if (force) setStatus(getPostalStatus(form), '', '');
      return;
    }

    if (!force && form.revendedorLastCepRequested === digits) return;
    form.revendedorLastCepRequested = digits;

    abortController(form.revendedorCepController);

    if (cepCache.has(digits)) {
      const cachedResult = cepCache.get(digits);
      if (cachedResult) {
        setStatus(getPostalStatus(form), messages.postalCodeFound, 'success');
        applyCepResult(form, cachedResult);
      } else {
        setStatus(getPostalStatus(form), messages.postalCodeNotFound, 'warning');
      }
      return;
    }

    const controller = new AbortController();
    const requestId = Symbol('cep');
    form.revendedorCepController = controller;
    form.revendedorCepRequestId = requestId;
    postal.setAttribute('aria-busy', 'true');
    setStatus(getPostalStatus(form), messages.postalCodeLoading, 'loading');

    fetchJson(VIA_CEP_URL.replace('{cep}', digits), controller)
      .then((payload) => {
        if (form.revendedorCepRequestId !== requestId || !isBrazil(form) || onlyDigits(postal.value) !== digits) return;
        const result = parseCep(payload);
        cepCache.set(digits, result);
        if (!result) {
          setStatus(getPostalStatus(form), messages.postalCodeNotFound, 'warning');
          return;
        }
        setStatus(getPostalStatus(form), messages.postalCodeFound, 'success');
        applyCepResult(form, result);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        if (form.revendedorCepRequestId !== requestId || !isBrazil(form)) return;
        setStatus(getPostalStatus(form), messages.postalCodeError, 'warning');
      })
      .finally(() => {
        if (form.revendedorCepRequestId === requestId) {
          postal.removeAttribute('aria-busy');
        }
      });
  }

  function updateCountryState(form) {
    const brazil = isBrazil(form);
    const stateSelect = form.querySelector('[data-state-select]');
    const stateSelectWrap = form.querySelector('[data-state-select-wrap]');
    const stateText = form.querySelector('[data-state-text]');
    const citySelect = form.querySelector('[data-city-select]');
    const cityText = form.querySelector('[data-city-text]');
    const postal = form.querySelector('[data-postal-code]');
    const phone = form.querySelector('[data-phone]');
    const whatsapp = form.querySelector('[data-whatsapp]');

    if (!brazil) {
      abortController(form.revendedorCepController);
      abortController(form.revendedorCitiesController);
      form.revendedorLastCepRequested = '';
      setStatus(getPostalStatus(form), '', '');
      setStatus(getCityStatus(form), '', '');
    }

    if (stateSelect && stateSelectWrap && stateText) {
      stateSelect.disabled = !brazil;
      stateSelect.required = brazil;
      stateSelectWrap.hidden = !brazil;
      stateText.disabled = brazil;
      stateText.required = !brazil;
      stateText.hidden = brazil;
      const label = form.querySelector('[data-state-label]');
      if (label) label.setAttribute('for', brazil ? stateSelect.id : stateText.id);
      clearFieldError(form, 'state');
    }

    if (brazil) {
      if (cityText) cityText.value = '';
      if (stateSelect && stateSelect.value) {
        loadCities(form, stateSelect.value, { clear: false });
      } else {
        resetCitySelect(form);
      }
    } else {
      if (citySelect && citySelect.value && cityText && !cityText.value) cityText.value = citySelect.value;
      setCityMode(form, 'manual', '', '');
      clearFieldError(form, 'city');
    }

    if (postal) {
      postal.inputMode = brazil ? 'numeric' : 'text';
      postal.placeholder = brazil ? '00000-000' : 'Codigo postal';
      if (brazil) postal.value = maskPostalCode(postal.value);
    }

    if (phone && brazil) phone.value = maskBrazilPhone(phone.value, form.querySelector('[data-landline]')?.checked);
    if (whatsapp && brazil) whatsapp.value = maskBrazilPhone(whatsapp.value, false);
  }

  function updateCounters(form) {
    form.querySelectorAll('[data-counter-input]').forEach((field) => {
      const counter = form.querySelector('[data-counter]');
      if (counter) counter.textContent = field.value.length + '/' + field.maxLength;
    });
  }

  function bindFieldEvents(form, signal) {
    form.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches('[data-mask="cnpj"]')) target.value = maskCnpj(target.value);
      if (target.matches('[data-postal-code]') && isBrazil(form)) {
        target.value = maskPostalCode(target.value);
        form.revendedorLastCepRequested = form.revendedorLastCepRequested === onlyDigits(target.value) ? form.revendedorLastCepRequested : '';
        if (onlyDigits(target.value).length === 8) {
          lookupCep(form, false);
        } else {
          abortController(form.revendedorCepController);
          setStatus(getPostalStatus(form), '', '');
        }
      }
      if (target.matches('[data-phone]') && isBrazil(form)) target.value = maskBrazilPhone(target.value, form.querySelector('[data-landline]')?.checked);
      if (target.matches('[data-whatsapp]') && isBrazil(form)) target.value = maskBrazilPhone(target.value, false);
      if (target.matches('[data-counter-input]')) updateCounters(form);
      if (target.name) clearFieldError(form, target.name);
    }, { signal: signal });

    form.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches('[data-no-instagram]')) updateInstagramState(form);
      if (target.matches('[data-landline]')) updateLandlineState(form);
      if (target.matches('[data-country-select]')) {
        updateCountryState(form);
        updateLandlineState(form);
      }
      if (target.matches('[data-state-select]') && isBrazil(form)) {
        loadCities(form, target.value, { clear: true });
      }
      if (target.name) clearFieldError(form, target.name);
    }, { signal: signal });

    form.addEventListener('focusout', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
      if (target.name === 'email') target.value = trimSpaces(target.value).toLowerCase();
      if (target.name === 'instagram' && target.value) target.value = normalizeInstagram(target.value);
      if (target.name === 'cnpj') {
        target.value = maskCnpj(target.value);
        if (target.value && !validateCnpj(target.value)) setFieldError(form, 'cnpj', messages.cnpj);
      }
      if (target.matches('[data-postal-code]') && isBrazil(form)) {
        target.value = maskPostalCode(target.value);
        lookupCep(form, true);
      }
      if (target.type === 'text' || target.type === 'email' || target.tagName === 'TEXTAREA') {
        target.value = trimSpaces(target.value);
      }
    }, { signal: signal });
  }

  function initSection(section) {
    if (section.revendedorFormController) section.revendedorFormController.abort();
    const controller = new AbortController();
    section.revendedorFormController = controller;

    const form = section.querySelector(FORM_SELECTOR);
    if (!form) return;

    form.revendedorAntispamState = createAntispamState();
    updateInstagramState(form);
    updateLandlineState(form);
    updateCountryState(form);
    updateCounters(form);
    bindFieldEvents(form, controller.signal);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (form.revendedorSubmitting) return;
      const errors = validateForm(form);
      renderSummary(form, errors);
      if (errors.length) {
        clearSubmitError(form);
        focusFirstError(form, errors);
      } else {
        submitForm(form);
      }
    }, { signal: controller.signal });
  }

  function initAll(root) {
    (root || document).querySelectorAll(SECTION_SELECTOR).forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    event.target.querySelectorAll(SECTION_SELECTOR).forEach((section) => {
      if (section.revendedorFormController) section.revendedorFormController.abort();
      const form = section.querySelector(FORM_SELECTOR);
      if (form) {
        abortController(form.revendedorCepController);
        abortController(form.revendedorCitiesController);
        abortController(form.revendedorSubmitController);
      }
    });
  });
})();
