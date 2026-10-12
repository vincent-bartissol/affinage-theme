import autoAnimate from "@formkit/auto-animate";

const boundLists = new WeakSet();
let applying = false;

function motionOff() {
	return (
		window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
		window.Shopify?.designMode
	);
}

function bind(list) {
	if (!list || boundLists.has(list) || motionOff()) return;
	boundLists.add(list);
	autoAnimate(list, { duration: 220, easing: "ease-out" });
}

export function bindCartLists(root = document) {
	root.querySelectorAll("[data-cart-list]").forEach(bind);
}

function rowKey(row) {
	return row.getAttribute("data-cart-line");
}

function copyAttributes(from, to) {
	[...to.attributes].forEach((attr) => {
		if (!from.hasAttribute(attr.name)) to.removeAttribute(attr.name);
	});
	[...from.attributes].forEach((attr) => {
		to.setAttribute(attr.name, attr.value);
	});
}

function syncKeyedChildren(liveParent, nextParent) {
	bind(liveParent);

	const nextChildren = [...nextParent.children];
	const liveChildren = [...liveParent.children];
	const liveByKey = new Map();

	liveChildren.forEach((child) => {
		const key = rowKey(child);
		if (key) liveByKey.set(key, child);
	});

	const nextKeys = new Set(nextChildren.map(rowKey).filter(Boolean));

	liveChildren.forEach((child) => {
		const key = rowKey(child);
		if (!key || !nextKeys.has(key)) child.remove();
	});

	nextChildren.forEach((nextChild, index) => {
		const key = rowKey(nextChild);
		const existing = key ? liveByKey.get(key) : null;
		const anchor = liveParent.children[index] || null;

		if (existing && existing.isConnected) {
			copyAttributes(nextChild, existing);
			if (existing.innerHTML !== nextChild.innerHTML) {
				existing.innerHTML = nextChild.innerHTML;
			}
			if (anchor !== existing) liveParent.insertBefore(existing, anchor);
			return;
		}

		liveParent.insertBefore(nextChild, anchor);
	});
}

export function setCartSectionHTML(element, html) {
	if (!element) return;

	const template = document.createElement("template");
	template.innerHTML = html;

	const liveLists = [...element.querySelectorAll("[data-cart-list]")];
	let preserved = false;

	applying = true;
	try {
		liveLists.forEach((live) => {
			const key = live.getAttribute("data-cart-list");
			if (!key) return;
			const next = template.content.querySelector(
				`[data-cart-list="${CSS.escape(key)}"]`,
			);
			if (!next) return;

			if (motionOff()) {
				live.innerHTML = next.innerHTML;
			} else {
				syncKeyedChildren(live, next);
			}

			next.replaceWith(live);
			preserved = true;
		});

		if (!preserved) {
			element.innerHTML = html;
			bindCartLists(element);
			return;
		}

		element.replaceChildren(...template.content.childNodes);
		bindCartLists(element);
	} finally {
		applying = false;
	}
}

export function installCartListMotion() {
	window.maisonSetCartSectionHTML = setCartSectionHTML;
	bindCartLists();

	const observer = new MutationObserver(() => {
		if (applying) return;
		bindCartLists();
	});

	document.querySelectorAll("cart-drawer, #main-cart-items").forEach((node) => {
		observer.observe(node, { childList: true, subtree: true });
	});

	document.addEventListener("shopify:section:load", (event) => {
		bindCartLists(event.target);
	});
}
