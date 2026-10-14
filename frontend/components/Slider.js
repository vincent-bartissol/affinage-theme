import Swiper from "swiper";
import {
	Navigation,
	Pagination,
	Scrollbar,
	Autoplay,
	EffectFade,
} from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/scrollbar";
import "swiper/css/autoplay";
import "swiper/css/effect-fade";

function initSwiper(element, defaultParameters = {}) {
	const pagination = element.dataset.pagination === "true";
	const navigation = element.dataset.navigation === "true";
	const scrollbar = element.dataset.scrollbar === "true";
	const modules = [];

	let dataParams = {};
	try {
		dataParams = JSON.parse(element.getAttribute("data-params") || "{}");
	} catch {
		dataParams = {};
	}

	const parameters = {
		...defaultParameters,
		...dataParams,
		modules,
	};

	if (parameters.effect === "fade") {
		modules.push(EffectFade);
	}

	if (pagination) {
		parameters.pagination = {
			el: element.querySelector(".swiper-pagination"),
			clickable: true,
		};
		modules.push(Pagination);
	} else {
		parameters.pagination = false;
	}

	if (navigation) {
		parameters.navigation = {
			nextEl: element.querySelector(".swiper-button-next"),
			prevEl: element.querySelector(".swiper-button-prev"),
		};
		modules.push(Navigation);
	} else {
		parameters.navigation = false;
	}

	if (scrollbar) {
		parameters.scrollbar = {
			el: element.querySelector(".swiper-scrollbar"),
			draggable: true,
		};
		modules.push(Scrollbar);
	} else {
		parameters.scrollbar = false;
	}

	if (parameters.autoplay) {
		modules.push(Autoplay);
	}

	return new Swiper(element, parameters);
}

class Slider extends HTMLElement {
	constructor() {
		super();
		this.swiper = null;
	}

	connectedCallback() {
		this.swiper = initSwiper(this, {
			direction: "horizontal",
			slidesPerView: 1.2,
			spaceBetween: 16,
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
		});
	}

	disconnectedCallback() {
		if (this.swiper) {
			this.swiper.destroy(true, true);
			this.swiper = null;
		}
	}
}

class HeroBackgroundSlider extends HTMLElement {
	constructor() {
		super();
		this.swiper = null;
	}

	connectedCallback() {
		this.swiper = initSwiper(this, {
			direction: "horizontal",
			slidesPerView: 1,
			spaceBetween: 0,
			effect: "fade",
			fadeEffect: { crossFade: true },
			loop: true,
			speed: 900,
			autoplay: {
				delay: 5000,
				disableOnInteraction: false,
			},
		});
	}

	disconnectedCallback() {
		if (this.swiper) {
			this.swiper.destroy(true, true);
			this.swiper = null;
		}
	}
}

class CartPairingSlider extends HTMLElement {
	constructor() {
		super();
		this.swiper = null;
		this.lastWidth = 0;
	}

	connectedCallback() {
		this.wrapper = this.querySelector(".swiper-wrapper");
		this.onResize = () => this.mountIfVisible();
		this.resizeObserver = new ResizeObserver(this.onResize);
		this.resizeObserver.observe(this);

		if (this.wrapper) {
			this.slidesObserver = new MutationObserver(() =>
				this.scheduleSlidesUpdate(),
			);
			this.slidesObserver.observe(this.wrapper, { childList: true });
		}

		this.mountIfVisible();
	}

	disconnectedCallback() {
		this.resizeObserver?.disconnect();
		this.slidesObserver?.disconnect();
		if (this.frame) cancelAnimationFrame(this.frame);
		this.destroySwiper();
	}

	mountIfVisible() {
		const width = this.clientWidth;
		if (width === 0) return;

		if (!this.swiper) {
			this.swiper = initSwiper(this, {
				direction: "horizontal",
				slidesPerView: 1.15,
				spaceBetween: 12,
				watchOverflow: true,
			});
			this.lastWidth = width;
			return;
		}

		if (this.lastWidth !== width) {
			this.lastWidth = width;
			this.swiper.update();
		}
	}

	scheduleSlidesUpdate() {
		if (this.frame) cancelAnimationFrame(this.frame);
		this.frame = requestAnimationFrame(() => {
			this.frame = 0;
			if (!this.swiper) {
				this.mountIfVisible();
				return;
			}
			this.swiper.update();
		});
	}

	destroySwiper() {
		if (!this.swiper) return;
		this.swiper.destroy(true, true);
		this.swiper = null;
		this.lastWidth = 0;
	}
}

customElements.define("slider-products", Slider);
customElements.define("hero-background-slider", HeroBackgroundSlider);
customElements.define("cart-pairing-slider", CartPairingSlider);
