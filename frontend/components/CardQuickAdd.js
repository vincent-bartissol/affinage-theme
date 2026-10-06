class CardQuickAdd extends HTMLElement {
	connectedCallback() {
		this.variantInput = this.querySelector("input.product-variant-id");
		this.submitButton = this.querySelector('[type="submit"]');
		this.submitButtonText = this.submitButton?.querySelector("span");
		this.soldOutMessage = this.submitButton?.querySelector(".sold-out-message");
		this.variantsScript = this.querySelector("[data-card-variants]");
		this.optionGroups = [...this.querySelectorAll("[data-option-index]")];

		if (!this.variantsScript || !this.variantInput || !this.submitButton)
			return;

		try {
			this.variants = JSON.parse(this.variantsScript.textContent || "[]");
		} catch {
			this.variants = [];
		}

		this.addEventListener("change", this.onOptionChange);
		this.updateVariant();
	}

	disconnectedCallback() {
		this.removeEventListener("change", this.onOptionChange);
	}

	onOptionChange = () => {
		this.updateVariant();
	};

	getSelectedOptions() {
		return this.optionGroups.map((group) => {
			const checked = group.querySelector('input[type="radio"]:checked');
			return checked ? checked.value : null;
		});
	}

	findVariant(selectedOptions) {
		if (selectedOptions.some((value) => value == null)) return null;

		return (
			this.variants.find((variant) =>
				variant.options.every(
					(option, index) => option === selectedOptions[index],
				),
			) || null
		);
	}

	updateVariant() {
		const variant = this.findVariant(this.getSelectedOptions());

		if (!variant) {
			this.variantInput.value = "";
			this.variantInput.disabled = true;
			this.setSubmitState({ available: false, labelSoldOut: true });
			return;
		}

		this.variantInput.value = String(variant.id);
		this.variantInput.disabled = !variant.available;
		this.setSubmitState({
			available: variant.available,
			labelSoldOut: !variant.available,
		});
	}

	setSubmitState({ available, labelSoldOut }) {
		if (!this.submitButton || !this.submitButtonText || !this.soldOutMessage)
			return;

		this.submitButton.disabled = !available;
		this.submitButton.setAttribute(
			"aria-disabled",
			available ? "false" : "true",
		);

		if (labelSoldOut) {
			this.submitButtonText.classList.add("hidden");
			this.soldOutMessage.classList.remove("hidden");
		} else {
			this.submitButtonText.classList.remove("hidden");
			this.soldOutMessage.classList.add("hidden");
		}
	}
}

if (!customElements.get("card-quick-add")) {
	customElements.define("card-quick-add", CardQuickAdd);
}

export default CardQuickAdd;
