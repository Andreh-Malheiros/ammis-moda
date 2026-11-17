(() => {
  const root = window.Shopify?.routes?.root || '/';
  let busy = false;

  async function applyDiscount(button) {
    if (busy) return;
    const container = button.closest('[data-cart-discount]');
    const input = container.querySelector('input');
    const code = button.hasAttribute('data-remove-discount') ? '' : input.value.trim();
    if (!code && !button.hasAttribute('data-remove-discount')) return;
    const message = container.querySelector('[role="status"]');
    busy = true;
    button.disabled = true;
    message.textContent = 'Validando cupom…';
    try {
      const response = await fetch(root + 'cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discount: code, sections: ['cart-drawer', 'cart-icon-bubble'], sections_url: location.pathname }),
      });
      if (!response.ok) throw new Error('Não foi possível validar o cupom. Tente novamente.');
      const cart = await response.json();
      const applications = [
        ...(cart.cart_level_discount_applications || []),
        ...(cart.items || []).flatMap(item => (item.line_level_discount_allocations || []).map(allocation => allocation.discount_application)),
      ];
      const applied = !code || applications.some(discount => discount.type === 'discount_code' && discount.title.toUpperCase() === code.toUpperCase())
        || (cart.discount_codes || []).some(discount => discount.applicable && discount.code.toUpperCase() === code.toUpperCase());
      const drawer = document.querySelector('cart-drawer');
      if (cart.sections?.['cart-drawer'] && drawer) {
        drawer.renderContents(cart);
      }
      const updated = document.querySelector('[data-cart-discount]');
      if (updated) {
        updated.querySelector('[role="status"]').textContent = applied
          ? (code ? 'Cupom aplicado aos produtos elegíveis.' : 'Cupom removido.')
          : 'Cupom inválido ou não aplicável aos produtos do carrinho.';
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      busy = false;
      button.disabled = false;
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-apply-discount], [data-remove-discount]');
    if (!button) return;
    event.preventDefault();
    applyDiscount(button);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || !event.target.matches('[data-cart-discount] input')) return;
    event.preventDefault();
    applyDiscount(event.target.closest('[data-cart-discount]').querySelector('[data-apply-discount]'));
  });
})();
