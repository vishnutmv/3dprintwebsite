# 3D Print Co. Project Context and Handoff

> **Purpose:** This document is the project handoff for a developer or AI assistant joining the 3D Print Co. storefront work. It records the product goal, architecture, implemented flows, operational setup, recent work, caveats, and safe next steps. It is not a substitute for inspecting the source code before changing it.
>
> **Documentation snapshot:** 2026-11-11. The repository and live hosting may change after this snapshot. Verify current source and hosting state before deploying or applying database changes.

## 1. Project at a glance

3D Print Co. is a customer-facing storefront and admin system for a small-batch 3D printing business. It is being built for the business owner/admin to manage products, orders, customers, WhatsApp enquiries, rewards, collaborator offers, marketing consent, invoices, and sales insights in one place.

### Product goals

- Let customers browse products, see pricing, add items to a cart, submit checkout details, and place orders.
- Keep order and customer records in the business database, including customer contact details and WhatsApp/marketing consent where provided.
- Allow the admin to manage the catalogue, stock, product media, orders, customer records, prizes, and collaborators.
- Capture and organize WhatsApp conversations; respond to explicit business enquiries without automatically replying to every personal chat.
- Link WhatsApp leads to existing customers and record cold-enquiry-to-customer conversions accurately.
- Support partner/collaborator-funded offers alongside ordinary prizes, with inventory quantities and assignment tracking.
- Offer customers a scratch-card-style reward reveal, with a downloadable reward PDF.
- Provide sales/conversion insights, consent-based WhatsApp campaigns, and payment-confirmed invoices.

### Current broad status

The frontend, PHP/MariaDB backend, admin interfaces, and integration code exist in the repository. The frontend build passed during the latest work. That does **not** prove the latest PHP code is deployed or that the live MariaDB schema, WaAPI instance, cron job, email provider, or payment provider are configured correctly.

The intended production split is:

- **Frontend:** React/TypeScript/Vite, deployed on Vercel.
- **API, MariaDB and media:** PHP 8.2+ and MariaDB on InterServer shared hosting, managed through DirectAdmin.
- **WhatsApp:** WaAPI instance/webhook integration. WaAPI is a third-party provider, not Meta's official Cloud API.
- **Payments:** Razorpay integration is deliberately restricted to **Test Mode** in the current project.
- **Invoice email:** Optional Resend configuration.

The repository README is the operational companion to this handoff: [README.md](./README.md).

## 2. Important working rules for future changes

1. Read the relevant source files and this handoff before editing; do not assume the deployed host matches the local repository.
2. Do not read, print, commit, or share `api/config.php`, `.env.local`, provider tokens, webhook secrets, passwords, private customer data, or any secret files. `api/config.php` is a private server-side configuration file.
3. Keep secrets server-side. Never put API tokens, payment secrets, WaAPI credentials, or webhook secrets in `VITE_` variables or frontend source.
4. Do not import `database/interserver.sql` into an existing live database. It is the fresh-install schema.
5. Before applying a migration to an existing database, back it up and inspect the schema. Never blindly rerun a partially applied migration. A duplicate column/table/index error means stop and inspect before proceeding.
6. Preserve customer consent and privacy. Marketing campaigns must only target customers recorded as opted in. Follow current privacy, retention, WhatsApp policy, and applicable law before production use.
7. Keep payment behavior in test mode until the business has completed legal, tax, shipping, refund, provider, and production-readiness checks. Do not switch to real payment credentials as part of routine testing.
8. Describe the WhatsApp responder accurately: it is deterministic catalogue/shop-link logic, **not an AI chatbot**. No AI provider is configured.
9. Keep changes surgical and validate them. `npm run build` runs TypeScript checks and the Vite production build. PHP syntax and real provider/database behavior require a suitable PHP/MariaDB environment.

## 3. Technology and repository layout

### Stack

- React 18, TypeScript, Vite, React Router.
- Tailwind CSS and project UI components/styles.
- Zustand and local storage utilities for client-side state.
- PHP 8.2+ API, PDO MySQL, MariaDB.
- Razorpay test checkout/webhook verification.
- WaAPI webhook and outbound-message integration.
- Resend for optional email delivery.
- `jspdf` for invoice/reward PDF generation in the frontend.
- Vercel for the static SPA; InterServer for API, database, and uploads.

### Key directories/files

