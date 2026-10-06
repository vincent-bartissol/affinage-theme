# Agent guide — vincent-store-dev

This repository is a **Shopify Online Store 2.0 theme** (Dawn-based) with a **Vite + Tailwind** frontend pipeline. Prefer theme and Liquid conventions over inventing a custom app architecture.

## Stack

- Package manager: **pnpm** (never introduce `package-lock.json` or switch scripts back to npm)
- Node: version in `.nvmrc` (currently 24.x)
- Theme CLI: local `@shopify/cli` via `pnpm exec shopify …`
- Build: Vite 8 + `vite-plugin-shopify` + Tailwind 4 + `sass-embedded`
- Store (dev scripts): `vincent-store-dev.myshopify.com`

## Where to edit

| Change type | Put it here |
| --- | --- |
| Page structure / Shopify sections | `sections/`, `templates/`, `snippets/`, `layout/` |
| Theme editor settings | `config/settings_schema.json`, section `{% schema %}` blocks |
| JS/SCSS components compiled by Vite | `frontend/` (entrypoints under `frontend/entrypoints/`) |
| Static theme JS/CSS that Dawn already ships | `assets/` (do not hand-edit Vite hashed `theme.*.min.*` outputs) |
| Translations | `locales/` |

Do **not** commit generated Vite artifacts: `snippets/vite-tag.liquid`, `assets/manifest.json`, `assets/theme.*.min.js`, `assets/theme.*.min.css`.

## Commands agents should use

```sh
pnpm install
pnpm dev              # theme preview + Vite + Prettier watch
pnpm vite:build       # production frontend build
pnpm exec shopify theme check
```

After frontend changes that need deploying, run `pnpm vite:build` so CI/theme push has hashed assets.

## Coding conventions

- Keep diffs focused: no drive-by refactors, no unrelated Liquid/theme churn when changing tooling.
- Prefer existing Dawn patterns for sections/snippets before adding new abstractions.
- New interactive UI that needs modern JS/CSS: add a Vite component under `frontend/components/` and import it from `frontend/entrypoints/theme.js` / `theme.scss`.
- Use Tailwind utilities in Liquid/SCSS when styling custom sections; reuse Dawn CSS components when extending stock sections.
- Format Liquid/JS with the project Prettier config (`@shopify/prettier-plugin-liquid`).
- Conventional commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `ci`). Never commit on `main`; use a branch and PR.
- Never commit secrets, store passwords, or CLI tokens. `shopify.theme.toml` may contain placeholders — do not invent real credentials.

## Shopify-specific rules

- Sections must remain Online Store 2.0 compatible (JSON templates + `{% schema %}`).
- Prefer `{% render %}` over `{% include %}`.
- Avoid inline `<script>` when the logic belongs in `frontend/` or a dedicated `assets/*.js` file already used by Dawn.
- Theme Check should stay clean for files you touch (`pnpm exec shopify theme check`).

## Out of scope unless asked

- Migrating the whole theme off Dawn
- Changing live/production theme IDs in CI
- Force-pushing, amending shared history, or skipping git hooks
