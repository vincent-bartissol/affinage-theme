#!/usr/bin/env node
/**
 * One-off: create free-sample products + collection on vincent-store-dev.
 * Uses Shopify CLI store session credentials.
 */
import { readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { File } from "node:buffer";

const STORE = "vincent-store-dev.myshopify.com";
const API_VERSION = "2025-10";
const IMAGE_DIR =
	"/home/vincent/.cursor/projects/home-vincent-www-shopify-folder-shopify-store-dev/assets";

const SAMPLES = [
	{
		title: "Échantillon Comté 24 mois",
		handle: "echantillon-comte-24-mois",
		description:
			"<p>Petite portion de Comté affiné 24 mois, fruité et cristallisé. Offerte dès le seuil d’échantillons atteint.</p>",
		image: "sample-comte.jpg",
	},
	{
		title: "Échantillon Beaufort d'alpage",
		handle: "echantillon-beaufort-dalpage",
		description:
			"<p>Échantillon de Beaufort d’alpage, pâte fondante aux notes de lait des alpages.</p>",
		image: "sample-beaufort.jpg",
	},
	{
		title: "Échantillon chèvre cendré",
		handle: "echantillon-chevre-cendre",
		description:
			"<p>Fromage de chèvre cendré, croûte ashée et cœur tendre. Découverte offerte dans le panier.</p>",
		image: "sample-chevre.jpg",
	},
	{
		title: "Échantillon bleu d'Auvergne",
		handle: "echantillon-bleu-dauvergne",
		description:
			"<p>Bleu d’Auvergne crémeux aux veines bleutées, pour accompagner vos plateaux.</p>",
		image: "sample-bleu.jpg",
	},
	{
		title: "Échantillon Tomme de Savoie",
		handle: "echantillon-tomme-de-savoie",
		description:
			"<p>Tomme de Savoie à croûte naturelle, goût doux et légèrement noiseté.</p>",
		image: "sample-tomme.jpg",
	},
	{
		title: "Échantillon Mimolette extra-vieille",
		handle: "echantillon-mimolette-extra-vieille",
		description:
			"<p>Mimolette extra-vieille, pâte orangée friable et arômes caramélisés.</p>",
		image: "sample-mimolette.jpg",
	},
	{
		title: "Échantillon Brie de Meaux",
		handle: "echantillon-brie-de-meaux",
		description:
			"<p>Brie de Meaux à croûte fleurie, cœur coulant et notes de crème.</p>",
		image: "sample-brie.jpg",
	},
	{
		title: "Échantillon Ossau-Iraty",
		handle: "echantillon-ossau-iraty",
		description:
			"<p>Ossau-Iraty au lait de brebis, texture ferme et douceur lactique.</p>",
		image: "sample-ossau.jpg",
	},
];

function loadToken() {
	const path = join(
		homedir(),
		".config/shopify-cli-store-nodejs/config.json",
	);
	const config = JSON.parse(readFileSync(path, "utf8"));
	const key = Object.keys(config).find((k) => k.includes(STORE));
	if (!key) throw new Error(`No store session for ${STORE}`);
	const userId = config[key].currentUserId;
	const token = config[key].sessionsByUserId?.[userId]?.accessToken;
	if (!token) throw new Error("Missing access token");
	return token;
}

async function gql(token, query, variables) {
	const response = await fetch(
		`https://${STORE}/admin/api/${API_VERSION}/graphql.json`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Shopify-Access-Token": token,
			},
			body: JSON.stringify({ query, variables }),
		},
	);
	const json = await response.json();
	if (json.errors?.length) {
		throw new Error(JSON.stringify(json.errors, null, 2));
	}
	return json.data;
}

async function stagedUpload(token, filePath) {
	const filename = basename(filePath);
	const size = statSync(filePath).size;
	const mimeType = "image/jpeg";
	const data = await gql(
		token,
		`mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }`,
		{
			input: [
				{
					filename,
					mimeType,
					resource: "PRODUCT_IMAGE",
					fileSize: String(size),
					httpMethod: "POST",
				},
			],
		},
	);
	const errors = data.stagedUploadsCreate.userErrors;
	if (errors?.length) throw new Error(JSON.stringify(errors));
	const target = data.stagedUploadsCreate.stagedTargets[0];
	const form = new FormData();
	for (const param of target.parameters) {
		form.append(param.name, param.value);
	}
	const bytes = readFileSync(filePath);
	form.append(
		"file",
		new File([bytes], filename, { type: mimeType }),
	);
	const upload = await fetch(target.url, { method: "POST", body: form });
	if (!upload.ok) {
		throw new Error(`Upload failed ${upload.status}: ${await upload.text()}`);
	}
	return target.resourceUrl;
}