| Location | Responsibility |
|---|---|
| `src/App.tsx` | Public/admin route definitions. |
| `src/pages/` | Storefront, product, cart, checkout, account, order confirmation, rewards and reward reveal pages. |
| `src/admin/` | Dashboard, product/order/customer/lead/prize/collaborator/insight/campaign/settings admin screens and WhatsApp chat UI. |
| `src/lib/api.ts` | Shared frontend API calls and response handling. |
| `src/lib/admin.ts` | Admin API types and helper functions. |
| `src/lib/auth.ts` | Admin session/login-related browser code. Server-side PHP session still enforces access. |
| `src/lib/demo.ts`, `src/lib/demo-mode.ts` | Local demo-mode data and behavior. Demo data is not production data. |
| `src/lib/invoice.ts` | Client-side PDF invoice/reward document helpers. |
| `src/lib/razorpay.ts` | Razorpay checkout integration on the frontend. |
| `api/index.php` | PHP API entrypoint; loads shared bootstrap and commerce/admin/WhatsApp handlers, starts the protected session, dispatches requests, and formats errors. |
| `api/_php/bootstrap.php` | Shared configuration loading, database/helpers, response and common utilities. |
| `api/_php/commerce.php` | Public catalogue, customer/order/checkout/payment/reward-facing API behavior. |
| `api/_php/admin.php` | Protected admin operations, including product/order/customer/prize/collaborator/insights/campaign APIs. |
| `api/_php/whatsapp.php` | WaAPI inbound webhook, lead/conversation handling, business trigger, replies, follow-ups, and WhatsApp messaging helpers. |
| `api/config.example.php` | Safe template for private PHP configuration. Do not copy real values into documentation or source control. |
| `api/config.php` | **Private server config; do not expose or commit.** Local file may exist. |
| `api/dev-router.php` | Local PHP development router. |
| `database/interserver.sql` | Current MariaDB schema for a new installation. Not an upgrade script. |
| `migrations/0009_*.sql`–`migrations/0014_*.sql` | Incremental MariaDB changes for existing installations; apply in order, only when needed. |
| `supabase/migrations/` | Historical Supabase-era files; current production backend is PHP/MariaDB, not Supabase. |
| `vercel.json` | Vercel build/output and SPA/API rewrites. `/api/*` is proxied to the configured InterServer host. |
| `.vercelignore` | Excludes the PHP API from Vercel deployment. |
| `uploads/` | Production media is served from InterServer; inspect host-specific configuration before modifying. |

### Routes and admin areas

Public routes include `/`, `/shop`, `/product/:slug`, `/cart`, `/checkout`, `/order/:id`, `/account`, `/rewards`, `/reward/:token`, `/terms`, and `/privacy`.

Admin routes include `/admin`, `/admin/products`, `/admin/orders`, `/admin/customers`, `/admin/leads`, `/admin/prizes`, `/admin/collaborators`, `/admin/insights`, `/admin/campaigns`, and `/admin/settings`.

Admin route visibility is not the security boundary. The PHP API checks the server-side session for protected operations. The project uses an expiring HttpOnly, SameSite PHP session cookie and should be served over HTTPS.

## 4. Important end-to-end flows

### 4.1 Storefront, checkout, order and payment

1. Customer browses products and adds items to the cart.
2. At checkout, customer supplies order information and contact details. Marketing updates/newsletter consent is optional and is recorded when selected.
3. The server calculates the order using authoritative product/price data; do not trust a client-submitted total.
4. Payment integration is configured for Razorpay **Test Mode**. The PHP side verifies payment/webhook information and updates payment state idempotently.
5. The order and customer data are stored in MariaDB. The admin can review orders, update fulfillment status, and access customer/order history.
6. An invoice PDF is prepared for a successfully paid order and can be downloaded from the order page. Email delivery depends on the Resend settings and must be tested separately.
7. Order status changes can send distinct WhatsApp layouts to the relevant customer when the status changes, provided the WhatsApp provider is configured and can reach that customer.

**Not production-ready for real payments:** live Razorpay keys are rejected by design. Legal/tax/returns/shipping copy is draft and requires review. Verify transaction IDs, payment amount, webhook delivery, email configuration and end-to-end order behavior in a test environment.

### 4.2 WhatsApp inbound messages and enquiry classification

