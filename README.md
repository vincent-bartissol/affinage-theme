# Requires
- Node v24 (see `.nvmrc`)
- pnpm 10 (pinned via `packageManager` in `package.json`)
- Shopify CLI https://shopify.dev/docs/api/shopify-cli/theme
- Vite - vite-plugin-shopify https://www.npmjs.com/package/vite-plugin-shopify

# Launch commands
```sh
pnpm install
pnpm dev # Launch Vite + Shopify server
```

## Dev Dependency
- Prettier : installed but not add to main command
  -- dev : "dev": "run-p \"shopify:dev\" \"vite\" \"prettier:watch\"",
  -- pnpm prettier ./layout/*

- Tailwind : to check installation


### Theme Check

We recommend using [Theme Check](https://github.com/shopify/theme-check) as a way to validate and lint your Shopify themes.

We've added Theme Check to Dawn's [list of VS Code extensions](/.vscode/extensions.json) so if you're using Visual Studio Code as your code editor of choice, you'll be prompted to install the [Theme Check VS Code](https://marketplace.visualstudio.com/items?itemName=Shopify.theme-check-vscode) extension upon opening VS Code after you've forked and cloned Dawn.

You can also run it from a terminal with the following Shopify CLI command:

```bash
pnpm exec shopify theme check
```

### Continuous Integration

Dawn uses [GitHub Actions](https://github.com/features/actions) to maintain the quality of the theme. [This is a starting point](https://github.com/Shopify/dawn/blob/main/.github/workflows/ci.yml) and what we suggest to use in order to ensure you're building better themes. Feel free to build off of it!

#### Shopify/lighthouse-ci-action

We love fast websites! Which is why we created [Shopify/lighthouse-ci-action](https://github.com/Shopify/lighthouse-ci-action). This runs a series of [Google Lighthouse](https://developers.google.com/web/tools/lighthouse) audits for the home, product and collections pages on a store to ensure code that gets added doesn't degrade storefront performance over time.

#### Shopify/theme-check-action

Dawn runs [Theme Check](#Theme-Check) on every commit via [Shopify/theme-check-action](https://github.com/Shopify/theme-check-action).