async function ensureCollection(token) {
	const existing = await gql(
		token,
		`query {
      collections(first: 5, query: "handle:echantillons-offerts") {
        nodes { id handle title }
      }
    }`,
	);
	if (existing.collections.nodes[0]) {
		return existing.collections.nodes[0];
	}
	const created = await gql(
		token,
		`mutation collectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection { id handle title }
        userErrors { field message }
      }
    }`,
		{
			input: {
				title: "Échantillons offerts",
				handle: "echantillons-offerts",
				descriptionHtml:
					"<p>Échantillons fromagers offerts dans le panier au-delà du seuil configuré.</p>",
				seo: {
					title: "Échantillons offerts",
					description: "Collection d’échantillons panier — non listée au menu.",
				},
			},
		},
	);
	if (created.collectionCreate.userErrors?.length) {
		throw new Error(JSON.stringify(created.collectionCreate.userErrors));
	}
	return created.collectionCreate.collection;
}

async function createOrFindProduct(token, sample, resourceUrl) {
	const found = await gql(
		token,
		`query ($q: String!) {
      products(first: 1, query: $q) {
        nodes {
          id
          handle
          title
          variants(first: 1) { nodes { id } }
        }
      }
    }`,
		{ q: `handle:${sample.handle}` },
	);
	if (found.products.nodes[0]) {
		return found.products.nodes[0];
	}

	const created = await gql(
		token,
		`mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
      productCreate(product: $product, media: $media) {
        product {
          id
          handle
          title
          variants(first: 1) { nodes { id } }
        }
        userErrors { field message }
      }
    }`,
		{
			product: {
				title: sample.title,
				handle: sample.handle,
				descriptionHtml: sample.description,
				vendor: "Maison Affinage",
				productType: "Échantillon",
				tags: ["free-sample"],
				status: "ACTIVE",
				seo: {
					title: sample.title,
					description: "Échantillon offert — non destiné à la vente seule.",
				},
				metafields: [
					{
						namespace: "seo",
						key: "hidden",
						type: "number_integer",
						value: "1",
					},
				],
			},
			media: [
				{
					originalSource: resourceUrl,
					mediaContentType: "IMAGE",
					alt: sample.title,
				},
			],
		},
	);
	if (created.productCreate.userErrors?.length) {
		throw new Error(JSON.stringify(created.productCreate.userErrors));
	}
	const product = created.productCreate.product;
	const variantId = product.variants.nodes[0].id;
	const priced = await gql(
		token,
		`mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id price }
        userErrors { field message }
      }
    }`,
		{
			productId: product.id,
			variants: [{ id: variantId, price: "0.00" }],
		},
	);
	if (priced.productVariantsBulkUpdate.userErrors?.length) {
		throw new Error(
			JSON.stringify(priced.productVariantsBulkUpdate.userErrors),
		);
	}
	return product;
}

async function addToCollection(token, collectionId, productIds) {
	const result = await gql(
		token,
		`mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) {
        collection { id productsCount { count } }
        userErrors { field message }
      }
    }`,
		{ id: collectionId, productIds },
	);
	if (result.collectionAddProducts.userErrors?.length) {
		throw new Error(JSON.stringify(result.collectionAddProducts.userErrors));
	}
	return result.collectionAddProducts.collection;
}

async function onlineStorePublicationId(token) {
	const data = await gql(
		token,
		`query { publications(first: 20) { nodes { id name } } }`,
	);
	const pub = data.publications.nodes.find((n) => n.name === "Online Store");
	if (!pub) throw new Error("Online Store publication not found");
	return pub.id;
}

async function publishToOnlineStore(token, resourceId, publicationId) {
	const result = await gql(
		token,
		`mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }`,
		{ id: resourceId, input: [{ publicationId }] },
	);
	if (result.publishablePublish.userErrors?.length) {
		throw new Error(JSON.stringify(result.publishablePublish.userErrors));
	}
}

async function main() {
	const token = loadToken();
	const publicationId = await onlineStorePublicationId(token);
	const collection = await ensureCollection(token);
	console.log("Collection:", collection.handle, collection.id);

	const productIds = [];
	for (const sample of SAMPLES) {
		const imagePath = join(IMAGE_DIR, sample.image);
		console.log("Uploading", sample.image);
		const resourceUrl = await stagedUpload(token, imagePath);
		const product = await createOrFindProduct(token, sample, resourceUrl);
		console.log("Product:", product.handle, product.id);
		productIds.push(product.id);
		await publishToOnlineStore(token, product.id, publicationId);
	}

	const updated = await addToCollection(token, collection.id, productIds);
	await publishToOnlineStore(token, collection.id, publicationId);
	console.log(
		"Collection products:",
		updated.productsCount?.count ?? productIds.length,
	);
	console.log("Done. Handle:", collection.handle);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
