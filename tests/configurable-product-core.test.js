const assert = require('node:assert/strict');
const test = require('node:test');

const api = require('../assets/configurable-product-initial.js');

function media(src) {
  return { src, alt: null, width: 100, height: 120, srcset: null, sizes: null };
}

function payloadFixture() {
  return {
    version: 1,
    locale: 'pt-BR',
    currency: 'BRL',
    product: {
      id: 'gid://shopify/Product/1',
      title: 'Calça Aurora',
      handle: 'calca-aurora',
      featuredImage: media('featured.jpg'),
      configuratorEnabled: true
    },
    groups: [
      {
        title: 'Tecido',
        code: 'tecido',
        description: null,
        required: true,
        interfaceType: 'buttons',
        order: 1,
        sourceIndex: 0,
        options: [
          { name: 'Cru', code: 'cru', description: null, image: null, color: null, priceAdditionCents: 0, available: true, order: null, sourceIndex: 0 },
          { name: 'Capra', code: 'capra', description: null, image: null, color: null, priceAdditionCents: 50000, available: true, order: null, sourceIndex: 1 }
        ]
      },
      {
        title: 'Cor',
        code: 'cor',
        description: null,
        required: true,
        interfaceType: 'swatches',
        order: 2,
        sourceIndex: 1,
        options: [
          { name: 'Azul', code: 'azul', description: null, image: null, color: '#00f', priceAdditionCents: 0, available: true, order: null, sourceIndex: 0 }
        ]
      }
    ],
    variants: [
      { id: 'v34', title: '34', selectedOptions: [{ name: 'Tamanho', value: '34' }], sizeValue: '34', priceCents: 146700, available: true },
      { id: 'v36', title: '36', selectedOptions: [{ name: 'Tamanho', value: '36' }], sizeValue: '36', priceCents: 150000, available: true }
    ],
    imageStates: [
      { selections: [], image: media('initial.jpg'), position: null, sourceIndex: 0 },
      { selections: [{ groupCode: 'tecido', optionCode: 'capra' }], image: media('capra.jpg'), position: null, sourceIndex: 1 },
      { selections: [{ groupCode: 'tecido', optionCode: 'capra' }, { groupCode: 'cor', optionCode: 'azul' }], image: media('capra-azul.jpg'), position: null, sourceIndex: 2 }
    ],
    sizeOptionName: 'Tamanho'
  };
}

test('orders null values by sourceIndex deterministically', () => {
  const result = api.sortByOrderAndSourceIndex([
    { order: null, sourceIndex: 2 },
    { order: null, sourceIndex: 1 },
    { order: 1, sourceIndex: 3 }
  ]);
  assert.deepEqual(result.map((item) => item.sourceIndex), [3, 1, 2]);
});

test('normalizes Aurora-shaped payload and derives one starting price', () => {
  const result = api.normalizePayload(payloadFixture());
  assert.equal(result.valid, true);
  assert.equal(api.deriveStartingPrice(result.payload), 146700);
  assert.deepEqual(result.payload.groups.map((group) => group.code), ['tecido', 'cor']);
});

test('builds contract step fields and validates the complete configuration', () => {
  const normalized = api.normalizePayload(payloadFixture()).payload;
  const state = api.createInitialState(normalized);
  const steps = api.buildSteps(normalized);
  assert.deepEqual(steps.map((step) => step.kind), ['group', 'group', 'variant', 'review']);
  assert.deepEqual(steps.map((step) => step.position), [0, 1, 2, 3]);
  assert.equal(steps[0].sourceCode, 'tecido');
  assert.equal(steps[2].sourceCode, 'tamanho');
  assert.equal(api.validateConfiguration(state, normalized).status, 'invalid');
  state.selectedOptions.tecido = 'cru';
  state.selectedOptions.cor = 'azul';
  state.selectedVariantId = 'v34';
  assert.equal(api.validateConfiguration(state, normalized).status, 'ready');
});