1. WaAPI sends a `message` event to the configured secret webhook endpoint.
2. The PHP backend validates the configured webhook secret and instance, accepts supported chat identifiers, and saves incoming message details/conversation activity for admin use. Duplicate webhook deliveries are intended to be ignored.
3. The admin inbox can show **Business enquiries** or **All chats**. The goal is to keep non-enquiry conversations visible to the admin without automatically answering them.
4. An automatic response is triggered only if the message contains a supported 3D Print Co. brand form—such as `3dprintco`, `@3dprintco`, `/3dprintco`, or spaced `3d print co`—followed by a query-like request. The latest matcher includes catalogue terms and common question/request terms.
5. The response is deterministic: it shares up to three active/in-stock catalogue items with their prices and a shop link, or uses the shop link as a fallback. It does not use a language model or AI service.
6. Name/phone details included in follow-up message text may be extracted. The backend normalizes phone variants and attempts to match the number against existing customers.
7. A lead that already matches a customer should not be counted as a cold lead converted to a customer. Cold enquiry conversion is linked when the same customer later places an order, based on the stored customer/phone match logic.
8. The admin can view/reply in the conversation UI. Replies through the connected WhatsApp application may also sync if WaAPI emits the corresponding message event.
9. Lead takeover is available. The desired behavior is that takeover prevents an automatic initial answer; an actual admin response prevents the pending five-minute follow-up. If no admin replies within five minutes, a follow-up may be sent by the scheduled handler.
10. The five-minute follow-up needs a working DirectAdmin cron job and the configured cron secret. It will not run just because the PHP code exists.

**Trigger caution:** Natural-language matching is heuristic, not semantic AI. Test actual phrases used by customers and incidental mentions. A brand mention at the end of arbitrary text may be discarded, while a brand followed by question/catalogue wording can qualify. Review and adjust the matcher only with focused tests and consider false-positive/false-negative behavior.

### 4.3 Existing customers versus cold leads

- WhatsApp leads store chat identity, possible phone, profile name, timestamps and conversation history.
- A chat ID might be a phone-based ID or a privacy-preserving WhatsApp LID. A LID may not provide a directly clickable `wa.me` URL; the provider may still be able to reply using the chat ID.
- Phone normalization is used to link a WhatsApp enquiry to an existing customer. Phone-based matching is not perfect identity verification; do not merge records solely on a weak or ambiguous match.
- Existing customers should not inflate cold-lead conversion metrics.
- Admin should see captured details and whether a lead is known to be an existing customer.
- Apply appropriate privacy/retention rules to conversations and customer contact information.

### 4.4 Orders, customer contact and WhatsApp notifications

- Store customer contact details from checkout on the order/customer record so the admin can identify and contact the customer.
- Admin can send a WhatsApp message from relevant customer/order/chat surfaces where the API exposes it.
- When order fulfillment status changes, the backend sends the corresponding designed message template rather than a generic one-size-fits-all text, where configured.
- The notification must correspond to the customer/order and only send when the state actually changes; inspect provider delivery status in failures.
- Missing provider configuration means notification delivery is not guaranteed. Admin feedback and API response statuses should be checked.

### 4.5 Prizes, collaborators and scratch cards

- Standard prizes are managed in the Prizes admin tab; a missing voucher code may be optional depending on prize type and validation. Preserve the existing optional-voucher behavior when editing.
- Collaborators are managed in the Collaborators tab. An admin can save partner identity/contact/notes, create reward offers and define reward type/value/quantity/terms.
- Collaborator offers are linked to prize records so collaborator rewards and standard prizes share the prize inventory and assignment flow.
- Prize inventory is quantity-aware. Active assignments must be accounted for so the system does not over-assign available units.
- Collaborator offers are not exposed as unassigned public prizes; the intent is to keep their reward value private until assigned.
- Admin assigns a reward to a selected user. A reward notification/link may be delivered through WhatsApp if provider settings permit.
- The customer opens a tokenized reward page and scratches to reveal the reward. A server-side reveal/lock is intended to make the scratch action one-time. Reopening the link may show the already revealed state, not grant a second scratch.
- On the successful reveal, the UI celebrates and downloads a reward-card PDF. Sharing the PDF to WhatsApp requires an explicit customer action and browser/device support; automatic file delivery via WhatsApp is not guaranteed by the current implementation.
- Test duplicate reveal/assignment, expiry/token access, inventory boundaries, and browser behavior before relying on rewards in production.

### 4.6 Campaigns and consent

