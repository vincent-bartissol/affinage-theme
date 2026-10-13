// Components
import "@/components/Slider";
import "@/components/AnnouncementFreeShipping";
import "@/components/CardQuickAdd";
import "@/components/CartFreeGift";
import "@/components/CartFreeSample";
import { initScrollReveal } from "@/components/ScrollReveal";
import { installCartListMotion } from "@/components/CartListMotion";

export default function initTheme() {
	installCartListMotion();
	initScrollReveal();
}

initTheme();
