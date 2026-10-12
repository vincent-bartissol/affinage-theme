import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const DAWN_MOTION_CLASSES = [
	"scroll-trigger",
	"animate--slide-in",
	"animate--fade-in",
	"scroll-trigger--offscreen",
	"scroll-trigger--cancel",
];

const GROUPS = [
	{
		section: ".banner:has(.hero-background-slider)",
		items: ".banner__box > *",
	},
	{
		section: ".slider-products-section",
		items:
			":scope > .slider-products__heading, :scope > .slider-products__description",
		needs: ":scope > .slider-products__heading",
	},
	{
		section: ".product__media-wrapper",
		self: true,
	},
	{
		section: ".product__info-container",
		items: ":scope > *",
	},
	{
		section: "product-recommendations.product-recommendations--loaded",
		items: ".slider-products__heading",
	},
	{
		section: ".collection-hero__inner",
		self: true,
	},
	{
		section: "#ProductGridContainer",
		items: "#product-grid .grid__item",
		limit: 8,
	},
	{
		section: ".collection-list",
		items: ".collection-list__item",
		limit: 8,
	},
	{
		section: ".template-search__header",
		items: ":scope > *",
	},
	{
		section: ".main-blog",
		items: ".title--primary, .blog-articles__article",
		limit: 8,
	},
	{
		section: ".article-template",
		items:
			".article-template__hero-container, .article-template > header, .article-template__content, .article-template__social-sharing, .article-template__back",
	},
	{
		section: ".page-width:has(> .main-page-title)",
		items: ":scope > .main-page-title, :scope > .rte",
	},
	{
		section: ".contact",
		items: ":scope > .title, :scope > form",
	},
	{
		section: ".template-404",
		items: ":scope > *",
	},
	{
		section: ".customer",
		items: ":scope > *",
	},
];

function motionOff() {
	return (
		window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
		window.Shopify?.designMode
	);
}

function stripDawn(element) {
	let node = element;
	while (node && node !== document.body) {
		node.classList.remove(...DAWN_MOTION_CLASSES);
		node.style.removeProperty("--animation-order");
		node = node.parentElement;
	}
}

function collect(section, group) {
	if (group.needs && section.querySelector(group.needs) == null) return [];
	const items = group.self
		? [section]
		: [...section.querySelectorAll(group.items)];
	const visible = items.filter(
		(element) =>
			element.dataset.motionReady !== "true" &&
			getComputedStyle(element).display !== "none",
	);
	return visible.slice(0, group.limit || visible.length);
}

function reveal(elements, trigger) {
	if (!elements.length || !trigger) return;

	elements.forEach((element) => {
		element.dataset.motionReady = "true";
		stripDawn(element);
	});

	gsap.from(elements, {
		y: 28,
		autoAlpha: 0,
		duration: 0.8,
		stagger: 0.08,
		ease: "power2.out",
		scrollTrigger: {
			trigger,
			start: "top 85%",
			once: true,
		},
	});
}

export function initScrollReveal(root = document) {
	if (motionOff()) return;

	GROUPS.forEach((group) => {
		const sections = [];
		if (root instanceof Element && root.matches(group.section))
			sections.push(root);
		root.querySelectorAll(group.section).forEach((section) => {
			sections.push(section);
		});
		sections.forEach((section) => {
			reveal(collect(section, group), section);
		});
	});
}

function watch(selector) {
	document.querySelectorAll(selector).forEach((node) => {
		if (node.dataset.motionWatch === "true") return;
		node.dataset.motionWatch = "true";
		const observer = new MutationObserver(() => initScrollReveal(node));
		observer.observe(node, { childList: true, subtree: true });
	});
}

document.addEventListener("shopify:section:load", (event) => {
	initScrollReveal(event.target);
	watch("product-recommendations");
	watch("#ProductGridContainer");
});

window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });

watch("product-recommendations");
watch("#ProductGridContainer");
