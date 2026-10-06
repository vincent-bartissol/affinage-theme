const CART_UPDATE_EVENT = "cart-update";

class AnnouncementFreeShipping extends HTMLElement {
	connectedCallback() {
		this.messageEl = this.querySelector("[data-free-shipping-message]");
		this.sectionId = this.dataset.sectionId;

		if (typeof window.subscribe === "function") {
			this.unsubscribe = window.subscribe(CART_UPDATE_EVENT, () =>
				this.refresh(),
			);
		}
	}

	disconnectedCallback() {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	async refresh() {
		if (!this.sectionId || !this.messageEl) return;

		try {
			const url = new URL(window.location.href);
			url.searchParams.set("section_id", this.sectionId);

			const response = await fetch(url.toString());
			if (!response.ok) return;

			const html = await response.text();
			const doc = new DOMParser().parseFromString(html, "text/html");
			const nextMessage = doc.querySelector("[data-free-shipping-message]");

			if (nextMessage) {
				this.messageEl.textContent = nextMessage.textContent;
			}
		} catch (error) {
			console.error("Failed to refresh free-shipping announcement", error);
		}
	}
}

customElements.define("announcement-free-shipping", AnnouncementFreeShipping);
