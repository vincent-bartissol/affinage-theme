class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      this.onRemove(event);
    });
  }

  async onRemove(event) {
    const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');

    if (this.hasAttribute('data-free-gift')) {
      try {
        await fetch(`${routes.cart_update_url}`, {
          ...fetchConfig(),
          ...{
            body: JSON.stringify({
              attributes: { free_gift_declined: 'true' },
            }),
          },
        });
      } catch (error) {
        console.error(error);
      }
    }

    if (this.hasAttribute('data-free-sample')) {
      try {
        const variantId = Number(
          this.querySelector('[data-variant-id]')?.dataset.variantId ||
            this.closest('tr')?.querySelector('[data-quantity-variant-id]')?.dataset
              .quantityVariantId,
        );
        if (variantId) {
          const cartResponse = await fetch(`${routes.cart_url}.js`);
          const cart = await cartResponse.json();
          const current = String(cart.attributes?.free_sample_variant_ids || '')
            .split(',')
            .map((id) => Number(id.trim()))
            .filter(Boolean)
            .filter((id) => id !== variantId);
          await fetch(`${routes.cart_update_url}`, {
            ...fetchConfig(),
            body: JSON.stringify({
              attributes: { free_sample_variant_ids: current.join(',') },
            }),
          });
        }
      } catch (error) {
        console.error(error);
      }
    }

    cartItems.updateQuantity(this.dataset.index, 0, event);
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

// Shopify rejects a cart change that leaves free samples or a free gift in
// place once the paid total drops under their threshold. Drop those lines in
// the same update as the quantity change.
async function buildQuantityRequest(line, quantity, sections) {
  const changeRequest = {
    url: routes.cart_change_url,
    body: { line, quantity, sections, sections_url: window.location.pathname },
  };
  const sampleEl = document.querySelector('cart-free-sample');
  const giftEl = document.querySelector('cart-free-gift');
  const sampleEnabled = sampleEl?.dataset.enabled === 'true';
  const giftEnabled = giftEl?.dataset.enabled === 'true';
  const sampleThreshold = Number(sampleEl?.dataset.threshold) || 0;
  const giftThreshold = Number(giftEl?.dataset.threshold) || 0;
  if ((!sampleEnabled || !sampleThreshold) && (!giftEnabled || !giftThreshold)) return changeRequest;

  let cart;
  try {
    const response = await fetch(`${routes.cart_url}.js`);
    if (!response.ok) return changeRequest;
    cart = await response.json();
  } catch (error) {
    console.error(error);
    return changeRequest;
  }

  const lineItem = cart.items[Number(line) - 1];
  if (!lineItem) return changeRequest;

  const sampleIds = new Set(
    String(sampleEl?.dataset.variantIds || '')
      .split(',')
      .map((id) => Number(id.trim()))
      .filter(Boolean)
  );
  const giftVariantId = Number(giftEl?.dataset.variantId) || 0;
  const isSample = (item) =>
    item.properties?._sample === 'true' || sampleIds.has(Number(item.variant_id));
  const isGift = (item) =>
    item.properties?._gift === 'true' || (giftVariantId > 0 && Number(item.variant_id) === giftVariantId);

  const nextQuantity = Number(quantity);
  let eligible = 0;
  for (const item of cart.items) {
    if (isSample(item) || isGift(item)) continue;
    const qty = item.key === lineItem.key ? nextQuantity : Number(item.quantity);
    eligible += Number(item.final_price) * qty;
  }

  const updates = {};
  if (sampleEnabled && eligible < sampleThreshold) {
    for (const item of cart.items) {
      if (isSample(item)) updates[item.key] = 0;
    }
  }
  if (giftEnabled && eligible < giftThreshold) {
    for (const item of cart.items) {
      if (isGift(item)) updates[item.key] = 0;
    }
  }
  if (Object.keys(updates).length === 0) return changeRequest;

  updates[lineItem.key] = nextQuantity;
  return {
    url: routes.cart_update_url,
    body: { updates, sections, sections_url: window.location.pathname },
  };
}

const CART_PAIRING_TARGET = 4;
const CART_PAIRING_SKELETON_ITEM = `
	<li class="cart-pairing__item cart-pairing__item--skeleton" aria-hidden="true">
		<span class="cart-pairing__media"></span>
		<span class="cart-pairing__meta">
			<span class="cart-pairing__skeleton-name"></span>
			<span class="cart-pairing__skeleton-price"></span>
			<span class="cart-pairing__skeleton-cta"></span>
		</span>
	</li>
`;

function createCartPairingSkeleton(slotHeight) {
  const template = document.createElement('template');
  template.innerHTML = CART_PAIRING_SKELETON_ITEM.trim();
  const skeleton = template.content.firstElementChild;
  if (slotHeight > 0) {
    applyCartPairingSlotHeight(skeleton, slotHeight);
  }
  return skeleton;
}

function applyCartPairingSlotHeight(element, slotHeight) {
  if (!element || !(slotHeight > 0)) return;
  const rounded = Math.round(slotHeight);
  const height = `${rounded}px`;
  element.dataset.slotHeight = String(rounded);
  element.style.boxSizing = 'border-box';
  element.style.minHeight = height;
}

// Lock card height before the add-to-cart spinner can shrink the slot.
document.addEventListener(
  'submit',
  (event) => {
    const item = event.target?.closest?.('.cart-pairing__item');
    if (!item || item.classList.contains('cart-pairing__item--skeleton')) return;
    applyCartPairingSlotHeight(item, item.getBoundingClientRect().height);
  },
  true
);

/**
 * Keep four pairing slots while refill loads: swap in-cart cards for skeletons,
 * then re-fetch recommendations. `cartRoot` should reflect the updated cart lines.
 */
function syncCartPairingPanel(panel, cartRoot = document) {
  const recs = panel?.querySelector('product-recommendations');
  if (!recs?.classList.contains('product-recommendations--loaded')) return false;

  const inCartVariantIds = new Set(
    Array.from(cartRoot.querySelectorAll('[data-quantity-variant-id]'))
      .map((el) => el.getAttribute('data-quantity-variant-id'))
      .filter(Boolean)
  );

  let needsRefill = false;
  recs.querySelectorAll('.cart-pairing__item:not(.cart-pairing__item--skeleton)').forEach((item) => {
    const variantId = item.querySelector('[name="id"], .product-variant-id')?.value;
    if (variantId && inCartVariantIds.has(String(variantId))) {
      const height = item.getBoundingClientRect().height;
      // Prefer pre-loading height when available so the loading spinner does not shrink the slot.
      const locked =
        Number(item.dataset.slotHeight) ||
        height;
      item.replaceWith(createCartPairingSkeleton(locked));
      needsRefill = true;
    }
  });

  const list = recs.querySelector('.cart-pairing__list');
  if (list) {
    while (list.querySelectorAll('.cart-pairing__item').length < CART_PAIRING_TARGET) {
      list.appendChild(createCartPairingSkeleton());
      needsRefill = true;
    }
  }

  panel.removeAttribute('hidden');
  recs.removeAttribute('hidden');

  if (!needsRefill) return true;

  const pairing = recs.querySelector('.cart-pairing');
  if (pairing) {
    pairing.classList.add('cart-pairing--pending');
    pairing.setAttribute('aria-busy', 'true');
  }

  delete recs.dataset.fallbackAttempted;
  if (typeof recs.loadRecommendations === 'function') {
    recs.loadRecommendations(recs.dataset.productId);
  }

  return true;
}

/**
 * Keep loaded pairing panels when the seed product is unchanged so the
 * skeleton markup does not flash and resize the aside during cart refresh.
 */
function preserveCartPairingPanels(currentRoot, incomingRoot) {
  if (!currentRoot || !incomingRoot) return;

  const currentPanels = currentRoot.querySelectorAll('[data-cart-pairing]');
  const incomingPanels = incomingRoot.querySelectorAll('[data-cart-pairing]');

  currentPanels.forEach((currentPanel, index) => {
    const incomingPanel = incomingPanels[index];
    if (!incomingPanel) return;

    const currentRecs = currentPanel.querySelector('product-recommendations');
    const incomingRecs = incomingPanel.querySelector('product-recommendations');
    const sameProduct =
      currentRecs?.dataset.productId &&
      currentRecs.dataset.productId === incomingRecs?.dataset.productId;
    const isLoaded = currentRecs?.classList.contains('product-recommendations--loaded');

    if (!sameProduct || !isLoaded) return;

    incomingPanel.replaceWith(currentPanel);
    syncCartPairingPanel(currentPanel, incomingRoot);
  });
}

/**
 * Refresh cart markup while keeping loaded pairing panels and, when present,
 * the cart-line motion helper.
 */
function applyCartSectionUpdate(currentElement, incomingElement, { replaceElement = false } = {}) {
  if (!currentElement || !incomingElement) return;

  preserveCartPairingPanels(currentElement, incomingElement);

  if (typeof window.maisonSetCartSectionHTML === 'function') {
    const panels = [...incomingElement.querySelectorAll('[data-cart-pairing]')];
    panels.forEach((panel) => {
      const marker = document.createElement('div');
      marker.setAttribute('data-cart-pairing-preserve', '');
      panel.replaceWith(marker);
    });
    currentElement.className = incomingElement.className;
    window.maisonSetCartSectionHTML(currentElement, incomingElement.innerHTML);
    currentElement.querySelectorAll('[data-cart-pairing-preserve]').forEach((marker, index) => {
      if (panels[index]) marker.replaceWith(panels[index]);
    });
    return;
  }

  if (replaceElement) {
    currentElement.replaceWith(incomingElement);
    return;
  }

  currentElement.replaceChildren(...incomingElement.childNodes);
}

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      return this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = [
						"cart-drawer-items",
						".cart-drawer__footer",
						"[data-cart-pairing]",
					];
          for (const selector of selectors) {
            const targetElements = document.querySelectorAll(selector);
						const sourceElements = html.querySelectorAll(selector);
						targetElements.forEach((targetElement, index) => {
							const sourceElement = sourceElements[index];
							if (!targetElement || !sourceElement) return;

							if (selector === '[data-cart-pairing]') {
								const currentRecs = targetElement.querySelector('product-recommendations');
								const nextRecs = sourceElement.querySelector('product-recommendations');
								const sameProduct =
									currentRecs?.dataset.productId &&
									currentRecs.dataset.productId === nextRecs?.dataset.productId;
								const isLoaded = currentRecs?.classList.contains(
									'product-recommendations--loaded'
								);

								if (sameProduct && isLoaded) {
									syncCartPairingPanel(targetElement);
									return;
								}
							}

							if (
								targetElement.querySelector('[data-cart-list]') &&
								window.maisonSetCartSectionHTML
							) {
								targetElement.className = sourceElement.className;
								window.maisonSetCartSectionHTML(targetElement, sourceElement.innerHTML);
							} else {
								targetElement.replaceWith(sourceElement);
							}
						});
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      const footer = document.getElementById('main-cart-footer');
      const sections = ['main-cart-items'];
      if (footer?.dataset.id) sections.push(footer.dataset.id);

      return fetch(`${routes.cart_url}?sections=${sections.join(',')}`)
        .then((response) => response.json())
        .then((parsedState) => {
          const itemsHtml = parsedState[sections[0]];
          if (itemsHtml) {
            const html = new DOMParser().parseFromString(itemsHtml, 'text/html');
            const sourceQty = html.querySelector('cart-items');
            if (sourceQty) {
							if (window.maisonSetCartSectionHTML) {
								window.maisonSetCartSectionHTML(this, sourceQty.innerHTML);
							} else {
								this.innerHTML = sourceQty.innerHTML;
							}
						}
          }

          if (footer?.dataset.id && parsedState[footer.dataset.id]) {
            const footerHtml = new DOMParser().parseFromString(
              parsedState[footer.dataset.id],
              'text/html'
            );
            const sourceFooter = footerHtml.querySelector('.js-contents');
            const targetFooter = footer.querySelector('.js-contents');
            if (sourceFooter && targetFooter) targetFooter.innerHTML = sourceFooter.innerHTML;
          }
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, event, name, variantId) {
    this.enableLoading(line);

    const sections = this.getSectionsToRender().map((section) => section.section);
    const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';

    buildQuantityRequest(line, quantity, sections)
      .then((request) =>
        fetch(request.url, { ...fetchConfig(), body: JSON.stringify(request.body) })
      )
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        CartPerformance.measure(`${eventTarget}:paint-updated-sections"`, () => {
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          const items = document.querySelectorAll('.cart-item');

          if (parsedState.errors) {
            quantityElement.value = quantityElement.getAttribute('value');
            this.updateLiveRegions(line, parsedState.errors);
            return;
          }

          this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartDrawerWrapper = document.querySelector('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

          this.getSectionsToRender().forEach((section) => {
            const elementToReplace =
              document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
            if (!elementToReplace) return;

            if (section.selector === '.cart-drawer__shell') {
              const doc = new DOMParser().parseFromString(
                parsedState.sections[section.section],
                'text/html'
              );
              const incomingShell = doc.querySelector('.cart-drawer__shell');
              if (!incomingShell) return;
              applyCartSectionUpdate(elementToReplace, incomingShell, { replaceElement: true });
              return;
            }

            const sectionHTML = this.getSectionInnerHTML(
              parsedState.sections[section.section],
              section.selector
            );
            if (window.maisonSetCartSectionHTML) {
              window.maisonSetCartSectionHTML(elementToReplace, sectionHTML);
            } else {
              elementToReplace.innerHTML = sectionHTML;
            }
          });
          const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
          let message = '';
          if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
            if (typeof updatedValue === 'undefined') {
              message = window.cartStrings.error;
            } else {
              message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
            }
          }
          this.updateLiveRegions(line, message);

          const lineItem =
            document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
          }
        });

        CartPerformance.measureFromEvent(`${eventTarget}:user-action`, event);

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch(() => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } })
              .then(() => CartPerformance.measureFromEvent('note-update:user-action', event));
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}
