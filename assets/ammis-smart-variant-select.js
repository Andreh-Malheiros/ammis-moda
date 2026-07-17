/**
 * AMMIS MODA — Smart Variant Select
 * ------------------------------------
 * Comportamento implementado:
 *
 *  1. SELEÇÃO LIVRE
 *     Todas as opções que possuem ao menos uma variante definida ficam
 *     selecionáveis, independente do estoque ou da combinação atual.
 *     Somente valores que NÃO existem em nenhuma variante ficam desabilitados
 *     (ex.: Tamanho 36 se não há nenhuma variante com esse tamanho).
 *
 *  2. BADGE CONTEXTUAL
 *     A tag de estoque atualiza dinamicamente com mensagens inteligentes:
 *       - "Em estoque"                             → combinação existe e tem estoque
 *       - "Esgotado"                               → combinação existe mas sem estoque
 *       - "Cor disponível apenas no tamanho X, Y"  → cor existe em outro(s) tamanho(s)
 *       - "Disponível neste tamanho em: X, Y"      → tamanho existe com outra(s) cor(es)
 *
 *  Arquitetura respeitada:
 *    - Sem modificação de arquivos existentes além dos instruídos
 *    - Sem novos custom elements
 *    - Opera via listener bubbling no document, após o onVariantChange nativo
 *    - Compatível com variant-radios e variant-selects do tema AMMIS
 */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------- */
  /* CONFIGURAÇÃO                                                            */
  /* ---------------------------------------------------------------------- */

  /** Seletores dos custom elements de variante do tema AMMIS */
  const VARIANT_CONTAINER = 'variant-radios, variant-selects';

  /** Seletor dos grupos de opção (fieldsets com os radios) */
  const OPTION_WRAPPER = '.product-form__controls';

  /** Data-attribute no elemento da badge de estoque */
  const BADGE_ATTR = 'data-stock-badge';

  /* ---------------------------------------------------------------------- */
  /* MENSAGENS                                                               */
  /* ---------------------------------------------------------------------- */

  const MSG = {
    inStock:        'Em estoque',
    outOfStock:     'Esgotado',
    colorInSizes:   (sizes)  => `Cor disponível apenas no tamanho ${sizes}`,
    sizeInColors:   (colors) => `Disponível neste tamanho em: ${colors}`,
  };

  /* ---------------------------------------------------------------------- */
  /* HELPERS                                                                 */
  /* ---------------------------------------------------------------------- */

  /** Lê o JSON de variantes embutido pelo Liquid no container */
  function getVariants(container) {
    try {
      return JSON.parse(
        container.querySelector('[type="application/json"]').textContent
      );
    } catch (_) {
      return [];
    }
  }

  /** Retorna os valores atualmente selecionados em cada fieldset */
  function getSelections(container) {
    return Array.from(
      container.querySelectorAll(`${OPTION_WRAPPER} input[type="radio"]:checked`)
    ).map((el) => el.value);
  }

  /** Encontra a variante que corresponde exatamente às seleções atuais */
  function findVariant(variants, selections) {
    return variants.find((v) =>
      selections.every((val, i) => v[`option${i + 1}`] === val)
    ) || null;
  }

  /** Retorna valores únicos de um array */
  function unique(arr) {
    return [...new Set(arr)];
  }

  /* ---------------------------------------------------------------------- */
  /* 1. CORREÇÃO DOS ESTADOS DISABLED                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * Executa APÓS o updateVariantStatuses nativo (que usa lógica de estoque).
   * Corrige: desabilita apenas valores que NÃO existem em nenhuma variante.
   */
  function fixDisabledStates(container) {
    const variants = getVariants(container);
    if (!variants.length) return;

    container.querySelectorAll(OPTION_WRAPPER).forEach((wrapper, idx) => {
      const pos = idx + 1; // option1, option2, option3...

      wrapper.querySelectorAll('input[type="radio"]').forEach((input) => {
        const val = input.getAttribute('value');
        const existsInAnyVariant = variants.some((v) => v[`option${pos}`] === val);

        if (existsInAnyVariant) {
          input.classList.remove('disabled');
        } else {
          input.classList.add('disabled');
        }
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* 2. ATUALIZAÇÃO DA BADGE DE ESTOQUE                                      */
  /* ---------------------------------------------------------------------- */

  function updateStockBadge(container) {
    const sectionId = container.dataset.section;
    const badge = document.querySelector(`[${BADGE_ATTR}="${sectionId}"]`);
    if (!badge) return;

    const variants = getVariants(container);
    if (!variants.length) return;

    const selections = getSelections(container);
    if (!selections.length) return;

    const variant  = findVariant(variants, selections);
    let text, inStock;

    /* ── Combinação existe e tem estoque ── */
    if (variant && variant.available) {
      text    = MSG.inStock;
      inStock = true;

    /* ── Combinação existe mas sem estoque OU não existe ── */
    } else {
      inStock = false;

      if (selections.length >= 2) {
        // Convenção do tema AMMIS: option1 = Tamanho, última opção = Cor
        const colorVal = selections[selections.length - 1];
        const sizeVal  = selections[0];

        // Tamanhos que têm ESTA cor disponível (com estoque)
        const sizesWithColor = unique(
          variants
            .filter((v) => v[`option${selections.length}`] === colorVal && v.available)
            .map((v) => v.option1)
        );

        if (sizesWithColor.length > 0) {
          // A cor existe, mas não neste tamanho
          text = MSG.colorInSizes(sizesWithColor.join(', '));
        } else {
          // A cor não tem estoque em nenhum tamanho — mostrar cores disponíveis neste tamanho
          const colorsInSize = unique(
            variants
              .filter((v) => v.option1 === sizeVal && v.available)
              .map((v) => v[`option${selections.length}`])
          );

          text = colorsInSize.length > 0
            ? MSG.sizeInColors(colorsInSize.join(', '))
            : MSG.outOfStock;
        }

      } else {
        // Produto com única opção
        text = MSG.outOfStock;
      }
    }

    badge.textContent = text;
    badge.className   = `stock-badge ${inStock ? 'stock-badge--in-stock' : 'stock-badge--out-of-stock'}`;
  }

  /* ---------------------------------------------------------------------- */
  /* INICIALIZAÇÃO                                                           */
  /* ---------------------------------------------------------------------- */

  function init() {
    /**
     * Listener em nível de documento, fase de bubbling.
     * Isso garante que o onVariantChange nativo (registrado no constructor
     * do custom element) já executou toda sua lógica síncrona antes de
     * corrigirmos os estados e atualizar a badge.
     *
     * O setTimeout(0) cede o fio de execução para que quaisquer micro-tasks
     * pendentes do handler original terminem antes das nossas correções.
     */
    document.addEventListener(
      'change',
      function (e) {
        const container = e.target.closest(VARIANT_CONTAINER);
        if (!container) return;

        setTimeout(function () {
          fixDisabledStates(container);
          updateStockBadge(container);
        }, 0);
      },
      false
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-inicializa ao recarregar seções no editor do Shopify
  document.addEventListener('shopify:section:load', function () {
    setTimeout(init, 300);
  });

})();
