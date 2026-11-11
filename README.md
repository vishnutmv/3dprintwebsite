# 3D Print Co. storefront

React, TypeScript and Vite storefront on Vercel, with a PHP 8.2 API, MariaDB and media files on InterServer shared hosting, and a Razorpay **TEST-mode-only** checkout integration.

## What is implemented

- Product catalogue, product details, cart, checkout and order confirmation.
- Server-priced orders, customer codes, order history, Razorpay signature checks, payment webhooks, and idempotent payment status updates.
- Admin login and protected PHP product, order, customer, prize, settings and media endpoints.
- Manual prize assignment and collaborator-sponsored offers share quantity-aware inventory and a private, one-time scratch-to-reveal card. Revealing downloads a PDF; customers can explicitly share it from a supported device/browser.
- WhatsApp enquiries match compact and spaced 3D Print Co. mentions, capture follow-up details, link known customer numbers, and exclude existing customers from cold-lead conversion metrics. Automated answers use a fixed product catalogue reply or the shop link; no AI provider is configured.
- Consent-based, text-only WhatsApp campaigns in admin batches; order and lead conversion insights; computed paid-product trend tags; and payment-confirmed PDF invoice emails/downloads.
- Optional marketing consent collected at checkout and stored on the customer record. A customer can reply `STOP` to disable future campaigns for their matched customer phone.
- MariaDB stores business records. PHP sessions protect admin routes; media files are stored under `uploads/`.

The storefront is not ready to accept real payments: live Razorpay keys are rejected by design. Legal, tax, shipping and refund terms are draft copy and need client/professional review before launch.

## Local client-meeting preview

For a frontend-only walkthrough without the PHP API or database:

1. Add these values to the ignored `.env.local` file:

   ```dotenv
   VITE_DEMO_MODE=true
   VITE_DEMO_ADMIN_EMAIL=admin@3dprintco.in
   VITE_DEMO_ADMIN_PASSWORD=choose-a-local-demo-password
   ```

2. Run `npm run dev` and open the local URL printed by Vite. The preview includes sample catalogue items, customers, orders and rewards; admin edits are stored in that browser's local storage. Checkout creates a clearly labelled local sample order and never accepts payment.
3. This mock is available only in Vite development mode. Never enable it for a public/production build or use real customer data. To restore the original sample data, clear the browser's `3dp-client-demo-v1` local-storage entry.

## Requirements

- Node.js 20 or newer and npm.
- Vercel account and a Git repository for the static frontend.
- InterServer hosting with PHP 8.2+, MariaDB, PDO MySQL, fileinfo, mbstring, outbound HTTPS (`allow_url_fopen`), and Apache `mod_rewrite`/`.htaccess` support.
- Razorpay account with **Test Mode** enabled.
- InterServer account hostname or domain with HTTPS enabled.

## Local setup

1. Install packages:

   ```sh
   npm ci
   ```

2. The browser-facing app has no Supabase environment variables. `api/config.php` contains the private hosting/database/payment configuration and must never be committed.
3. For local API development, create `api/config.php` from `api/config.example.php`, then run PHP's built-in server and Vite in separate terminals:

   ```sh
   php -S 127.0.0.1:8080 api/dev-router.php
   npm run dev
   ```

   Vite proxies `/api/*` to that PHP server. Local PHP and InterServer must have the PDO MySQL, fileinfo and mbstring extensions enabled.
4. Validate the frontend build:

   ```sh
   npm run build
   ```

## Vercel frontend + InterServer backend

The public hostname `https://st89310.ispot.cc` responds over HTTPS, but `/api/settings` returned an InterServer 404 when checked, so the PHP backend still needs to be uploaded. Vercel's generated `*.vercel.app` address can host the frontend without purchasing a domain.