- Checkout marketing consent is optional and stored against the customer record.
- Campaign audience selection is intended to include only opted-in customers who have a phone number.
- Campaign sends are text-only, batched (up to three recipients per send action) to limit shared-host request duration.
- Failed sends are surfaced; there is no automatic retry in the documented current behavior.
- A customer can reply `STOP` to disable future campaigns for their matched customer phone.
- Do not add media sends, broaden the audience, or send bulk notifications without implementing consent controls and verifying current provider/WhatsApp policy.

### 4.7 Insights

- Insights use paid orders and tracked WhatsApp lead conversions rather than treating every enquiry as a conversion.
- Product sales/trend tags are computed from paid sales; they should not overwrite an admin's manually selected product badge.
- The admin has a separate Insights area for sales and lead-conversion analysis. Confirm the exact chart/heatmap fields in the current UI and backend rather than assuming every imaginable dimension is already supported.
- Data quality depends on payment state, customer phone matching, migration completion, and correct webhook/order processing.

### 4.8 Admin attention notifications

- The admin UI includes visual attention cues for new leads and toast/title/alert behavior according to current implementation.
- These are browser/admin-panel notifications, not a guarantee of push notifications while the admin is away from the site.
- Verify behavior in the live admin session, especially tab visibility, refresh persistence, and acknowledgement/clearing behavior.

## 5. Database and migration guidance

The live database is MariaDB. The project includes both a fresh schema and incremental migrations:

- `database/interserver.sql`: current fresh-install schema; **never import into an existing live DB as an upgrade**.
- `migrations/0009_whatsapp_leads.sql`: lead/customer foundation.
- `migrations/0010_waapi_leads.sql`: WaAPI-specific lead support.
- `migrations/0011_whatsapp_conversations.sql`: conversation/chat message storage.
- `migrations/0012_whatsapp_business_triggers.sql`: business-trigger/lead fields and behavior support.
- `migrations/0013_rewards_campaigns_invoices.sql`: rewards, campaigns, invoice/order related additions.
- `migrations/0014_collaborator_gifts_and_enquiry_details.sql`: prize quantity, WhatsApp lead detail/existing-customer fields, phone index adjustment, collaborators, collaborator offers, and linkage to prizes.

For an existing database:

1. Take a verified backup before schema changes.
2. Check which migrations have already succeeded; the project may not have a migration ledger.
3. Inspect the actual columns/indexes/tables before importing the next migration. The `0014` migration in particular drops the named unique phone index `phone_e164`, then creates a non-unique phone index and adds columns/tables. If the live index or partial state differs, do not blindly run it.
4. If phpMyAdmin reports a duplicate column, index, or table, stop. Inspect `SHOW COLUMNS`, `SHOW INDEX`, and table existence; reconcile the state safely.
5. Test the resulting schema via the API and admin screens. Never infer success only from the browser refreshing during phpMyAdmin import.

Useful safe schema inspections for the 0014 changes (run against the correct database):

```sql
SHOW COLUMNS FROM prizes;
SHOW COLUMNS FROM whatsapp_leads;
SHOW INDEX FROM whatsapp_leads;
SHOW TABLES LIKE 'collaborators';
SHOW TABLES LIKE 'collaborator_offers';
SHOW CREATE TABLE collaborator_offers;
```

Do not paste query results that expose customer data or connection details into public channels.

## 6. Local development and validation

### Frontend-only demo

The repository README describes demo mode with `.env.local` values such as `VITE_DEMO_MODE=true` and local demo admin credentials. Demo edits are local browser data only; they do not update MariaDB or send real WhatsApp/payment messages.

Run:

```powershell
npm ci
npm run dev
```

Vite's configured port is 5180. Use the URL printed by Vite and open the admin route, for example `/admin/collaborators`. If demo mode is enabled, use the local demo credentials configured privately in the ignored environment file.

### Full local API development

Requires a local PHP installation, a `api/config.php` created from the example with local-only database/provider settings, and PHP extensions (PDO MySQL, fileinfo, mbstring).

Run PHP and Vite in separate terminals:

```powershell
php -S 127.0.0.1:8080 api/dev-router.php
npm run dev
```

Vite proxies `/api/*` to `http://127.0.0.1:8080`.

### Build/type validation

```powershell
npm run build
```

This runs the TypeScript checks and Vite production build. At the latest recorded run it passed, with an existing warning that the main bundle is large (about 1.85 MB minified). The warning is not a build failure and should be addressed separately if bundle performance work is requested.

