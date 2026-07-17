(function () {
  const SECTION_SELECTOR = '[data-revendedor-form-section]';
  const FORM_SELECTOR = '[data-revendedor-form]';

  const messages = {
    required: 'Preencha este campo.',
    cnpj: 'Informe um CNPJ valido.',
    email: 'Informe um e-mail valido.',
    instagram: 'Informe o Instagram da loja ou marque a opcao sem Instagram.',
    website: 'Informe um site valido.',
    phone: 'Informe um telefone valido.',
    whatsapp: 'Informe um celular com WhatsApp valido.',
    postalCode: 'Informe um CEP valido.',
    state: 'Informe o estado.',
    storeType: 'Selecione o tipo da loja.',
    consent: 'Aceite a Politica de Privacidade para continuar.',
    addressNumber: 'Informe um numero valido.'
  };

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

  function showSuccess(form) {
    const summary = form.querySelector('[data-error-summary]');
    const success = form.querySelector('[data-success-message]');
    if (summary) summary.hidden = true;
    if (success) {
      success.hidden = false;
      success.focus({ preventScroll: true });
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  function updateCountryState(form) {
    const brazil = isBrazil(form);
    const stateSelect = form.querySelector('[data-state-select]');
    const stateSelectWrap = form.querySelector('[data-state-select-wrap]');
    const stateText = form.querySelector('[data-state-text]');
    const postal = form.querySelector('[data-postal-code]');
    const phone = form.querySelector('[data-phone]');
    const whatsapp = form.querySelector('[data-whatsapp]');

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
      if (target.matches('[data-postal-code]') && isBrazil(form)) target.value = maskPostalCode(target.value);
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

    updateInstagramState(form);
    updateLandlineState(form);
    updateCountryState(form);
    updateCounters(form);
    bindFieldEvents(form, controller.signal);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const errors = validateForm(form);
      renderSummary(form, errors);
      if (errors.length) {
        focusFirstError(form, errors);
      } else {
        showSuccess(form);
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
    });
  });
})();