test('accepts a generic three-group five-size forty-image-state dataset', () => {
  const fixture = payloadFixture();
  fixture.groups.push({
    title: 'Fecho',
    code: 'fecho',
    description: null,
    required: true,
    interfaceType: 'buttons',
    order: 3,
    sourceIndex: 2,
    options: [
      { name: 'Um', code: 'um', description: null, image: null, color: null, priceAdditionCents: 0, available: true, order: null, sourceIndex: 0 },
      { name: 'Dois', code: 'dois', description: null, image: null, color: null, priceAdditionCents: 0, available: true, order: null, sourceIndex: 1 },
      { name: 'Três', code: 'tres', description: null, image: null, color: null, priceAdditionCents: 0, available: true, order: null, sourceIndex: 2 }
    ]
  });
  fixture.variants.push(
    { id: 'v38', title: '38', selectedOptions: [{ name: 'Tamanho', value: '38' }], sizeValue: '38', priceCents: 146700, available: true },
    { id: 'v40', title: '40', selectedOptions: [{ name: 'Tamanho', value: '40' }], sizeValue: '40', priceCents: 146700, available: true },
    { id: 'v42', title: '42', selectedOptions: [{ name: 'Tamanho', value: '42' }], sizeValue: '42', priceCents: 146700, available: true }
  );
  fixture.imageStates = Array.from({ length: 40 }, (_, index) => ({
    selections: index === 0 ? [] : [{ groupCode: 'tecido', optionCode: index % 2 ? 'cru' : 'capra' }],
    image: media(`state-${index}.jpg`),
    position: index,
    sourceIndex: index
  }));
  const result = api.normalizePayload(fixture);
  assert.equal(result.valid, true);
  assert.equal(result.payload.groups.length, 3);
  assert.equal(result.payload.variants.length, 5);
  assert.equal(result.payload.imageStates.length, 40);
  assert.deepEqual(api.buildSteps(result.payload).map((step) => step.sourceCode), ['tecido', 'cor', 'fecho', 'tamanho', null]);
});

test('derives selected additions and estimated total from normalized data', () => {
  const normalized = api.normalizePayload(payloadFixture()).payload;
  const state = api.createInitialState(normalized);
  state.selectedOptions.tecido = 'capra';
  state.selectedOptions.cor = 'azul';
  state.selectedVariantId = 'v34';
  assert.equal(api.deriveSelectedAdditions(state.selectedOptions, normalized), 50000);
  assert.equal(api.deriveEstimatedTotal(state, normalized), 196700);
});

test('resolves full image, partial image and featured fallback', () => {
  const normalized = api.normalizePayload(payloadFixture()).payload;
  const index = api.indexImageStates(normalized);
  assert.equal(api.resolveImage({ tecido: 'capra', cor: 'azul' }, normalized, index).image.src, 'capra-azul.jpg');
  assert.equal(api.resolveImage({ tecido: 'capra', cor: 'missing' }, normalized, index).image.src, 'capra.jpg');
  assert.equal(api.resolveImage({ tecido: 'missing' }, normalized, index).image.src, 'initial.jpg');
});

test('rejects duplicate codes and malformed price additions without coercing to zero', () => {
  const fixture = payloadFixture();
  fixture.groups[0].options.push({ ...fixture.groups[0].options[0], code: 'invalid-price', name: 'Invalid', sourceIndex: 2, priceAdditionCents: '0' });
  fixture.groups[0].options.push({ ...fixture.groups[0].options[0], sourceIndex: 3, priceAdditionCents: 0 });
  const result = api.normalizePayload(fixture);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('DUPLICATE_OPTION_CODE'));
  assert.ok(result.warnings.includes('INVALID_PRICE_ADDITION'));
});

test('rejects more than one relevant native variant dimension', () => {
  const fixture = payloadFixture();
  fixture.variants = fixture.variants.map((variant, index) => ({
    ...variant,
    selectedOptions: [
      ...variant.selectedOptions,
      { name: 'Model', value: index ? 'B' : 'A' }
    ]
  }));
  const result = api.normalizePayload(fixture);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('UNSUPPORTED_VARIANT_CONFIGURATION'));
});

