# Storefront features

Documentation for custom features on the Maison Affinage / vincent-store-dev theme (Dawn-based Online Store 2.0 + Vite).

## Cart rewards overview

Three stacked cart rewards share the same eligible total (gift and sample lines are excluded):

| Reward | Default threshold | Theme settings |
| --- | --- | --- |
| Free cold shipping | €60 | `cart_free_shipping_threshold` |
| Free gift | €100 | `cart_free_gift_*` |
| Free samples | €150 | `cart_free_sample_*` |

Progress UI:

- Cart page and cart drawer: [`snippets/cart-shipping-progress.liquid`](../snippets/cart-shipping-progress.liquid)
- Announcement bar live slide: [`snippets/announcement-bar-block.liquid`](../snippets/announcement-bar-block.liquid), refreshed by [`frontend/components/AnnouncementFreeShipping.js`](../frontend/components/AnnouncementFreeShipping.js)

Copy advances in order: shipping remaining → gift remaining → sample remaining → all rewards unlocked. The progress track fills toward the highest enabled threshold; markers sit at earlier steps.

## Free samples

Customers who reach the sample threshold can pick products from a merchant-selected collection on the cart page and in the cart drawer.

### Merchant setup

Theme settings → **Cart** → **Free samples**:

1. Enable free samples
2. Choose the sample collection (dev default: `echantillons-offerts`)
3. Set the threshold (shop currency units, e.g. `150`)
4. Set the maximum number of samples (default `2`)

Catalog conventions:

- Products priced at €0 (or paired with a discount that makes them free)
- Tag `free-sample` (product pages redirect home, same pattern as `free-gift`)
- Prefer hiding from search via the SEO metafield
- Keep the collection out of the main navigation

Dev store seed script: [`scripts/create-free-samples.mjs`](../scripts/create-free-samples.mjs) (creates eight cheese samples, the `echantillons-offerts` collection, and publishes them to the Online Store channel).

### Customer behavior

- Below the threshold: sample lines are removed; the last selection is kept on the cart attribute `free_sample_variant_ids`
- At or above the threshold: saved samples are restored (qty 1 each, capped at max). If nothing was saved, the picker waits for a choice
- Checkout is never blocked; zero samples is always allowed
- Removing a sample while still eligible updates the saved selection so it is not restored until chosen again

### Implementation

| Piece | Location |
| --- | --- |
| Settings | [`config/settings_schema.json`](../config/settings_schema.json) |
| Picker UI | [`snippets/cart-free-sample.liquid`](../snippets/cart-free-sample.liquid) |
| Sync logic | [`frontend/components/CartFreeSample.js`](../frontend/components/CartFreeSample.js) |
| Host element | [`layout/theme.liquid`](../layout/theme.liquid) (`<cart-free-sample>`) |
| Line treatment | [`sections/main-cart-items.liquid`](../sections/main-cart-items.liquid), [`snippets/cart-drawer.liquid`](../snippets/cart-drawer.liquid) |

Samples are added with line property `_sample: true`.

## Free gift

When the cart reaches the gift threshold, a configured product is auto-added (qty 1). Removing it sets `free_gift_declined` so it stays off until the customer uses “Add free gift again” or the cart drops below the threshold (which clears the decline flag).

| Piece | Location |
| --- | --- |
| Settings | `cart_free_gift_enabled`, `cart_free_gift_product`, `cart_free_gift_threshold` |
| Sync | [`frontend/components/CartFreeGift.js`](../frontend/components/CartFreeGift.js) |
| Add-again UI | [`snippets/cart-free-gift.liquid`](../snippets/cart-free-gift.liquid) |

Gift product pages use the `free-gift` tag and redirect home. Keep a real catalog price (EUR 5-10); the automatic discount (100% off that product, spend threshold) brings the line to EUR 0. The theme hides EUR 0 discount badges on other lines when Shopify attaches phantom allocations.

## Free shipping progress and pairing

- Progress bar: [`snippets/cart-shipping-progress.liquid`](../snippets/cart-shipping-progress.liquid)
- Pairing suggestions in the drawer: [`snippets/cart-pairing.liquid`](../snippets/cart-pairing.liquid) + [`sections/cart-pairing-recommendations.liquid`](../sections/cart-pairing-recommendations.liquid) — Shopify complementary recommendations (Search & Discovery), with related-product fallback; panel sits beside the drawer on large screens

## Announcement bar

Rotating slides for free shipping / rewards messaging and static announcements (returns, etc.). Cart-aware copy lives in the `free_shipping` block type and updates when the cart changes.

## Product cards: hover image and quick add

- Second image on hover and in-card quick add: [`frontend/components/CardQuickAdd.js`](../frontend/components/CardQuickAdd.js), [`frontend/components/CardQuickAdd.scss`](../frontend/components/CardQuickAdd.scss)
- Wired through product cards and the product slider section
- Slider component: [`frontend/components/Slider.js`](../frontend/components/Slider.js)

## Maison Affinage storefront

Theme settings, homepage hero (fixed text over fading backgrounds), collection and product template polish, and brand-oriented copy for cold shipping / fromagerie rewards. See recent commits on `feat/maison-affinage-storefront` and follow-up merges into `main`.

## Toolchain and CI

- Package manager: **pnpm** (see [`package.json`](../package.json) and [`.nvmrc`](../.nvmrc))
- Frontend: Vite 8 + Tailwind 4 under [`frontend/`](../frontend/); hashed outputs are gitignored
- Local preview: `pnpm dev` (theme + Vite + Prettier watch)
- Production frontend build: `pnpm vite:build`
- CI: Theme Check, Lighthouse (homepage, product, collection, cart), and theme deploy workflows under [`.github/workflows/`](../.github/workflows/)

Agent conventions: [`AGENTS.md`](../AGENTS.md) and [`.cursor/rules/`](../.cursor/rules/).
