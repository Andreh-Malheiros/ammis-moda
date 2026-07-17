/**
 * ammis-gallery.js
 * ─────────────────────────────────────────────────────────────
 * Gerencia os comportamentos da página "Ammis por Você":
 *
 *  1. Desktop: ao clicar num card de produto (.js-gallery-quickview),
 *     abre o modal quick view reutilizando QuickAddModal já definido
 *     em quick-add.js (carregado globalmente pelo theme.liquid).
 *
 *  2. Mobile: link invisível sobre a foto (.ammis-gallery-item__mobile-link)
 *     já faz a navegação direta pelo href — sem JS necessário.
 *
 * Arquitetura respeitada:
 *   - Não instancia novos custom elements — reutiliza QuickAddModal existente
 *   - Não duplica imports de CSS/JS do tema
 *   - Opera via event delegation no container da galeria
 * ─────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  const MODAL_ID        = 'GalleryQuickView';
  const TRIGGER_CLASS   = 'js-gallery-quickview';
  const LOADING_CLASS   = 'is-loading';
  const GALLERY_SEL     = '.ammis-por-voce';

  /* ── Aguarda DOM e custom elements do tema ── */
  function init() {
    const gallery = document.querySelector(GALLERY_SEL);
    if (!gallery) return;

    /* Event delegation: um único listener para todos os cards */
    gallery.addEventListener('click', function (e) {
      const card = e.target.closest('.' + TRIGGER_CLASS);
      if (!card) return;

      /* No mobile os cards têm pointer-events: none via CSS,
         mas como garantia extra verificamos a largura da janela */
      if (window.innerWidth < 750) return;

      e.preventDefault();
      openQuickView(card);
    });
  }

  /* ── Abre o Quick View ── */
  function openQuickView(card) {
    const productUrl = card.dataset.productUrl;
    if (!productUrl) return;

    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    /* QuickAddModal é definido em quick-add.js (já carregado globalmente).
       Ele expõe o método .show(opener) que recebe um elemento com
       data-product-url e faz o fetch + inject do HTML do produto. */
    if (typeof modal.show !== 'function') {
      /* Fallback: navega para a página do produto se o modal não estiver pronto */
      window.location.href = productUrl;
      return;
    }

    /* Adiciona atributos que QuickAddModal.show() espera encontrar no opener */
    card.setAttribute('data-product-url', productUrl);
    card.classList.add(LOADING_CLASS);

    /* Cria spinner temporário se não existir (QuickAddModal verifica isso) */
    if (!card.querySelector('.loading-overlay__spinner')) {
      const spinner = document.createElement('span');
      spinner.className = 'loading-overlay__spinner hidden';
      card.appendChild(spinner);
    }

    modal.show(card);

    /* Remove loading state após a animação do modal */
    modal.addEventListener(
      'transitionend',
      function onTransitionEnd() {
        card.classList.remove(LOADING_CLASS);
        modal.removeEventListener('transitionend', onTransitionEnd);
      },
      { once: true }
    );
  }

  /* ── Inicialização ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Re-inicializa se a section for recarregada no editor do Shopify */
  document.addEventListener('shopify:section:load', function (e) {
    if (e.target.querySelector(GALLERY_SEL)) {
      init();
    }
  });

})();