test('builds the contracted visible and private properties', () => {
  const normalized = api.normalizePayload(payloadFixture()).payload;
  const state = api.createInitialState(normalized);
  state.selectedOptions.tecido = 'capra';
  state.selectedOptions.cor = 'azul';
  const properties = api.buildCartProperties(state, normalized);
  assert.equal(properties['Personalização — Tecido'], 'Capra');
  assert.equal(properties._configurator_code_tecido, 'capra');
  assert.equal(properties._configurator_version, '1');
  assert.equal(Object.hasOwn(properties, 'Tamanho'), false);
});

test('keeps real price strategy closed in this V1', () => {
  assert.equal(api.REAL_PRICE_STRATEGY_APPROVED, false);
});

test('fails closed for an unsupported payload version', () => {
  const fixture = payloadFixture();
  fixture.version = 2;
  const result = api.normalizePayload(fixture);
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ['UNSUPPORTED_PAYLOAD_VERSION']);
});

test('omits an optional group without valid options', () => {
  const fixture = payloadFixture();
  fixture.groups.push({
    title: 'Extra',
    code: 'extra',
    description: null,
    required: false,
    interfaceType: 'buttons',
    order: 3,
    sourceIndex: 2,
    options: [
      { name: 'Indisponível', code: 'unavailable', description: null, image: null, color: null, priceAdditionCents: 0, available: false, order: null, sourceIndex: 0 }
    ]
  });
  const result = api.normalizePayload(fixture);
  assert.equal(result.valid, true);
  assert.equal(result.payload.groups.some((group) => group.code === 'extra'), false);
  assert.equal(api.buildSteps(result.payload).some((step) => step.id === 'group:extra'), false);
});

test('keeps a valid selection when its image state has no media', () => {
  const fixture = payloadFixture();
  fixture.imageStates = fixture.imageStates.map((state) => state.selections.length === 2 ? { ...state, image: null } : state);
  const normalized = api.normalizePayload(fixture);
  assert.equal(normalized.valid, true);
  const state = api.createInitialState(normalized.payload);
  state.selectedOptions.tecido = 'capra';
  state.selectedOptions.cor = 'azul';
  state.selectedVariantId = 'v34';
  assert.equal(api.validateConfiguration(state, normalized.payload).status, 'ready');
  assert.equal(api.resolveImage(state.selectedOptions, normalized.payload).image.src, 'capra.jpg');
});

test('resolves image collisions by position/sourceIndex and skips failed media', () => {
  const fixture = payloadFixture();
  fixture.imageStates.push(
    { selections: [{ groupCode: 'tecido', optionCode: 'capra' }], image: media('capra-late.jpg'), position: 2, sourceIndex: 3 },
    { selections: [{ groupCode: 'tecido', optionCode: 'capra' }], image: media('capra-first.jpg'), position: 1, sourceIndex: 4 }
  );
  const normalized = api.normalizePayload(fixture).payload;
  const index = api.indexImageStates(normalized);
  assert.equal(api.resolveImage({ tecido: 'capra' }, normalized, index).image.src, 'capra-first.jpg');
  assert.equal(api.resolveImage({ tecido: 'capra' }, normalized, index, new Set(['capra-first.jpg'])).image.src, 'capra-late.jpg');
});

test('does not resolve an unavailable native size variant', () => {
  const fixture = payloadFixture();
  fixture.variants[1] = { ...fixture.variants[1], available: false };
  const normalized = api.normalizePayload(fixture).payload;
  assert.deepEqual(api.resolveVariantBySize('36', normalized), { status: 'unavailable', variant: null });
});

test('selects the first group with a positive addition as the featured group', () => {
  const payload = payloadFixture();
  assert.equal(api.selectFeaturedGroup(payload).code, 'tecido');
  payload.groups[0].options.forEach((option) => { option.priceAdditionCents = 0; });
  assert.equal(api.selectFeaturedGroup(payload), null);
  payload.groups[1].options[0].priceAdditionCents = 1000;
  assert.equal(api.selectFeaturedGroup(payload).code, 'cor');
});