1. In DirectAdmin, import `database/interserver.sql` into the MariaDB database. The schema has no sample products, prizes or customer records.
   For an existing installation, do not re-import the full schema or blindly rerun older migrations. Back up the database, inspect `SHOW COLUMNS FROM prizes`, `SHOW COLUMNS FROM whatsapp_leads`, `SHOW INDEX FROM whatsapp_leads`, and verify whether the collaborator tables are already complete. Apply `migrations/0014_collaborator_gifts_and_enquiry_details.sql` only once, after migrations through 0013 and only if none of its changes are already present. If phpMyAdmin reports a duplicate column, index, or table, stop and inspect the existing schema before continuing.
2. Upload the PHP backend to InterServer's `public_html`: root `.htaccess`; `api/index.php`, `api/.htaccess`, `api/_php/`; and `uploads/.htaccess`. The uploads `.htaccess` allows the production Vercel origin to load GLB models cross-origin; keep its allowed origin in sync if the Vercel production URL changes. Create `api/config.php` from `api/config.example.php` and upload it alongside `api/index.php`; `api/.htaccess` must remain in place to block web access to the config. Never commit or share the config.
3. In `api/config.php` on InterServer, set `site_url` to `https://st89310.ispot.cc`, fill in the database credentials and a strong admin email/password. After Vercel deploys, set `allowed_origins` to an array with the exact production origin, e.g. `['https://your-project.vercel.app']`. Do not use wildcard origins.
4. In DirectAdmin's PHP settings, confirm PHP 8.2+, PDO MySQL, fileinfo, mbstring and outbound HTTPS (`allow_url_fopen`) are enabled. Set `upload_max_filesize` to at least `50M` and `post_max_size` to at least `55M`. Ensure `public_html/uploads/` is writable using the host-recommended permissions, never `777`.
5. Enable HTTPS on InterServer. Test `https://st89310.ispot.cc/api/settings` directly; it must return JSON rather than a hosting 404 before continuing.
6. Put the project in a Git repository and import it into Vercel. `vercel.json` builds the Vite frontend and proxies `/api/*` to InterServer. `.vercelignore` excludes `api/**`, so the old TypeScript/Vercel functions and PHP backend are not deployed to Vercel. Vercel creates a free `*.vercel.app` address.
7. Add that exact Vercel origin to InterServer's `allowed_origins`, then test the Vercel site's `/api/settings`, `/api/products`, admin login, and media upload. API calls are proxied through Vercel; media URLs are served by InterServer.
8. Configure the Razorpay Test Mode webhook to `https://st89310.ispot.cc/api/payments/webhook` and set its secret only in InterServer's `api/config.php`. Back up both MariaDB and `public_html/uploads/`.

The TypeScript files under `api/` and Supabase migrations are historical reference only; the live backend is `api/index.php` on InterServer, and the live database is MariaDB.

## Environment variables

| PHP config key | Scope | Purpose |
|---|---|---|
| `site_url` | Server only | Canonical HTTPS domain used to construct public media URLs |
| `allowed_origins` | Server only | Exact Vercel production origin(s) allowed for protected admin writes |
| `db_host`, `db_name`, `db_user`, `db_password` | Server only | DirectAdmin MariaDB connection details |
| `admin_email`, `admin_password` | Server only | Admin login; use a long, unique password |
| `razorpay_key_id`, `razorpay_key_secret` | Server only | Razorpay Test Mode credentials; key ID must start with `rzp_test_` |
| `razorpay_webhook_secret` | Server only | Verifies Razorpay webhook signatures |
| `resend_api_key`, `notify_from` | Server only, optional | Resend email delivery |
| `notify_webhook_url` | Server only, optional | Trusted notification relay you control |
| `storefront_url` | Server only | Public HTTPS storefront used for prize reveal links |
| `waapi_instance_id`, `waapi_api_token` | Server only, optional | WaAPI outbound customer messages and opt-in campaign sends |

Use a unique, strong admin password. If optional notification credentials are absent, prize/order messages are not delivered and the API reports `not_configured`. A generic webhook is only a transport hook; it is not a WhatsApp integration until connected to and tested with an authorized WhatsApp provider.

## Razorpay Test Mode

