/**
 * AMMIS MODA — Smart Variant Select
 * ------------------------------------
 * Controla exclusivamente o seletor de variantes em formato de botões.
 *
 * Estados possíveis:
 *  1. Disponível:
 *     A combinação existe e a variante está disponível.
 *
 *  2. Esgotado, mas clicável:
 *     A combinação existe, está indisponível, porém o mesmo valor da opção
 *     ainda possui alguma variante disponível em outra combinação.
 *     O cliente pode clicar para visualizar "Esgotado" e as alternativas.
 *
 *  3. Esgotado e bloqueado:
 *     O valor existe nas variantes do produto, mas não possui nenhuma variante
 *     disponível em qualquer combinação.
 *
 *  4. Combinação inexistente:
 *     A combinação entre a seleção atual e o valor analisado nunca foi criada
 *     na Shopify. Ela fica bloqueada, mas não recebe o risco de "esgotado".
 *
 * A disponibilidade é determinada por variant.available. Portanto, variantes
 * configuradas como indisponíveis na Shopify permanecem indisponíveis, mesmo
 * que exista alguma regra externa relacionada ao inventário.
 */

(function () {
  'use strict';

  const SELECTORS = {
    container: 'variant-radios.variant-radios',
    optionWrapper: '.product-form__controls',
    radio: 'input[type="radio"]',
    badge: '[data-stock-badge]',
    variantJson: 'script[type="application/json"]'
  };

  const CLASSES = {
    soldOut: 'ammis-variant--sold-out',
    blockedSoldOut: 'ammis-variant--blocked-sold-out',
    nonexistent: 'ammis-variant--nonexistent'
  };

  const MESSAGES = {
    inStock: 'Em estoque',
    outOfStock: 'Esgotado',
    colorInSizes: (sizes) => `Cor disponível apenas no tamanho ${sizes}`,
    sizeInColors: (colors) => `Disponível neste tamanho em: ${colors}`
  };

  const COLOR_NAMES = ['cor', 'color', 'colour'];
  const SIZE_NAMES = ['tamanho', 'size', 'tam'];

  let observer = null;
  let refreshScheduled = false;

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function getVariants(container) {
    const script = container.querySelector(SELECTORS.variantJson);
    if (!script) return [];

    try {
      const variants = JSON.parse(script.textContent);
      return Array.isArray(variants) ? variants : [];
    } catch (error) {
      console.error('[AMMIS] Não foi possível ler as variantes do produto.', error);
      return [];
    }
  }

  function getOptionWrappers(container) {
    return Array.from(container.querySelectorAll(SELECTORS.optionWrapper))
      .filter((wrapper) => wrapper.querySelector(SELECTORS.radio));
  }

  function getOptionMetadata(container) {
    return getOptionWrappers(container).map((wrapper, index) => {
      const firstInput = wrapper.querySelector(SELECTORS.radio);
      const legend = wrapper.querySelector('.product-form__group-name');

      return {
        wrapper,
        position: Number(firstInput?.dataset.optionPosition || index + 1),
        name: firstInput?.dataset.optionName || legend?.textContent?.trim() || `option${index + 1}`
      };
    });
  }

  function getSelections(container) {
    const selections = [];

    getOptionMetadata(container).forEach(({ wrapper, position }) => {
      const checked = wrapper.querySelector(`${SELECTORS.radio}:checked`);
      if (checked) selections[position - 1] = checked.value;
    });

    return selections;
  }

  function findExactVariant(variants, selections) {
    if (!selections.length || selections.some((value) => !value)) return null;

    return variants.find((variant) =>
      selections.every((value, index) => variant[`option${index + 1}`] === value)
    ) || null;
  }

  function variantHasValue(variant, position, value) {
    return variant[`option${position}`] === value;
  }

  function valueExists(variants, position, value) {
    return variants.some((variant) => variantHasValue(variant, position, value));
  }

  function valueHasAvailableVariant(variants, position, value) {
    return variants.some(
      (variant) => variant.available && variantHasValue(variant, position, value)
    );
  }

  function buildCandidateSelections(currentSelections, position, value) {
    const candidate = [...currentSelections];
    candidate[position - 1] = value;
    return candidate;
  }

  function clearState(input) {
    input.classList.remove(
      'disabled',
      CLASSES.soldOut,
      CLASSES.blockedSoldOut,
      CLASSES.nonexistent
    );

    input.disabled = false;
    input.removeAttribute('aria-disabled');
    input.removeAttribute('data-ammis-variant-state');
  }

  function setState(input, state) {
    clearState(input);
    input.dataset.ammisVariantState = state;

    switch (state) {
      case 'sold-out-clickable':
        input.classList.add('disabled', CLASSES.soldOut);
        input.setAttribute('aria-disabled', 'false');
        break;

      case 'sold-out-blocked':
        input.classList.add(
          'disabled',
          CLASSES.soldOut,
          CLASSES.blockedSoldOut
        );
        input.disabled = true;
        input.setAttribute('aria-disabled', 'true');
        break;

      case 'nonexistent':
        input.classList.add(CLASSES.nonexistent);
        input.disabled = true;
        input.setAttribute('aria-disabled', 'true');
        break;

      default:
        input.dataset.ammisVariantState = 'available';
        break;
    }
  }

  function updateOptionStates(container) {
    const variants = getVariants(container);
    if (!variants.length) return;

    const selections = getSelections(container);
    const optionMetadata = getOptionMetadata(container);

    optionMetadata.forEach(({ wrapper, position }) => {
      wrapper.querySelectorAll(SELECTORS.radio).forEach((input) => {
        const value = input.value;

        if (!valueExists(variants, position, value)) {
          setState(input, 'nonexistent');
          return;
        }

        const candidateSelections = buildCandidateSelections(
          selections,
          position,
          value
        );
        const candidateVariant = findExactVariant(variants, candidateSelections);

        if (!candidateVariant) {
          setState(input, 'nonexistent');
          return;
        }

        if (candidateVariant.available) {
          setState(input, 'available');
          return;
        }

        if (valueHasAvailableVariant(variants, position, value)) {
          setState(input, 'sold-out-clickable');
          return;
        }

        setState(input, 'sold-out-blocked');
      });
    });
  }

  function findOptionPosition(metadata, acceptedNames) {
    const match = metadata.find(({ name }) =>
      acceptedNames.includes(normalize(name))
    );

    return match?.position || null;
  }

  function getColorAndSizePositions(container) {
    const metadata = getOptionMetadata(container);

    let colorPosition = findOptionPosition(metadata, COLOR_NAMES);
    let sizePosition = findOptionPosition(metadata, SIZE_NAMES);

    if (!colorPosition || !sizePosition) {
      const positions = metadata.map(({ position }) => position);

      if (!sizePosition) sizePosition = positions[0] || 1;
      if (!colorPosition) {
        colorPosition = positions.find((position) => position !== sizePosition)
          || positions[positions.length - 1]
          || 2;
      }
    }

    return { colorPosition, sizePosition };
  }

  function getBadge(container) {
    const sectionId = container.dataset.section;
    const originalSectionId = container.dataset.originalSection;

    if (!sectionId && !originalSectionId) return null;

    const scope = container.closest('[id^="MainProduct-"], .product__popup') || document;
    const ids = unique([sectionId, originalSectionId]);

    for (const id of ids) {
      const escapedId = CSS.escape(id);
      const scopedBadge = scope.querySelector(`[data-stock-badge="${escapedId}"]`);
      if (scopedBadge) return scopedBadge;
    }

    for (const id of ids) {
      const escapedId = CSS.escape(id);
      const badge = document.querySelector(`[data-stock-badge="${escapedId}"]`);
      if (badge) return badge;
    }

    return null;
  }

  function getAvailableValuesForContext(
    variants,
    fixedPosition,
    fixedValue,
    returnPosition
  ) {
    return unique(
      variants
        .filter(
          (variant) =>
            variant.available &&
            variant[`option${fixedPosition}`] === fixedValue
        )
        .map((variant) => variant[`option${returnPosition}`])
    );
  }

  function updateStockBadge(container) {
    const variants = getVariants(container);
    const badge = getBadge(container);

    if (!variants.length || !badge) return;

    const selections = getSelections(container);
    const exactVariant = findExactVariant(variants, selections);
    const { colorPosition, sizePosition } = getColorAndSizePositions(container);

    const colorValue = selections[colorPosition - 1];
    const sizeValue = selections[sizePosition - 1];

    let text = MESSAGES.outOfStock;
    let isAvailable = false;

    if (exactVariant?.available) {
      text = MESSAGES.inStock;
      isAvailable = true;
    } else if (colorValue && sizeValue) {
      const sizesWithSelectedColor = getAvailableValuesForContext(
        variants,
        colorPosition,
        colorValue,
        sizePosition
      );

      if (sizesWithSelectedColor.length) {
        text = MESSAGES.colorInSizes(sizesWithSelectedColor.join(', '));
      } else {
        const colorsWithSelectedSize = getAvailableValuesForContext(
          variants,
          sizePosition,
          sizeValue,
          colorPosition
        );

        text = colorsWithSelectedSize.length
          ? MESSAGES.sizeInColors(colorsWithSelectedSize.join(', '))
          : MESSAGES.outOfStock;
      }
    }

    badge.textContent = text;
    badge.classList.toggle('stock-badge--in-stock', isAvailable);
    badge.classList.toggle('stock-badge--out-of-stock', !isAvailable);
    badge.setAttribute('aria-live', 'polite');
  }

  function refreshContainer(container) {
    if (!(container instanceof Element)) return;
    if (!container.matches(SELECTORS.container)) return;

    updateOptionStates(container);
    updateStockBadge(container);
  }

  function refreshAll(root = document) {
    root.querySelectorAll(SELECTORS.container).forEach(refreshContainer);
  }

  function scheduleRefresh(root = document) {
    if (refreshScheduled) return;

    refreshScheduled = true;
    window.setTimeout(() => {
      refreshScheduled = false;
      refreshAll(root);
    }, 0);
  }

  function injectStyles() {
    if (document.getElementById('ammis-smart-variant-select-styles')) return;

    const style = document.createElement('style');
    style.id = 'ammis-smart-variant-select-styles';
    style.textContent = `
      ${SELECTORS.container} input.${CLASSES.soldOut}:not(:disabled) + label {
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      ${SELECTORS.container} input.${CLASSES.blockedSoldOut} + label {
        cursor: not-allowed !important;
      }

      ${SELECTORS.container} input.${CLASSES.nonexistent} + label {
        text-decoration: none !important;
        background-image: none !important;
        cursor: not-allowed !important;
        opacity: 0.45;
      }

      ${SELECTORS.container} input.${CLASSES.nonexistent} + label::before,
      ${SELECTORS.container} input.${CLASSES.nonexistent} + label::after {
        display: none !important;
        content: none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function handleChange(event) {
    const container = event.target.closest(SELECTORS.container);
    if (!container) return;

    /*
     * O handler nativo do tema executa primeiro no custom element.
     * O atraso permite que preço, URL, imagem, SKU e botões sejam atualizados
     * antes de reaplicarmos exclusivamente os estados visuais/contextuais.
     */
    window.setTimeout(() => refreshContainer(container), 0);
    window.setTimeout(() => refreshContainer(container), 80);
  }

  function startObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      const hasRelevantInsertion = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some(
          (node) =>
            node instanceof Element &&
            (node.matches?.(SELECTORS.container) ||
              node.querySelector?.(SELECTORS.container))
        )
      );

      if (hasRelevantInsertion) scheduleRefresh();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    injectStyles();
    refreshAll();
    startObserver();
  }

  document.addEventListener('change', handleChange, false);

  document.addEventListener('shopify:section:load', (event) => {
    window.setTimeout(() => refreshAll(event.target), 0);
  });

  document.addEventListener('shopify:section:reorder', () => {
    window.setTimeout(() => refreshAll(), 0);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
