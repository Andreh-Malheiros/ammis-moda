# Product configurator V1/V2 visual prototype

Internal storefront prototype for products explicitly configured with Shopify product metafields. It reads the product's metaobject references in Liquid and leaves normal product pages on their existing path.

## Activation

1. In Shopify Admin, set the product metafield `custom.configurator_enabled` to `true`.
2. Add one or more `configurator_group` references to `custom.configurator_groups`.
3. Place the **Configurador de produto** block on the product template. The default product template includes it between variant selection and the existing purchase controls.

The storefront renders the configurator only when the enabled metafield is true and the group list is nonempty. An absent or empty configuration adds no configurator markup or assets.

## Shopify data contract

The handles below were checked against the existing Draft demo product and its Shopify definitions on 2026-09-21. Both metaobject definitions have storefront access `PUBLIC_READ`. The single Liquid mapping is in `snippets/product-configurator.liquid`.

| Resource | Handle / fields |
| --- | --- |
| Product metafield | `custom.configurator_enabled` (`boolean`) |
| Product metafield | `custom.configurator_groups` (`list.metaobject_reference` to `configurator_group`) |
| `configurator_group` | `title` and `code` (`single_line_text_field`); `description` (`multi_line_text_field`); `interface_type` (`single_line_text_field`); `required` (`boolean`); `options` (`list.metaobject_reference` to `configurator_option`); `order` (`number_integer`) |
| `configurator_option` | `name` and `code` (`single_line_text_field`); `description` (`multi_line_text_field`); `image` (`file_reference`); `color` (`color`); `price_addition` (`number_decimal`); `available` (`boolean`); `order` (`number_integer`) |

Group and option sequence follows the corresponding Shopify reference-list order. The `order` fields remain available in the data contract but are not used to invent or override that sequence.

## Option types and behavior

- `buttons`: labeled radio cards.
- `swatches`: color swatch with a visible option name and selected outline.
- `image_cards`: image when present and enabled in block settings, with an accessible alt fallback to the option name; falls back to a text card when there is no image.
- `select`: native select; unavailable options are disabled.
- An option with `available = false` cannot be selected. If `available` is blank, the option remains available.
- Required groups start unselected. Add to cart and buy-now submission are blocked until each required group has a choice; the first invalid group receives focus.

## V2 textual preview

The configurator numbers each group as a step in the order of `custom.configurator_groups`. The final textual preview uses the current product title and renders every group dynamically with its current choice and display-only addition, followed by the existing estimated totals. A group that has not been selected remains labeled `Não selecionado`. The preview does not create or imply a composite product image; real combination imagery can replace the text preview in a future phase.

A read-only check of the live product **BLAZER ITALY CARAIVA** (handle `blazer-italy`, product ID `7957920579686`) on 2026-09-21 returned no `custom.configurator_enabled` or `custom.configurator_groups` metafield. Therefore Cor, Botão, and Tecido are all absent for this product today; the product will remain on the normal PDP path until it is explicitly configured. In particular, the Tecido group must be added to the product's Shopify configuration before it can appear. This prototype does not create that data or invent options.

## Price and cart properties

`price_addition` is a decimal amount in the shop's currency. The browser converts it to cents for display calculations. The summary shows base price, customization subtotal, and estimated total, and tracks the selected variant's base price when the theme emits a variant change.

**CUSTOMIZATION PRICE IS DISPLAY-ONLY IN V1.** The frontend estimate does not change the Shopify variant price, checkout price, or server-side price. The current product form receives visible selection properties (`properties[Group title]`) and private identifier properties (`properties[_configurator_code_group]`). Those properties record choices and are never a source of trusted pricing. Real collection of customization charges requires a separately approved future phase.

### Buy now handoff limitation

The existing Buy now handler first posts `new FormData(this.form)` to Shopify `/cart/add.js`, then reads `/cart.js` and encodes only `{ items: [{ variant_id, quantity }] }` for the external `/c/{hash}` route. The local checkout contract in `Andreh-Malheiros/checkout.ammis` reads only variant and quantity from that hash; its downstream Storefront `cartCreate` lines also contain only merchandise ID and quantity. It has no confirmed line-property/attribute contract. The theme therefore does not add properties to the hash, because the checkout would ignore that invented extension. **Add to cart is the validated path for retaining the configurator properties in Shopify cart. Buy now property preservation is blocked until the checkout contract is separately extended and approved.**

## Theme Editor

The block has presentation settings for title, introductory copy, base price, customization subtotal, summary, descriptions, images, additions, and summary title. Individual groups and options remain controlled only by Shopify metaobjects.

## Local demo and limits

Use the existing Draft product **TESTE — Produto Configurável** (ID `8225989787750`) in a future unpublished-theme preview. Its live-read values were verified as base price R$ 199,00; groups Cor, Gola, Botão; available options Branco/Preto/Azul, Tradicional/Italiana/Padre, and Padrão/Madrepérola. Italiana contributes R$ 30 and Madrepérola R$ 25 to the display estimate, so selecting both produces R$ 254,00 before any other nonzero choice.

The V1 visual behavior and cart properties were previously confirmed by the user in the Shopify preview. V2 code changes still require visual review in that preview at desktop, tablet, and mobile widths. The existing sticky product form keeps its compact controls; its runtime-injected copy receives the selected configuration properties from the main configurator. No Shopify product or metaobject data should be changed for this prototype.