1. In the Razorpay dashboard, enable Test Mode and create a test API key pair.
2. Set `razorpay_key_id` (`rzp_test_…`) and `razorpay_key_secret` in `api/config.php`. Never put the secret in a `VITE_` variable.
3. Add a webhook pointing to `https://<your-domain>/api/payments/webhook`, configure a webhook secret, and subscribe to `payment.captured`, `payment.failed`, and `order.paid`. Set it as `razorpay_webhook_secret` in `api/config.php`.
4. Use Razorpay's official test cards/UPI values shown in the Test Mode dashboard/Checkout documentation. No real money is moved. Verify the callback in the browser and webhook delivery in Razorpay's dashboard.
5. Test a declined payment and retry. The order must remain unpaid unless the server verifies a captured/authorized payment and its amount/order.

Do not use live payment details for demo testing.

## Admin and operations

- Open `/admin` and sign in using `admin_email` / `admin_password` from `api/config.php`.
- All `/api/admin/*` routes validate the expiring HttpOnly, SameSite PHP session cookie on the server.
- Add and edit products, manage stock/media, review orders/payments, inspect customer IDs/order histories, and create prizes/vouchers.
- Assign prizes manually. The recipient notification status is recorded; check the status before promising delivery.
- Order status changes send distinct WhatsApp message layouts only when the status actually changes. WaAPI failures and missing configuration are reported in the admin order update.
- **Insights** uses verified paid orders and tracked WhatsApp enquiry conversions. Product trend tags are computed from paid sales; they do not overwrite the manual product badge.
- **Campaigns** only snapshots customers who consented to marketing and have a phone number. Each send action processes up to 3 recipients to limit request duration on shared hosting. Failed messages are shown and are not automatically retried; campaigns are text-only.
- A payment-confirmed order page prepares a PDF invoice and emails it to the checkout email through Resend. The invoice can also be downloaded from the order page. Configure email delivery before relying on invoice email.
- WhatsApp enquiries appear under **WhatsApp Leads**. New enquiries are highlighted in the admin navigation; taking over a lead disables the automatic reply until the lead is reopened.
- Product and prize media are public-read URLs. Do not upload personal/sensitive customer media to public buckets.

## WhatsApp enquiries through WaAPI

The backend can receive WaAPI `message` events and send replies through the WaAPI instance API. It tracks direct chats and saves their WhatsApp chat ID, optional phone number, profile name and message history; duplicate webhook deliveries are ignored. A response is triggered only when an incoming text includes `3dprintco`, `@3dprintco`, or `/3dprintco` followed by a query. Other incoming chats are recorded for admin visibility but do not get an automated reply or follow-up. The admin inbox defaults to **Business enquiries** and can be switched to **All chats**. Triggered enquiries receive a product-and-shop-link reply (up to three active, in-stock products and current prices); this is a fixed automatic message, not an AI-generated answer, and is limited to once per 24 hours per lead. If no admin actually replies within five minutes, one follow-up is sent; a later triggered message starts a new timer. The admin can reply from the lead inbox, orders, or customer records. Messages sent from the connected WhatsApp app are also synced when WaAPI emits their message events. Taking over suppresses the initial automatic reply, but only an actual admin message cancels the five-minute follow-up.

While signed in, the admin polls for new business enquiries and shows an inbox badge and in-panel alert. To receive desktop alerts when the admin tab is in the background, select **Enable desktop alerts** in the admin panel and allow notifications in the browser. The optional email alert is separate and requires the email provider configuration below.

WaAPI is a third-party WhatsApp Web-based provider, not Meta's official Cloud API. Review WaAPI's current billing, security, service terms and WhatsApp policies: using an unofficial automation provider can risk session interruption or restrictions on the WhatsApp number. Do not assume it is free. Campaigns are text-only and must only be sent to customers with recorded marketing consent.

To connect the active WaAPI instance:

