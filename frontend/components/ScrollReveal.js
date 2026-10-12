import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function motionOff() {
	return (
		window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
		window.Shopify?.designMode
	);
}

function reveal(targets, trigger) {
	const elements = [...targets];
	if (!elements.length || !trigger) return;

	gsap.from(elements, {
		y: 28,
		autoAlpha: 0,
		duration: 0.85,
		stagger: 0.12,
		ease: "power2.out",
		scrollTrigger: {
			trigger,
			start: "top 82%",
			once: true,
		},
	});
}

export function initScrollReveal(root = document) {
	if (motionOff()) return;

	root
		.querySelectorAll(".banner:has(.hero-background-slider)")
		.forEach((banner) => {
			if (banner.dataset.motionReady === "true") return;
			banner.dataset.motionReady = "true";
			reveal(banner.querySelectorAll(".banner__box > *"), banner);
		});

	root.querySelectorAll(".slider-products-section").forEach((section) => {
		if (section.querySelector(":scope > .slider-products__heading") == null)
			return;
		if (section.dataset.motionReady === "true") return;
		section.dataset.motionReady = "true";
		reveal(
			section.querySelectorAll(
				":scope > .slider-products__heading, :scope > .slider-products__description",
			),
			section,
		);
	});
}

document.addEventListener("shopify:section:load", (event) => {
	initScrollReveal(event.target);
});

window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
