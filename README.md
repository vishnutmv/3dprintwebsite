# 3D Print Co. storefront

React, TypeScript and Vite storefront on Vercel, with a PHP 8.2 API, MariaDB and media files on InterServer shared hosting, and a Razorpay **TEST-mode-only** checkout integration.

## What is implemented

- Product catalogue, product details, cart, checkout and order confirmation.
- Server-priced orders, customer codes, order history, Razorpay signature checks, payment webhooks, and idempotent payment status updates.
- Admin login and protected PHP product, order, customer, prize, settings and media endpoints.
- Manual prize assignment and configurable email/webhook notifications. WhatsApp delivery requires a separately configured provider/relay; a notification is not reported as sent unless a configured provider accepts it.
- Optional marketing consent collected at checkout and stored on the customer record.
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
2. Upload the PHP backend to InterServer's `public_html`: root `.htaccess`; `api/index.php`, `api/.htaccess`, `api/_php/`; and `uploads/.htaccess`. Create `api/config.php` from `api/config.example.php` and upload it alongside `api/index.php`; `api/.htaccess` must remain in place to block web access to the config. Never commit or share the config.
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
- Product and prize media are public-read URLs. Do not upload personal/sensitive customer media to public buckets.

## Validation and known external dependencies

`npm run build` runs the TypeScript checks and creates the static frontend bundle. PHP runtime checks and database/payment/media end-to-end tests must be run on a PHP 8.2+ environment with the required extensions and InterServer configuration. This development computer does not have PHP installed, so PHP API syntax/runtime validation must be completed on InterServer or a local PHP installation before launch. The PHP API uses a local file-based request limiter; confirm the hosting account permits temporary-file writes.

Before production, the client must provide and verify its registered business name/address, tax and invoicing requirements, final terms/privacy/returns policies, real shipping commitments, partner reward rules, customer support details, notification provider credentials and the required consent/retention policy. The current terms page is explicitly a draft, not government-approved legal text.
