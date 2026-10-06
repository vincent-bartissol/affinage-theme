import Swiper from "swiper";
import { Navigation, Pagination, Scrollbar, Autoplay } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/scrollbar";
import "swiper/css/autoplay";

class Slider extends HTMLElement {
	constructor() {
		super();
		this.swiper = null;
		this.defaultParameters = {
			direction: "horizontal",
			slidesPerView: 1.2,
			spaceBetween: 16,
			modules: [],
			breakpoints: {
				750: {
					slidesPerView: 2.2,
					spaceBetween: 24,
				},
				990: {
					slidesPerView: 3.2,
					spaceBetween: 28,
				},
			},
		};
		this.parameters = {};
	}

	connectedCallback() {
		const pagination = this.dataset.pagination === "true";
		const navigation = this.dataset.navigation === "true";
		const scrollbar = this.dataset.scrollbar === "true";
		const modules = [];

		let dataParams = {};
		try {
			dataParams = JSON.parse(this.getAttribute("data-params") || "{}");
		} catch {
			dataParams = {};
		}

		this.parameters = {
			...this.defaultParameters,
			...dataParams,
			modules,
		};

		if (pagination) {
			this.parameters.pagination = {
				el: this.querySelector(".swiper-pagination"),
				clickable: true,
			};
			modules.push(Pagination);
		} else {
			this.parameters.pagination = false;
		}

		if (navigation) {
			this.parameters.navigation = {
				nextEl: this.querySelector(".swiper-button-next"),
				prevEl: this.querySelector(".swiper-button-prev"),
			};
			modules.push(Navigation);
		} else {
			this.parameters.navigation = false;
		}

		if (scrollbar) {
			this.parameters.scrollbar = {
				el: this.querySelector(".swiper-scrollbar"),
				draggable: true,
			};
			modules.push(Scrollbar);
		} else {
			this.parameters.scrollbar = false;
		}

		if (this.parameters.autoplay) {
			modules.push(Autoplay);
		}

		this.swiper = new Swiper(this, this.parameters);
	}

	disconnectedCallback() {
		if (this.swiper) {
			this.swiper.destroy(true, true);
			this.swiper = null;
		}
	}
}

customElements.define("slider-products", Slider);