test('overview steps omit the review step and keep group then size order', () => {
  const ids = api.buildOverviewSteps(payloadFixture()).map((step) => step.id);
  assert.deepEqual(ids, ['group:tecido', 'group:cor', 'variant:size']);
});

test('step counter excludes the review step and the review has its own marker', () => {
  const payload = payloadFixture();
  assert.deepEqual(api.deriveStepCounter('group:tecido', payload), { current: 1, total: 3, isReview: false });
  assert.deepEqual(api.deriveStepCounter('variant:size', payload), { current: 3, total: 3, isReview: false });
  assert.deepEqual(api.deriveStepCounter('review', payload), { current: 3, total: 3, isReview: true });
});

test('dialog title follows the current step and falls back to the review title', () => {
  const payload = payloadFixture();
  assert.equal(api.deriveStepTitle('group:cor', payload, 'Revise'), 'Cor');
  assert.equal(api.deriveStepTitle('variant:size', payload, 'Revise'), 'Tamanho');
  assert.equal(api.deriveStepTitle('review', payload, 'Revise'), 'Revise');
});

test('next is inactive until the required selection of the current step exists', () => {
  const payload = payloadFixture();
  const state = api.createInitialState(payload);
  assert.equal(api.isNextInactive(state, payload), true);
  state.selectedOptions.tecido = 'capra';
  assert.equal(api.isNextInactive(state, payload), false);
  state.currentStepId = 'review';
  assert.equal(api.isNextInactive(state, payload), false);
});

test('option card images use only the previous groups plus the card option', () => {
  const payload = payloadFixture();
  const index = api.indexImageStates(payload);
  const src = (group, option, selected) => api.resolveOptionCardImage(group, option, selected, payload, index).src;
  assert.equal(src('tecido', 'capra', { cor: 'azul' }), 'capra.jpg');
  assert.equal(src('cor', 'azul', { tecido: 'capra' }), 'capra-azul.jpg');
  assert.equal(src('cor', 'azul', { tecido: 'capra', cor: 'verde' }), 'capra-azul.jpg');
});

test('step messages: parse, stable pick, and nothing for groups without blocks', () => {
  const messages = api.parseStepMessages([
    { groupCode: 'Botao', kind: 'call', text: 'A' },
    { groupCode: 'botao', kind: 'call', text: 'B' },
    { groupCode: 'botao', kind: 'support', text: 'S' },
    { groupCode: 'botao', kind: 'call', text: '   ' },
    { groupCode: '', kind: 'call', text: 'X' }
  ]);
  assert.equal(messages.length, 3);
  assert.deepEqual(api.pickStepMessages(messages, 'botao', () => 0), { call: 'A', support: 'S' });
  assert.deepEqual(api.pickStepMessages(messages, 'botao', () => 0.99), { call: 'B', support: 'S' });
  assert.equal(api.pickStepMessages(messages, 'cor', () => 0), null);
  assert.equal(api.pickStepMessages([], 'botao', () => 0), null);
});

test('combination name uses the base name metafield when present', () => {
  const payload = payloadFixture();
  assert.equal(api.buildCombinationName('', payload, {}), 'Calça Aurora');
  assert.equal(api.buildCombinationName('Calça Aurora Linho', payload, { tecido: 'capra', cor: 'azul' }), 'Calça Aurora Linho Capra Azul');
  assert.equal(api.buildCombinationName(null, payload, { tecido: 'cru' }), 'Calça Aurora Cru');
});

test('size chart is hidden when the page content is empty', () => {
  assert.equal(api.hasSizeChart(''), false);
  assert.equal(api.hasSizeChart('   '), false);
  assert.equal(api.hasSizeChart('<table></table>'), true);
});

test('groups with prices or descriptions render as a detailed list', () => {
  const payload = payloadFixture();
  assert.equal(api.groupHasDetails(payload.groups[0]), true);
  assert.equal(api.groupHasDetails(payload.groups[1]), false);
});
