if (!customElements.get('product-form')) {
  customElements.define('product-form', class ProductForm extends HTMLElement {
    constructor() {
      super();

      if (this.querySelector('form')) {
        this.form = this.querySelector('form');
        this.form.querySelector('[name=id]').disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
      }
      else {
        this.querySelector('[name=id]').disabled = false;
        this.querySelector('button[type=submit]').addEventListener('click', this.onSubmitHandler.bind(this));
      }
      this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
      this.submitButton = this.querySelector('[type="submit"]');
      this.buyNowButton = this.querySelector('[data-buy-now]');

      if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');
      if (this.buyNowButton) {
        this.buyNowButton.addEventListener('click', this.onBuyNowHandler.bind(this));
      }

      this.hideErrors = this.dataset.hideErrors === 'true';
    }

    onSubmitHandler(evt) {
      evt.preventDefault();
      
      // 1. GARANTIA DE LEITURA DO DRAWER (Obrigatório para o Atacado)
      this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');

      if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

      this.handleErrorMessage();

      this.submitButton.setAttribute('aria-disabled', true);
      this.submitButton.classList.add('loading');
      this.querySelector('.loading-overlay__spinner').classList.remove('hidden');

      const config = fetchConfig('javascript');
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
      delete config.headers['Content-Type'];

      const formData = new FormData(this.form);
      if (!this.form) {
        formData.append('id', this.querySelector('[name=id]').value);
      }
      
      if (this.cart) {
        formData.append('sections', this.cart.getSectionsToRender().map((section) => section.id));
        
// 2. PATCH B2B: RENDERIZAÇÃO ISOLADA
const isB2BEnvironment = window.location.pathname.includes('atacado') || document.body.classList.contains('template-product-b2b-readonly');
        const targetSectionUrl = isB2BEnvironment ? '/pages/atacado' : window.location.pathname;
        formData.append('sections_url', targetSectionUrl);
        
        this.cart.setActiveElement(document.activeElement);
      }
      config.body = formData;

      fetch(`${routes.cart_add_url}`, config)
        .then((response) => response.json())
        .then((response) => {
          if (response.status) {
            publish(PUB_SUB_EVENTS.cartError, {source: 'product-form', productVariantId: formData.get('id'), errors: response.description, message: response.message});
            this.handleErrorMessage(response.description);
            const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
            if (!soldOutMessage) return;
            this.submitButton.setAttribute('aria-disabled', true);
            this.submitButton.querySelector('span').classList.add('hidden');
            soldOutMessage.classList.remove('hidden');
            this.error = true;
            return;
          } else if (!this.cart) {
            window.location = window.routes.cart_url;
            return;
          }

          if (!this.error) publish(PUB_SUB_EVENTS.cartUpdate, {source: 'product-form', productVariantId: formData.get('id')});
          this.error = false;
          const quickAddModal = this.closest('quick-add-modal');
          if (quickAddModal) {
            document.body.addEventListener('modalClosed', () => {
              setTimeout(() => { this.cart.renderContents(response) });
            }, { once: true });
            quickAddModal.hide(true);
          } else {
            this.cart.renderContents(response);
          }
        })
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          this.submitButton.classList.remove('loading');
          if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
          if (!this.error) this.submitButton.removeAttribute('aria-disabled');
          this.querySelector('.loading-overlay__spinner').classList.add('hidden');
        });
    }

    onBuyNowHandler(evt) {
      evt.preventDefault();

      if (!this.form || !this.buyNowButton) return;
      if (
        this.buyNowButton.disabled ||
        this.buyNowButton.getAttribute('aria-disabled') === 'true'
      ) {
        return;
      }

      this.handleErrorMessage();
      this.error = false;

      this.buyNowButton.setAttribute('aria-disabled', 'true');
      this.buyNowButton.classList.add('loading');

      const spinner = this.buyNowButton.querySelector('.loading-overlay__spinner');
      if (spinner) spinner.classList.remove('hidden');

      const config = fetchConfig('javascript');
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
      delete config.headers['Content-Type'];
      config.body = new FormData(this.form);

      fetch(`${routes.cart_add_url}`, config)
        .then((response) => response.json())
        .then((response) => {
          if (response.status) {
            publish(PUB_SUB_EVENTS.cartError, {
              source: 'product-form-buy-now',
              productVariantId: config.body.get('id'),
              errors: response.description,
              message: response.message
            });

            this.handleErrorMessage(response.description || response.message);
            this.error = true;
            return;
          }

         return fetch('/cart.js', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
})
  .then((cartResponse) => {
    if (!cartResponse.ok) {
      throw new Error('Não foi possível carregar o carrinho.');
    }

    return cartResponse.json();
  })
  .then((cart) => {
    const items = cart.items.map((item) => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
    }));

    if (items.length === 0) {
      throw new Error('O carrinho está vazio.');
    }

    const data = {
      items: items,
    };

    const hash = btoa(JSON.stringify(data));

    window.location.href = `https://checkout.ammismoda.com.br/c/${hash}`;
  });
        })
        .catch((error) => {
          console.error(error);
          this.handleErrorMessage('Não foi possível iniciar a compra. Tente novamente.');
          this.error = true;
        })
        .finally(() => {
          if (this.error) {
            this.buyNowButton.classList.remove('loading');
            this.buyNowButton.removeAttribute('aria-disabled');
            if (spinner) spinner.classList.add('hidden');
          }
        });
    }

    handleErrorMessage(errorMessage = false) {
      if (this.hideErrors) return;

      this.errorMessageWrapper = this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
      if (!this.errorMessageWrapper) return;
      this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

      this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

      if (errorMessage) {
        this.errorMessage.textContent = errorMessage;
      }
    }
  });
}