PHP linting, MariaDB migration execution, provider webhooks, payment flows, invoice email, WhatsApp delivery and upload permissions need external runtime testing. The PHP CLI was unavailable during the last documented validation.

## 7. Deployment topology and safe release sequence

### Frontend on Vercel

`vercel.json` declares the Vite build, `dist` output, API rewrite to the InterServer origin, and SPA fallback. The intended deployment process is via the Git repository connected to Vercel, not uploading the `dist` folder to DirectAdmin.

1. Confirm the correct source changes are saved in the project and included in the repository's deployment branch.
2. Run `npm run build`.
3. Push/deploy through the configured Git/Vercel workflow.
4. Check that the Vercel deployment succeeds and that the live admin route loads. Hard-refresh to clear stale assets if needed.
5. Ensure the exact Vercel origin is allowed in the PHP API's server-side `allowed_origins` configuration.

### PHP API and media on InterServer

PHP/backend updates are separate from frontend deployment. Upload changed API files to their matching paths under `public_html/api/_php/`, preserving the entrypoint, rewrite files, and private configuration. Do not overwrite or expose `api/config.php`. The README has the more detailed initial deployment instructions.

### Database

Back up first; inspect schema; apply only missing migrations. Avoid importing the full fresh-install schema into a live database.

### Post-deployment smoke checks

1. Open `https://<frontend-origin>/api/settings`; it should return API JSON through the Vercel rewrite, not a hosting 404.
2. Check `/api/products` and storefront content.
3. Sign into `/admin`; verify products, orders, leads and collaborators load.
4. Verify a test product/prize operation persists after refresh (not just demo local storage).
5. Confirm the configured WaAPI webhook receives one test message and creates the expected conversation/lead.
6. Test a valid business-trigger phrase and a non-enquiry/incidental brand mention.
7. Test admin takeover/reply and five-minute follow-up with the scheduled cron in a controlled test.
8. Test collaborator quantity assignment, reward reveal/reopen, download/share behavior.
9. Test payment in Razorpay Test Mode and verify payment webhook, invoice PDF, and configured email.
10. Check PHP logs and API responses for failures; do not treat UI-only success as proof of provider delivery.

The prior README records an earlier check in which the InterServer API endpoint returned 404 and the PHP backend still needed deployment. That was a historical observation, not a verified statement of current live status. Recheck the live host before assuming anything has been deployed.

## 8. Integrations and configuration boundaries

All integration credentials belong in the private PHP config on the server or the appropriate private provider dashboard:

- Database connection settings.
- Admin login credentials.
- Razorpay Test Mode key ID/secret and webhook secret.
- WaAPI instance ID/API token, webhook secret and separate cron secret.
- Resend API key/from address (optional).
- Exact allowed CORS origins.
- Canonical storefront/API URL.

Never put these values in this markdown file. See [api/config.example.php](./api/config.example.php) for key names and [README.md](./README.md) for setup steps; use the example only, not the live `api/config.php`, when sharing project context.

### WaAPI caveat

WaAPI is described here as a third-party WhatsApp Web-based provider, not Meta's official Cloud API. Its cost, reliability, terms, privacy implications and WhatsApp policy compliance must be independently checked. Do not promise that it is free or risk-free. The webhook secret is part of the URL because the documented webhook does not include a verified signature header; keep it private and rotate it if exposed.

### Email and invoices

Invoice generation and email are different operations. PDF generation/download can work in the frontend while email still fails if Resend is absent or misconfigured. Verify both independently.

## 9. Work history and latest project changes

The project has evolved through these user-requested areas:

1. Corrected prize assignment/reward creation behavior, including the requirement that voucher code be optional where appropriate.
2. Added WhatsApp lead capture and configured WaAPI integration support.
3. Added admin visibility and conversation handling, with enquiry filtering to avoid responding to all incoming personal messages.
4. Expanded checkout/customer/order messaging, invoices and insight features.
5. Added marketing consent and opt-in campaign functionality.
6. Added collaborator management and collaborator-funded gift/reward offers that share the prize inventory.
7. Added quantity-aware reward inventory and assignment behavior.
8. Added scratch-card reward reveal with one-time backend reveal protection, celebratory UI and PDF download/share affordance.
9. Added WhatsApp lead/customer matching, details shown in admin and safeguards against counting known customers as cold-lead conversions.
10. Added admin attention indicators for leads.
11. Refined trigger matching to recognize compact/spaced brand forms and request/question wording, while suppressing messages that merely mention the business without an apparent enquiry.

