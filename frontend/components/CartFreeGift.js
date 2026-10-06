const CART_UPDATE_EVENT = "cart-update";
const SOURCE = "cart-free-gift";

class CartFreeGift extends HTMLElement {
	connectedCallback() {
		this.variantId = Number(this.dataset.variantId);
		this.threshold = Number(this.dataset.threshold);
		this.enabled = this.dataset.enabled === "true";
		this.busy = false;
		this.pendingSync = false;

		if (!this.enabled || !this.variantId || !this.threshold) return;

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
		const button = event.target.closest("[data-free-gift-add]");
		if (!button) return;
		event.preventDefault();
		this.addAgain();
	}

	async onCartUpdate(event) {
		if (event?.source === SOURCE) return;
		await this.sync();
	}

	async fetchCart() {
		const response = await fetch(`${window.routes.cart_url}.js`);
		if (!response.ok) throw new Error("Failed to fetch cart");
		return response.json();
	}

	getGiftLines(cart) {
		return (cart.items || []).filter(
			(item) => Number(item.variant_id) === this.variantId,
		);
	}

	getGiftQuantity(cart) {
		return this.getGiftLines(cart).reduce(
			(sum, item) => sum + Number(item.quantity || 0),
			0,
		);
	}

	getEligibleTotal(cart) {
		return (cart.items || []).reduce((sum, item) => {
			if (Number(item.variant_id) === this.variantId) return sum;
			return sum + Number(item.final_line_price || 0);
		}, 0);
	}

	isDeclined(cart) {
		return cart.attributes?.free_gift_declined === "true";
	}

	async sync() {
		if (!this.enabled) return;

		if (this.busy) {
			this.pendingSync = true;
			return;
		}

		try {
			this.busy = true;
			// Always read a fresh cart so a stale cartUpdate payload cannot trigger a second add.
			const cart = await this.fetchCart();
			const giftQty = this.getGiftQuantity(cart);
			const eligible = this.getEligibleTotal(cart) >= this.threshold;
			const declined = this.isDeclined(cart);

			if (!eligible) {
				if (giftQty > 0) {
					await this.setGiftQuantity(0, { clearDeclined: true });
				}
				return;
			}

			if (declined) {
				if (giftQty > 0) {
					await this.setGiftQuantity(0);
				}
				return;
			}

			if (giftQty === 0) {
				await this.addGift();
			} else if (giftQty > 1) {
				await this.setGiftQuantity(1);
			} else {
				this.hideAddAgainButtons();
			}
		} catch (error) {
			console.error("Free gift sync failed", error);
		} finally {
			this.busy = false;
			if (this.pendingSync) {
				this.pendingSync = false;
				await this.sync();
			}
		}
	}

	async addAgain() {
		if (!this.enabled) return;

		try {
			this.hideAddAgainButtons();
			await this.updateAttributes({ free_gift_declined: "" });
			await this.sync();
		} catch (error) {
			console.error("Failed to add free gift again", error);
		}
	}

	hideAddAgainButtons() {
		document
			.querySelectorAll(".cart-free-gift")
			.forEach((element) => element.remove());
	}

	async addGift() {
		const response = await fetch(window.routes.cart_add_url, {
			...fetchConfig("javascript"),
			body: JSON.stringify({
				items: [
					{
						id: this.variantId,
						quantity: 1,
						properties: { _gift: "true" },
					},
				],
			}),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			throw new Error(error.description || "Failed to add free gift");
		}

		await this.publishCart();
	}

	async setGiftQuantity(quantity, { clearDeclined = false } = {}) {
		const payload = {
			updates: {
				[this.variantId]: quantity,
			},
		};

		if (clearDeclined) {
			payload.attributes = { free_gift_declined: "" };
		}

		const response = await fetch(window.routes.cart_update_url, {
			...fetchConfig(),
			body: JSON.stringify(payload),
		});

		if (!response.ok) throw new Error("Failed to update free gift quantity");

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
	}
}

customElements.define("cart-free-gift", CartFreeGift);
