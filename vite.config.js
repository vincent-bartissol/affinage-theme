import { defineConfig } from "vite";
import shopify from "vite-plugin-shopify";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	build: {
		emptyOutDir: false,
		cssMinify: true,
		manifest: "manifest.json",
		rolldownOptions: {
			output: {
				entryFileNames: "[name].[hash].min.js",
				chunkFileNames: "[name].[hash].min.js",
				assetFileNames: "[name].[hash].min[extname]",
			},
		},
	},
	plugins: [
		shopify({
			themeRoot: "./",
			sourceCodeDir: "frontend",
			entrypointsDir: "frontend/entrypoints",
			additionalEntrypoints: [],
			snippetFile: "vite-tag.liquid",
			versionNumbers: false,
			tunnel: false,
			themeHotReload: true,
		}),
		tailwindcss(),
	],
	server: {
		cors: {
			origin:
				/^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|([A-Za-z0-9\-\.]+)?(\.myshopify\.com)|\[::1\])(?::\d+)?$/,
		},
	},
});
