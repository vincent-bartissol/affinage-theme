const CART_UPDATE_EVENT = "cart-update";
const SOURCE = "cart-free-sample";
const ATTRIBUTE_KEY = "free_sample_variant_ids";

class CartFreeSample extends HTMLElement {
	connectedCallback() {
		this.threshold = Number(this.dataset.threshold);
		this.max = Math.max(1, Number(this.dataset.max) || 1);
		this.enabled = this.dataset.enabled === "true";
		this.variantIds = (this.dataset.variantIds || "")
			.split(",")
			.map((id) => Number(id.trim()))
			.filter(Boolean);
		this.variantIdSet = new Set(this.variantIds);
		this.giftVariantId = Number(this.dataset.giftVariantId) || 0;
		this.busy = false;
		this.pendingSync = false;

		if (!this.enabled || !this.threshold || this.variantIds.length === 0) {
			return;
		}

		this.onDocumentClick = this.onDocumentClick.bind(this);
		document.addEventListener("click", this.onDocumentClick);

		if (typeof window.subscribe === "function") {
			this.unsubscribe = window.subscribe(CART_UPDATE_EVENT, (event) =>
				this.onCartUpdate(event),
			);
		}

		this.sync();
	}

	disconnectedCallback() {
		document.removeEventListener("click", this.onDocumentClick);
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	onDocumentClick(event) {
		const addButton = event.target.closest("[data-free-sample-add]");
		if (addButton) {
			event.preventDefault();
			const variantId = Number(addButton.dataset.freeSampleAdd);
			if (variantId) this.addSample(variantId);
			return;
		}

		const removeButton = event.target.closest("[data-free-sample-remove]");
		if (removeButton) {
			event.preventDefault();
			const variantId = Number(removeButton.dataset.freeSampleRemove);
			if (variantId) this.removeSample(variantId);
		}
	}

	async onCartUpdate(event) {
		if (event?.source === SOURCE) return;

		const cart = event?.cartData;
		if (cart && this.shouldRemoveSamples(cart)) {
			this.hideSampleLines();
		}

		await this.sync(cart);
	}

	async fetchCart() {
		const response = await fetch(`${window.routes.cart_url}.js`);
		if (!response.ok) throw new Error("Failed to fetch cart");
		return response.json();
	}

	isSampleLine(item) {
		if (this.variantIdSet.has(Number(item.variant_id))) return true;
		return item.properties?._sample === "true";
	}

	isExcludedLine(item) {
		if (this.isSampleLine(item)) return true;
		if (this.giftVariantId && Number(item.variant_id) === this.giftVariantId) {
			return true;
		}
		return item.properties?._gift === "true";
	}

	getSampleLines(cart) {
		return (cart.items || []).filter((item) => this.isSampleLine(item));
	}

	getSampleVariantIds(cart) {
		const ids = [];
		for (const item of this.getSampleLines(cart)) {
			const id = Number(item.variant_id);
			if (!ids.includes(id)) ids.push(id);
		}
		return ids;
	}

	getEligibleTotal(cart) {
		return (cart.items || []).reduce((sum, item) => {
			if (this.isExcludedLine(item)) return sum;
			return sum + Number(item.final_line_price || 0);
		}, 0);
	}

	getSavedIds(cart) {
		const raw = cart.attributes?.[ATTRIBUTE_KEY];
		if (!raw) return [];
		return String(raw)
			.split(",")
			.map((id) => Number(id.trim()))
			.filter((id) => this.variantIdSet.has(id));
	}

	serializeIds(ids) {
		return ids.slice(0, this.max).join(",");
	}

	shouldRemoveSamples(cart) {
		if (this.getSampleLines(cart).length <= 0) return false;
		return this.getEligibleTotal(cart) < this.threshold;
	}

	hideSampleLines() {
		document.querySelectorAll(".cart-item--free-sample").forEach((element) => {
			element.hidden = true;
		});
	}

	idsEqual(a, b) {
		if (a.length !== b.length) return false;
		return a.every((id, index) => id === b[index]);
	}

	async sync(cartFromEvent) {
		if (!this.enabled) return;

		if (this.busy) {
			this.pendingSync = true;
			return;
		}

		try {
			this.busy = true;
			const cart = cartFromEvent || (await this.fetchCart());
			const eligible = this.getEligibleTotal(cart) >= this.threshold;
			const cartIds = this.getSampleVariantIds(cart);
			const savedIds = this.getSavedIds(cart);

			if (!eligible) {
				if (cartIds.length > 0) {
					this.hideSampleLines();
					await this.setSampleQuantities(cartIds, 0);
				}
				return;
			}

			// Eligible: restore saved picks when the cart has none (threshold crossed
			// again). Removals while eligible must clear the attribute first.
			if (cartIds.length === 0 && savedIds.length > 0) {
				await this.addSamples(savedIds.slice(0, this.max));
				return;
			}

			const nextIds = cartIds.slice(0, this.max);
			if (!this.idsEqual(nextIds, savedIds)) {
				await this.updateAttributes({
					[ATTRIBUTE_KEY]: this.serializeIds(nextIds),
				});
			}
			await this.enforceSampleQuantities(cart, nextIds);
			this.refreshPicker(nextIds);
		} catch (error) {
			console.error("Free sample sync failed", error);
		} finally {
			this.busy = false;
			if (this.pendingSync) {
				this.pendingSync = false;
				await this.sync();
			}
		}
	}

	refreshPicker(selectedIds) {
		const selected = new Set(selectedIds);
		const atMax = selectedIds.length >= this.max;

		document.querySelectorAll(".cart-free-sample").forEach((picker) => {
			picker.classList.toggle("is-at-max", atMax);
		});

		document.querySelectorAll(".cart-free-sample__option").forEach((option) => {
			const variantId = Number(option.dataset.variantId);
			const isSelected = selected.has(variantId);
			const isDisabled = !isSelected && atMax;
			option.classList.toggle("is-selected", isSelected);
			option.classList.toggle("is-disabled", isDisabled);
			option.hidden = false;
			option.setAttribute("aria-disabled", isDisabled ? "true" : "false");

			const addButton = option.querySelector("[data-free-sample-add]");
			const removeButton = option.querySelector("[data-free-sample-remove]");
			if (addButton) {
				addButton.hidden = isSelected;
				addButton.disabled = isDisabled;
			}
			if (removeButton) {
				removeButton.hidden = !isSelected;
			}
		});

		document.querySelectorAll("[data-free-sample-count]").forEach((element) => {
			element.textContent = String(selectedIds.length);
		});

		document
			.querySelectorAll("[data-free-sample-max-note]")
			.forEach((element) => {
				element.hidden = !atMax;
			});
	}

	async addSample(variantId) {
		if (!this.enabled || !this.variantIdSet.has(variantId)) return;

		try {
			const cart = await this.fetchCart();
			if (this.getEligibleTotal(cart) < this.threshold) return;

			const currentIds = this.getSampleVariantIds(cart);
			if (currentIds.includes(variantId) || currentIds.length >= this.max) {
				this.refreshPicker(currentIds);
				return;
			}

			const nextIds = [...currentIds, variantId].slice(0, this.max);
			await this.updateAttributes({
				[ATTRIBUTE_KEY]: this.serializeIds(nextIds),
			});
			await this.addSamples([variantId]);
		} catch (error) {
			console.error("Failed to add free sample", error);
		}
	}

	async removeSample(variantId) {
		if (!this.enabled || !this.variantIdSet.has(variantId)) return;

		try {
			const cart = await this.fetchCart();
			const nextIds = this.getSampleVariantIds(cart).filter(
				(id) => id !== variantId,
			);
			await this.updateAttributes({
				[ATTRIBUTE_KEY]: this.serializeIds(nextIds),
			});
			await this.setSampleQuantities([variantId], 0);
		} catch (error) {
			console.error("Failed to remove free sample", error);
		}
	}

	async addSamples(variantIds) {
		const items = variantIds.map((id) => ({
			id,
			quantity: 1,
			properties: { _sample: "true" },
		}));
		if (items.length === 0) return;

		const response = await fetch(window.routes.cart_add_url, {
			...fetchConfig("javascript"),
			body: JSON.stringify({ items }),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			throw new Error(error.description || "Failed to add free sample");
		}

		await this.publishCart();
	}

	async setSampleQuantities(variantIds, quantity) {
		if (variantIds.length === 0) return;

		const updates = {};
		for (const id of variantIds) {
			updates[id] = quantity;
		}

		const response = await fetch(window.routes.cart_update_url, {
			...fetchConfig(),
			body: JSON.stringify({ updates }),
		});

		if (!response.ok) throw new Error("Failed to update free sample quantity");
		await this.publishCart();
	}

	async enforceSampleQuantities(cart, keepIds) {
		const keep = new Set(keepIds);
		const updates = {};
		let needsUpdate = false;

		for (const item of this.getSampleLines(cart)) {
			const id = Number(item.variant_id);
			if (!keep.has(id)) {
				updates[id] = 0;
				needsUpdate = true;
			} else if (Number(item.quantity) !== 1) {
				updates[id] = 1;
				needsUpdate = true;
			}
		}

		if (!needsUpdate) return;

		const response = await fetch(window.routes.cart_update_url, {
			...fetchConfig(),
			body: JSON.stringify({ updates }),
		});
		if (!response.ok)
			throw new Error("Failed to enforce free sample quantities");
		await this.publishCart();
	}

	async updateAttributes(attributes) {
		const response = await fetch(window.routes.cart_update_url, {
			...fetchConfig(),
			body: JSON.stringify({ attributes }),
		});
		if (!response.ok) throw new Error("Failed to update cart attributes");
		return response.json();
	}

	async publishCart() {
		const cart = await this.fetchCart();
		if (typeof window.publish === "function") {
			await window.publish(CART_UPDATE_EVENT, {
				source: SOURCE,
				cartData: cart,
			});
		}
		this.refreshPicker(this.getSampleVariantIds(cart));
	}
}

customElements.define("cart-free-sample", CartFreeSample);
