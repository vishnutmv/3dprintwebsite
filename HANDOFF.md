# UI Redesign Handoff

## Project

- React 18 + TypeScript + Vite storefront for 3D Print Co.
- Styling uses Tailwind CSS and shared rules in `src/styles/index.css`.
- Client routing is configured in `src/App.tsx` with React Router.
- Storefront is wrapped by `src/components/SiteLayout.tsx`.
- Admin pages are under `/admin` and use `src/admin/AdminLayout.tsx`.

## User request and scope

The user wanted the storefront and admin panel redesigned to feel like a polished, friendly, responsive ecommerce site, with smoother perceived performance. They explicitly asked not to change application functions or workflows.

Keep future work within that scope unless the user asks otherwise:

- Preserve routes, checkout behavior, admin actions, data handling, and business logic.
- Treat the current changes as a visual refresh and load-performance improvement only.
- Do not replace or simplify existing functionality while refining the UI.

## Design changes made

- Replaced the dark glassmorphism foundation with a warm off-white, charcoal, terracotta, and muted green palette.
- Changed shared card surfaces, form fields, buttons, chips, borders, typography, and hover states for the light theme.
- Removed expensive decorative blur, grain, and animated blob effects to keep the interface calmer and lighter to render.
- Added a mobile navigation row for Home, Shop, and Rewards.
- Updated the storefront header, logo colors, footer, product-card media surfaces, and admin shell to match the new theme.
- Added a featured-product panel to the home hero, linking to the existing product detail route.
- Added responsive spacing for the mobile storefront header.

## Dark mode and theme transition

- Added a full dark palette alongside the light theme; the choice persists in local storage and is applied before first paint to avoid a flash.
- The header toggle now uses the View Transition API to reveal the new theme in a circle from the switch. Browsers without the API, and users with reduced motion enabled, get an instant swap.
- Colour transitions are frozen with `html.theme-switching` while the browser captures both snapshots, then resume afterwards.
- Contrast tokens were tightened for light and dark mode (muted/faint text, accent text on both themes).

## Accessibility and perceived performance

- Added a screen-reader heading to the empty cart, labels to icon-only promo links, and an underline affordance to inline review links.
- Reserved the first viewport in route/product loading states and the account loading card so the footer does not jump when content arrives.
- Throttled-mobile CLS is 0.031 (down from 0.581 recorded before the redesign).
- The latest audit found 0 serious axe rules, 0 unnamed controls, 0 undersized targets, 0 overflow failures, 4/4 functional flows and 3/3 theme tests passing.

## 404 and hosting routes

- Added `public/404.html`, a standalone themed not-found page, and a `/favicon.svg`.
- `vercel.json` now uses explicit `routes`: the API proxy, the known SPA paths, a filesystem handle for static assets, and a real 404 response for unknown paths instead of serving the app shell.

## Performance changes

Route screens in `src/App.tsx` are loaded with `React.lazy` and `Suspense`; existing URLs and route hierarchy are unchanged. This avoids loading every storefront and admin screen on the initial visit.

In the verified production build:

- Main app JS chunk: about 277 KB (88 KB gzip).
- 3D `ModelViewer` chunk: about 916 KB (247 KB gzip), separated from the initial app chunk.

## Files changed

- `tailwind.config.js` — warm light palette and adjusted shadows.
- `src/styles/index.css` — shared light/dark theme, surfaces, controls, typography, contrast tokens, and reduced decorative rendering.
- `public/404.html`, `public/favicon.svg` — standalone themed 404 page and site icon.
- `vercel.json` — explicit API, SPA, static and 404 routes.
- `src/App.tsx` — lazy-loaded route screens with a loading skeleton, full-viewport loading states, and React Router v7 future flags.
- `src/components/ThemeToggle.tsx` — View Transition theme reveal with fallbacks.
- `src/components/SiteHeader.tsx` — responsive mobile navigation.
- `src/components/SiteLayout.tsx` — storefront theme wrapper.
- `src/components/Logo.tsx` — updated brand mark colors.
- `src/components/ProductCard.tsx` — light product media tile and readable badges.
- `src/pages/Home.tsx` — featured-product hero panel.
- `src/admin/AdminLayout.tsx` — admin theme wrapper and login styling.
- `index.html` — updated browser theme color.

## Verification

- `npm run build` passed, including frontend and API TypeScript checks, and the Vite build (main app chunk about 277 KB / 88 KB gzip).
- A scripted Playwright audit (`playwright-report-fixed/`) covered 38 page/theme/viewport combinations plus functional flows, theme persistence and throttled CLS; all checks passed.
- Browser inspection confirmed the storefront rendered at mobile width without horizontal overflow.
- Browser inspection confirmed the admin login screen rendered with the light theme.
- React Router v7 future flags are enabled, so the development console no longer emits the deprecation warnings.

## Notes for the next AI

- Shared CSS overrides intentionally remap legacy `text-white`, `text-white/*`, and white-border utility classes for the light theme. Check contrast carefully when adding elements that intentionally sit on a dark background; the home hero feature has a scoped white-text exception.
- Product demo data may not include photos. Product cards and the home hero therefore retain a colored accent-based visual fallback.
- Admin functionality and workflows were not reworked. Continue applying the shared theme rather than changing the logic in individual admin screens.