Recent frontend areas/files include:

- `src/admin/AdminCollaborators.tsx`
- `src/admin/AdminLeads.tsx`
- `src/admin/AdminPrizes.tsx`
- `src/admin/AdminInsights.tsx`
- `src/admin/AdminCampaigns.tsx`
- `src/admin/WhatsAppChat.tsx`
- `src/pages/RewardReveal.tsx`
- `src/lib/admin.ts`, `src/lib/demo.ts`, `src/lib/invoice.ts`
- `src/App.tsx`, `src/admin/AdminLayout.tsx`

Recent backend/schema areas/files include:

- `api/_php/whatsapp.php`
- `api/_php/admin.php`
- `api/_php/commerce.php`
- `api/_php/bootstrap.php`
- `migrations/0014_collaborator_gifts_and_enquiry_details.sql`
- `database/interserver.sql`

Use the current source, not this history alone, to confirm exact behavior and line-level implementation.

## 10. Known gaps, constraints, and questions for the business owner

- **Deployment is not verified by a local build.** Confirm which code versions are live on Vercel and InterServer.
- **Live DB migration state is unknown until inspected.** Confirm migrations 0009–0014 and actual table/index state.
- **PHP runtime checks were not run locally.** Lint and test on PHP 8.2+ before production.
- **WhatsApp matching is heuristic.** Tune with real sample messages; establish a reliable false-positive/false-negative acceptance test.
- **No AI response provider exists.** Do not label the responder as AI or promise contextual understanding.
- **Provider costs and policy are external.** Confirm WaAPI plan and applicable WhatsApp terms.
- **Campaigns are currently text-only** and limited to opted-in users in small batches.
- **Reward file sharing is not automatic.** The current user-facing flow downloads a PDF and offers a sharing action; browser support and user action are required.
- **Payment remains test-only.** Production payments require a separate release decision and complete business/compliance readiness.
- **Terms/privacy/legal content is draft copy.** It needs business and professional review.
- **Data retention and deletion policies require a business decision.** WhatsApp messages and customer details are personal information.
- **Admin notifications require the admin interface to be open.** Do not assume background push notifications.
- **LID/phone identity matching can be incomplete.** Phone matching is heuristic and should avoid merging ambiguous customer records.
- **Live API URL and deployment configuration can change.** Check current `vercel.json`, DirectAdmin settings, and hosting dashboard.

## 11. Suggested next work sequence

1. **Establish deployment state:** inspect Vercel deployment and the InterServer API response; do not start by importing schema.
2. **Back up and inspect MariaDB:** establish exactly which 0009–0014 changes are already present.
3. **Run PHP lint/tests:** use PHP 8.2+ locally or on a safe staging host.
4. **Deploy backend and frontend coherently:** ensure frontend origin/API routing and exact allowed origin match.
5. **Validate the WhatsApp trigger matrix:** test brand variants, valid product questions, question phrasing, incidental mention, no-query brand mention, and unrelated chat. Verify conversation capture independently from automated replies.
6. **Test customer/order linkage:** use controlled test contacts and verify existing customer matching and conversion metrics without using real customers unnecessarily.
7. **Test collaborator inventory:** create test collaborator/offer, check shared prize appearance, assign up to quantity, ensure over-assignment is rejected.
8. **Test scratch reveal:** reveal once, reopen, test duplicate requests and PDF behavior.
9. **Test orders/payments/invoices in Test Mode:** verify server-side totals, webhook idempotency, status messages, PDF contents and email separately.
10. **Review privacy and launch readiness:** consent, STOP handling, retention, legal/tax/shipping/refund rules, provider terms and credentials rotation.

## 12. Quick handoff prompt for another AI

When using this file to brief another AI, provide a prompt like:

> Read `PROJECT_CONTEXT.md` and `README.md` first. The project is a React/TypeScript/Vite storefront on Vercel with a PHP 8.2/MariaDB API on InterServer, WaAPI for WhatsApp, and Razorpay restricted to Test Mode. Never inspect or reveal `api/config.php` or `.env.local`. Before editing, inspect the relevant code and live deployment assumptions. Do not blindly import SQL; check existing migration state and back up first. The WhatsApp responder is heuristic/deterministic, not AI. Implement the requested change in the current source, preserve existing behavior and consent/security constraints, then run `npm run build` and report any PHP/live-provider checks that could not be performed.

