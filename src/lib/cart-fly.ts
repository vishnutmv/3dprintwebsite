/**
 * Product-to-cart animation.
 *
 * Purely visual: callers must run the existing cart action themselves. This
 * helper clones the product image, flies it to the header cart icon and
 * bounces the icon. It never mutates cart state and cleans up after itself.
 */

const CART_SELECTOR = "[data-cart-target]";
let flying = 0;

function pulseCart(target: HTMLElement) {
  target.classList.remove("cart-bounce");
  // Restart the animation if it is already running.
  void target.offsetWidth;
  target.classList.add("cart-bounce");
  window.setTimeout(() => target.classList.remove("cart-bounce"), 550);
}

export function flyToCart(source: HTMLElement | null, imageUrl?: string) {
  if (!source) return;
  const target = document.querySelector<HTMLElement>(CART_SELECTOR);
  if (!target) return;

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    pulseCart(target);
    return;
  }
  if (flying >= 3) return;

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (from.width === 0 || from.height === 0) return;

  const startSize = Math.min(from.width, from.height, 132);
  const node = document.createElement("img");
  node.src =
    imageUrl ||
    "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2b312a"/><stop offset="1" stop-color="#111311"/></linearGradient></defs><rect width="80" height="80" rx="18" fill="url(#g)"/><path d="M40 18 57 27v18L40 54 23 45V27l17-9Z" fill="none" stroke="#c6ff00" stroke-width="2.4"/></svg>',
      );
  node.alt = "";
  node.setAttribute("aria-hidden", "true");
  node.className = "cart-fly-clone";
  Object.assign(node.style, {
    left: `${from.left + from.width / 2 - startSize / 2}px`,
    top: `${from.top + from.height / 2 - startSize / 2}px`,
    width: `${startSize}px`,
    height: `${startSize}px`,
  });
  document.body.appendChild(node);
  flying += 1;

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const flight = node.animate(
    [
      { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
      {
        transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 46}px) scale(0.6) rotate(10deg)`,
        opacity: 1,
        offset: 0.5,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.16) rotate(22deg)`,
        opacity: 0.35,
        offset: 1,
      },
    ],
    { duration: 720, easing: "cubic-bezier(.3,.9,.35,1)", fill: "forwards" },
  );

  const cleanup = () => {
    node.remove();
    flying = Math.max(0, flying - 1);
    pulseCart(target);
  };
  flight.addEventListener("finish", cleanup, { once: true });
  flight.addEventListener("cancel", cleanup, { once: true });
  // Safety net if the tab is hidden and finish never fires.
  window.setTimeout(() => {
    if (node.isConnected) cleanup();
  }, 1400);
}