1. For an existing MariaDB database, apply migrations in order, skipping any already successfully applied: [`migrations/0009_whatsapp_leads.sql`](./migrations/0009_whatsapp_leads.sql), [`migrations/0010_waapi_leads.sql`](./migrations/0010_waapi_leads.sql), [`migrations/0011_whatsapp_conversations.sql`](./migrations/0011_whatsapp_conversations.sql), [`migrations/0012_whatsapp_business_triggers.sql`](./migrations/0012_whatsapp_business_triggers.sql), then [`migrations/0013_rewards_campaigns_invoices.sql`](./migrations/0013_rewards_campaigns_invoices.sql). If phpMyAdmin reports a duplicate column, stop and inspect the existing table/columns before retrying; do not re-run the whole migration blindly. For a fresh import, `database/interserver.sql` includes the current schema.
2. Generate long random webhook and cron secrets (each at least 32 characters). On InterServer, add these values to the private `api/config.php`; keep the API token and secrets server-side, never in frontend code or chat:

   ```php
   'whatsapp_business_number' => 'COUNTRYCODEANDNUMBER',
   'waapi_instance_id' => 'YOUR_INSTANCE_ID',
   'waapi_api_token' => 'YOUR_WAAPI_TOKEN',
   'waapi_webhook_secret' => 'YOUR_RANDOM_32_PLUS_CHARACTER_SECRET',
   'waapi_cron_secret' => 'A_DIFFERENT_RANDOM_32_PLUS_CHARACTER_SECRET',
   'storefront_url' => 'https://YOUR-PUBLIC-STOREFRONT',
   ```

   The business number must be international digits only, without `+`. Use the actual instance ID from the WaAPI instance page. Keep the existing PHP array syntax and do not replace unrelated config values.
3. Configure the WaAPI instance webhook URL as `https://<API-host>/api/whatsapp/waapi/<YOUR_RANDOM_SECRET>` and subscribe to **only the `message` event** initially. Do not include the secret in screenshots or share it publicly. WaAPI documents its webhook as a POST with an `event`, `instanceId`, and `data.message`; this project also checks the configured instance ID. The secret URL is necessary because WaAPI webhook requests do not include a documented signature header.
4. Configure `resend_api_key` and `notify_from` in `api/config.php` to email the admin on a new lead. The lead still appears in the admin panel if email is unavailable; failed email alerts are logged.
5. In DirectAdmin, add a cron job that runs every minute with this command, replacing the secret with the value of `waapi_cron_secret`:

   ```sh
   curl -fsS -X POST 'https://<API-host>/api/whatsapp/waapi-followups/<YOUR_CRON_SECRET>' >/dev/null
   ```

   This is required for the single follow-up after five minutes. If you do not want scheduled follow-ups, do not add this cron job.
6. Deploy the changed PHP backend files and frontend. Confirm the storefront `/api/settings` response includes a non-empty `whatsappContactUrl`, then send a test enquiry from a separate WhatsApp account. Check that the product reply has current prices and that the lead appears in `/admin/leads`. Open **Chat from admin** to view the saved conversation and reply. Test replying from the admin panel and from the connected WhatsApp phone; both should appear in the conversation.
7. Test a sandbox order and verify the payment confirmation message and invoice email, update its status once and verify the matching status template, then award a test prize and open its scratch-card link. In admin, verify **Insights** uses paid orders and **Campaigns** only contains opted-in customers. Send campaign batches only after you are ready to message those customers.

The lead inbox stores the latest message per WhatsApp chat ID, including WhatsApp privacy-preserving LIDs. Such IDs may not have a directly openable `wa.me` link; WaAPI can still reply to the incoming chat ID. A message from a person after a lead was closed reopens the lead. Apply the project's privacy/retention policy before production use.

## Validation and known external dependencies

`npm run build` runs the TypeScript checks and creates the static frontend bundle. PHP runtime checks and database/payment/media end-to-end tests must be run on a PHP 8.2+ environment with the required extensions and InterServer configuration. This development computer does not have PHP installed, so PHP API syntax/runtime validation must be completed on InterServer or a local PHP installation before launch. The PHP API uses a local file-based request limiter; confirm the hosting account permits temporary-file writes.

Before production, the client must provide and verify its registered business name/address, tax and invoicing requirements, final terms/privacy/returns policies, real shipping commitments, partner reward rules, customer support details, notification provider credentials and the required consent/retention policy. The current terms page is explicitly a draft, not government-approved legal text.
