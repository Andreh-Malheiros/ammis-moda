# Product configurator V1/V2 visual prototype

Internal storefront prototype for products explicitly configured with Shopify product metafields. It reads the product's metaobject references in Liquid and leaves normal product pages on their existing path.

## Activation

1. In Shopify Admin, set the product metafield `custom.configurator_enabled` to `true`.
2. Add one or more `configurator_group` references to `custom.configurator_groups`.
3. Place the **Configurador de produto** block on the product template. The block renders a **Personalizar** trigger before the existing purchase controls and opens the guided configuration in a modal.

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

## V2 modal flow

The modal numbers each configured group as a step in the order of `custom.configurator_groups`, followed by a review step. Required choices are validated before continuing and before confirmation. The review renders each current choice and display-only addition, the base price, customization subtotal, estimated total, and an edit action for each group. It uses the product's existing featured image when available, option images only when present, and text when an image is absent. It never creates or implies a composite product image.

If the product has a real `Cor`/`Color` variant option, that option remains selected on the PDP and is summarized in the review; a matching configurator color group is omitted to avoid asking the customer to choose the same color twice. If color exists only as a configurator group, it remains the first modal step. Other groups stay data-driven and do not depend on fixed group names.

A read-only check of the live product **BLAZER ITALY CARAIVA** (handle `blazer-italy`, product ID `7957920579686`) on 2026-09-21 returned no `custom.configurator_enabled` or `custom.configurator_groups` metafield. Therefore Cor, Botão, and Tecido are all absent for this product today; the product will remain on the normal PDP path until it is explicitly configured. In particular, the Tecido group must be added to the product's Shopify configuration before it can appear. This prototype does not create that data or invent options.

## Price and cart properties

`price_addition` is a decimal amount in the shop's currency. The browser converts it to cents for display calculations. The summary shows base price, customization subtotal, and estimated total, and tracks the selected variant's base price when the theme emits a variant change.

**CUSTOMIZATION PRICE IS DISPLAY-ONLY IN V1.** The frontend estimate does not change the Shopify variant price, checkout price, or server-side price. The current product form receives visible selection properties (`properties[Group title]`) and private identifier properties (`properties[_configurator_code_group]`). Those properties record choices and are never a source of trusted pricing. Real collection of customization charges requires a separately approved future phase.

### Buy now handoff limitation

The existing Buy now handler first posts `new FormData(this.form)` to Shopify `/cart/add.js`, then reads `/cart.js` and encodes only `{ items: [{ variant_id, quantity }] }` for the external `/c/{hash}` route. The local checkout contract in `Andreh-Malheiros/checkout.ammis` reads only variant and quantity from that hash; its downstream Storefront `cartCreate` lines also contain only merchandise ID and quantity. It has no confirmed line-property/attribute contract. The theme therefore does not add properties to the hash, because the checkout would ignore that invented extension. **Add to cart is the validated path for retaining the configurator properties in Shopify cart. Buy now property preservation is blocked until the checkout contract is separately extended and approved.**

## Theme Editor

The block settings control the title, introductory copy, option descriptions, option images, and option price additions. The final review always shows the base price, customization subtotal, estimated total, and display-only notice. Individual groups and options remain controlled only by Shopify metaobjects.

## Local demo and limits

Use the isolated product **BLAZER ITALY — TESTE ISOLADO DO CONFIGURADOR** (ID `8226282602598`, handle `blazer-italy-teste-isolado`) in the unpublished-theme preview. It is active but unpublished to sales channels, has one untracked base variant at R$ 199,00, and has no product image. Its required groups are Cor (Preto and Branco), Botão (Dourado 1, Dourado 2, Prateado), and Tecido (Tecido 1 and Tecido 2). All additions on these options are test-only values; for example, Dourado 2 plus Tecido 2 displays R$ 35,00 in additions and an estimated total of R$ 234,00. **These values are for testing only and are not charged at checkout.**

The V1 visual behavior and cart properties were previously confirmed by the user in the Shopify preview. The modal implementation requires visual review in the unpublished theme at desktop, tablet, and mobile widths. The existing sticky product form remains unchanged; the runtime-injected copy continues to receive the selected configuration properties from the main configurator. No Shopify product or metaobject data should be changed for this prototype.
