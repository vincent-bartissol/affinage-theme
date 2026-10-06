# vincent-store-dev

Shopify Online Store theme based on Dawn, with a Vite + Tailwind CSS frontend toolchain.

Dev store: `vincent-store-dev.myshopify.com`

## Requirements

- Node.js **24** (see [`.nvmrc`](.nvmrc); engines require `>=22.12.0`)
- [pnpm](https://pnpm.io) **10** (pinned via `packageManager` in [`package.json`](package.json))
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli/theme) (installed as a project dependency)

Enable Corepack once so the pinned pnpm version is used:

```sh
corepack enable
```

## Setup

```sh
pnpm install
pnpm dev
```

`pnpm dev` runs three processes in parallel:

1. `shopify theme dev` against the development store
2. Vite (HMR for JS/SCSS)
3. Prettier watch on Liquid and frontend sources

### Useful scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Theme preview + Vite + Prettier watch |
| `pnpm vite:build` | Production build of frontend assets into `assets/` |
| `pnpm shopify:deploy` | Push the theme to the development store |
| `pnpm exec shopify theme check` | Lint the theme |
| `pnpm prettier ./layout` | Format specific paths |

Built Vite outputs (`assets/theme.*.min.js`, `assets/theme.*.min.css`, `assets/manifest.json`, `snippets/vite-tag.liquid`) are generated and gitignored. Always run `pnpm vite:build` before deploying from CI or a clean checkout.

## Project layout

| Path | Role |
| --- | --- |
| `layout/`, `sections/`, `snippets/`, `templates/` | Shopify Liquid theme |
| `config/` | Theme settings schema and data |
| `locales/` | Translations |
| `frontend/` | Vite source (entrypoints + components) |
| `assets/` | Theme static assets + Vite build output |
| `vite.config.js` | Vite + `vite-plugin-shopify` + Tailwind |

Frontend entrypoints live in `frontend/entrypoints/` and are injected through the `vite-tag` snippet in `layout/theme.liquid`.

## Tooling

- **Vite 8** with [`vite-plugin-shopify`](https://www.npmjs.com/package/vite-plugin-shopify)
- **Tailwind CSS 4** via `@tailwindcss/vite`
- **Sass** (`sass-embedded`) for `frontend/**/*.scss`
- **Swiper** for the product slider section
- **Prettier** with `@shopify/prettier-plugin-liquid`

## Continuous Integration

[`.github/workflows/CICD.yml`](.github/workflows/CICD.yml) installs with pnpm, runs `pnpm vite:build`, then deploys with `pnpm exec shopify theme push`.

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs Theme Check and Lighthouse. Lighthouse builds the theme, pushes a temporary preview, and audits the homepage, a product page, the `all` collection, and the cart.

## AI agents

See [`AGENTS.md`](AGENTS.md) and [`.cursor/rules/`](.cursor/rules/) for conventions Cursor and other coding agents should follow in this repo.
