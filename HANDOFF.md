# Zencmart UI Handoff

## Project

- React 18 + TypeScript + Vite storefront and admin panel for **Zencmart**, a 3D-printing studio.
- Styling uses Tailwind CSS plus shared tokens/components in `src/styles/index.css`.
- Client routing is configured in `src/App.tsx` with React Router.
- Storefront is wrapped by `src/components/SiteLayout.tsx`; admin pages live under `/admin` and use `src/admin/AdminLayout.tsx`.
- Frontend is deployed on Vercel; the PHP API, MariaDB and media stay on InterServer.

## User request and scope

The storefront and admin panel were redesigned into a premium charcoal + neon-lime 3D-printing experience, rebranded to **Zencmart**, working on desktop and phone widths. This remains a frontend-only change:

- Routes, checkout/payment behavior, admin actions, data handling and business logic are unchanged.
- Visual effects must never drive cart or payment state; the existing handlers remain the source of truth.
- Do not replace or simplify existing functionality while refining the UI.

## Design system

- Charcoal chrome (`#0f120f` / `#111311`) with warm paper content surfaces (`#f8f6f1`, `#ffffff`).
- Neon lime (`#c6ff00`, hover `#d7ff38`) for primary actions, active navigation, badges and highlights; dark text on lime.
- Muted sage neutrals for secondary text; subtle borders instead of heavy outlines.
- A dark theme mirrors the charcoal chrome with darker cards and lime accents. The saved preference still uses the existing `3dprintco-theme` key so current users keep their choice.
- Theme changes use the View Transition circle reveal, with reduced-motion and no-API fallbacks.
- Shared tokens live in `src/styles/index.css`; Tailwind’s `violet` palette was remapped to lime so older screens adapt without rewriting every class.

## Storefront changes

- **Header** (`src/components/SiteHeader.tsx`): charcoal sticky bar with logo, Home/Shop/Rewards/Custom Print, working categories dropdown, catalogue search (`/shop?q=`), theme switch, account, favourites/notifications for signed-in customers, live cart count and admin link. Mobile gets a drawer with navigation, categories, theme switch, sign-in and admin.
- **Home** (`src/pages/Home.tsx`): premium dark hero (“Bring Ideas to Life in 3D”), trust strip, category showcase from live categories, featured products, workflow strip, testimonials and rewards panel.
- **Product cards** (`src/components/ProductCard.tsx`): white cards with hover lift, badges, rating, live price and a compact add-to-cart action.
- **Product detail** (`src/pages/ProductDetail.tsx`): gallery/video/3D viewer, material, quantity selector, Add to Cart, Buy Now, specifications and reviews. No new product options were invented.
- **Shop** (`src/pages/Shop.tsx`): breadcrumb, filter sidebar (search, category counts, price bands), sort, responsive two-column mobile grid, collapsible mobile filters. Existing filtering/sorting logic is untouched.
- **Cart** (`src/pages/Cart.tsx`): redesigned line items, quantity controls, free-shipping progress and sticky summary using the existing totals.
- **Checkout** (`src/pages/Checkout.tsx`): layout refresh only. A compact 3D-printer loader appears inline while the existing request/payment flow is busy; it is not a blocking overlay and never changes payment state.
- **Order confirmation** (`src/pages/OrderConfirmation.tsx`): a print-completion celebration (`src/components/PrintSuccess.tsx`) renders only when the server reports `paymentStatus === "paid"` and the app is not in demo mode. Cancelled/failed/pending flows keep their existing notices and retry action.
- **Brand**: `src/lib/brand.ts` supplies display strings; logo, favicon, 404 page, footer, invoice PDF, reward card, admin login and document titles use “Zencmart”.

## Cart fly animation

`src/lib/cart-fly.ts` implements the product-to-cart effect:

- Captures the product media’s `getBoundingClientRect()` and the header cart icon’s rect.
- Clones the product image (or a lime cube SVG for photo-less products) into a fixed overlay.
- Uses the Web Animations API to arc it into the cart with scale/rotation, then removes the node and bounces the cart icon.
- Runs after the existing `addToCart` call, is skipped for reduced motion (icon pulse only), caps concurrent clones and cleans up on cancel/timeout.

## Admin changes

- Login is now a charcoal card with lime primary action.
- Admin sidebar is a dark charcoal panel with lime active states; store label and brand mark use Zencmart.
- Existing tables, forms, status badges, notifications and all admin handlers are unchanged; lime now flows through previously violet accents.

## Files changed

- `tailwind.config.js`, `src/styles/index.css` — charcoal/lime palette, new storefront/admin component styles, loader and animation keyframes.
- `src/lib/brand.ts` — Zencmart display constants.
- `src/components/Logo.tsx` — lime cube mark, Zencmart wordmark, admin mark.
- `src/components/SiteHeader.tsx` — new header, categories dropdown, search and mobile drawer.
- `src/components/ProductCard.tsx` — redesigned card and add-to-cart action.
- `src/lib/cart-fly.ts` — fly-to-cart helper.
- `src/pages/Home.tsx`, `Shop.tsx`, `ProductDetail.tsx`, `Cart.tsx`, `Checkout.tsx`, `OrderConfirmation.tsx` — redesigned screens.
- `src/components/PrintingLoader.tsx`, `PrintSuccess.tsx` — printer waiting and verified-success animations.
- `src/components/SiteFooter.tsx` — charcoal footer.
- `src/admin/AdminLayout.tsx` — dark sidebar and login card branding.
- `src/lib/invoice.ts`, `RewardReveal.tsx`, `Terms.tsx`, `demo.ts`, `store.ts`, `ReceiptModal.tsx` — Zencmart display strings and fallbacks.
- `index.html`, `public/404.html`, `public/favicon.svg` — title/metadata/theme colour, branded 404 and icon.

## Verification

- `npm run build` passes (frontend + API TypeScript, Vite build; main app chunk about 286 KB / 90 KB gzip).
- Playwright checks against the dev build at 1440px and 390px: home, shop, product, cart, admin login, mobile drawer and dark theme; no horizontal overflow and no broken images. A 320px pass over `/`, `/shop`, `/cart` and `/admin` also reported no overflow.
- Header search navigates to `/shop?q=dragon` and filters the catalogue to the matching product.
- Add-to-cart creates one fly clone, removes it, bounces the cart icon and updates the count from 0 → 1.
- Mobile filters start collapsed and expand on demand.
- Admin dashboard screens behind authentication were not visually re-verified, and the payment loader/success states were not exercised with live Razorpay because test keys are not configured in the verification environment.
- The dev environment logs “customer session unavailable in the local demo”, which is expected demo-mode behaviour, not a redesign regression.

## Notes for the next AI

- Shared CSS remaps legacy `text-white`, `text-white/*` and white-border utilities to theme colours for light surfaces. On dark panels use explicit colours (`text-[#f7f8f2]`, `text-[#a9afa4]`) or the scoped header/sidebar/footer rules; otherwise text becomes dark and unreadable.
- The product catalogue currently has no photos in demo data, so cards and the hero use generated accent/lime visuals. Real uploaded images are used automatically when present.
- Business data still comes from the PHP API. `settings.storeName`, support email/phone and GST settings may still contain the old business details; update them in Admin → Settings (or the database) when the client confirms the new contact details. Display branding itself is Zencmart.
- Do not gate success animations on timers or client-only state. `PrintSuccess` is deliberately rendered only from verified `paid` order data.
- Deployment: push the frontend to Vercel; InterServer only needs PHP/API files when those change.
