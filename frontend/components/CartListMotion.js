const DURATION = 240;

function motionOff() {
	return (
		window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
		window.Shopify?.designMode
	);
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

function px(value) {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function isTableRow(row) {
	return getComputedStyle(row).display === "table-row";
}

function fadeIn(row) {
	if (!row.isConnected || motionOff()) return;
	row.style.opacity = "0";
	requestAnimationFrame(() => {
		if (!row.isConnected) return;
		row.style.transition = `opacity ${DURATION}ms ease-out`;
		row.style.opacity = "1";
		row.addEventListener(
			"transitionend",
			() => {
				row.style.transition = "";
				row.style.opacity = "";
			},
			{ once: true },
		);
	});
}

// Table rows ignore absolute positioning, which is how a generic list
// animator exits. Shrink the cells instead so the line closes in place.
function collapseTableRow(row) {
	const cells = [...row.children];
	cells.forEach((cell) => {
		const styles = getComputedStyle(cell);
		const contentHeight = Math.max(
			0,
			cell.getBoundingClientRect().height -
				px(styles.paddingTop) -
				px(styles.paddingBottom) -
				px(styles.borderTopWidth) -
				px(styles.borderBottomWidth),
		);
		const wrap = document.createElement("div");
		wrap.style.overflow = "hidden";
		wrap.style.height = `${contentHeight}px`;
		while (cell.firstChild) wrap.appendChild(cell.firstChild);
		cell.appendChild(wrap);
		cell.style.overflow = "hidden";
		cell.style.boxSizing = "border-box";
	});

	row.getBoundingClientRect();
	row.style.transition = `opacity ${DURATION}ms ease-out`;
	row.style.opacity = "0";
	cells.forEach((cell) => {
		const wrap = cell.firstElementChild;
		if (wrap) {
			wrap.style.transition = `height ${DURATION}ms ease-out`;
			wrap.style.height = "0px";
		}
		cell.style.transition = `padding-top ${DURATION}ms ease-out, padding-bottom ${DURATION}ms ease-out`;
		cell.style.paddingTop = "0px";
		cell.style.paddingBottom = "0px";
	});
}

function collapseBlockRow(row) {
	const styles = getComputedStyle(row);
	const height = row.getBoundingClientRect().height;
	row.style.overflow = "hidden";
	row.style.minHeight = "0px";
	row.style.boxSizing = "border-box";
	row.style.height = `${height}px`;
	row.style.marginBottom = styles.marginBottom;
	[...row.children].forEach((cell) => {
		cell.style.overflow = "hidden";
		cell.style.minHeight = "0px";
	});

	row.getBoundingClientRect();
	row.style.transition = `height ${DURATION}ms ease-out, margin-bottom ${DURATION}ms ease-out, opacity ${DURATION}ms ease-out`;
	row.style.height = "0px";
	row.style.marginBottom = "0px";
	row.style.opacity = "0";
}

function collapseRow(row) {
	if (!row.isConnected || row.dataset.cartLeaving === "true") return;
	row.dataset.cartLeaving = "true";
	row.style.pointerEvents = "none";

	if (motionOff()) {
		row.remove();
		return;
	}

	if (isTableRow(row)) collapseTableRow(row);
	else collapseBlockRow(row);

	window.setTimeout(() => {
		row.remove();
	}, DURATION);
}

function syncKeyedChildren(liveParent, nextParent) {
	const nextChildren = [...nextParent.children];
	const liveChildren = [...liveParent.children];
	const liveByKey = new Map();
	const entered = [];

	liveChildren.forEach((child) => {
		const key = rowKey(child);
		if (key) liveByKey.set(key, child);
	});

	const nextKeys = new Set(nextChildren.map(rowKey).filter(Boolean));
	const leaving = liveChildren.filter((child) => {
		const key = rowKey(child);
		return !key || !nextKeys.has(key);
	});
	const leavingSet = new Set(leaving);
	leaving.forEach((row) => {
		row.removeAttribute("id");
	});

	const stableChild = (index) => {
		const stable = [...liveParent.children].filter(
			(child) => !leavingSet.has(child),
		);
		return stable[index] || null;
	};

	nextChildren.forEach((nextChild, index) => {
		const key = rowKey(nextChild);
		const existing = key ? liveByKey.get(key) : null;
		const anchor = stableChild(index);

		if (existing && existing.isConnected && !leavingSet.has(existing)) {
			copyAttributes(nextChild, existing);
			if (existing.innerHTML !== nextChild.innerHTML) {
				existing.innerHTML = nextChild.innerHTML;
			}
			if (anchor !== existing) liveParent.insertBefore(existing, anchor);
			return;
		}

		liveParent.insertBefore(nextChild, anchor);
		entered.push(nextChild);
	});

	return { leaving, entered };
}

export function setCartSectionHTML(element, html) {
	if (!element) return;

	const template = document.createElement("template");
	template.innerHTML = html;

	const liveLists = [...element.querySelectorAll("[data-cart-list]")];
	const motions = [];
	let preserved = false;

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
			motions.push(syncKeyedChildren(live, next));
		}

		next.replaceWith(live);
		preserved = true;
	});

	if (!preserved) {
		element.innerHTML = html;
		return;
	}

	element.replaceChildren(...template.content.childNodes);
	requestAnimationFrame(() => {
		motions.forEach(({ leaving, entered }) => {
			leaving.forEach(collapseRow);
			entered.forEach(fadeIn);
		});
	});
}

export function installCartListMotion() {
	window.maisonSetCartSectionHTML = setCartSectionHTML;
}
