const CART_UPDATE_EVENT = "cart-update";

class AnnouncementBarLive extends HTMLElement {
	connectedCallback() {
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
		if (!this.sectionId) return;

		try {
			const url = new URL(window.location.href);
			url.searchParams.set("section_id", this.sectionId);

			const response = await fetch(url.toString());
			if (!response.ok) return;

			const html = await response.text();
			const doc = new DOMParser().parseFromString(html, "text/html");
			const next = doc.querySelector("announcement-bar-live");

			if (next) {
				this.innerHTML = next.innerHTML;
			}
		} catch (error) {
			console.error("Failed to refresh announcement bar", error);
		}
	}
}

customElements.define("announcement-bar-live", AnnouncementBarLive);
