-- ============================================================
-- Row Level Security
-- The public site reads through the Vercel API (service role),
-- but RLS is still enforced so a leaked anon key can only read
-- active catalogue data and open prizes.
-- Service-role requests bypass RLS by design.
-- ============================================================

alter table public.products        enable row level security;
alter table public.customers       enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.payments        enable row level security;
alter table public.prizes          enable row level security;
alter table public.customer_prizes enable row level security;
alter table public.settings        enable row level security;

-- Catalogue: anyone may read active products only.
drop policy if exists "public read active products" on public.products;
create policy "public read active products"
  on public.products
  for select
  to anon, authenticated
  using (is_active = true);

-- Prizes: only active, still-open prizes are public.
drop policy if exists "public read open prizes" on public.prizes;
create policy "public read open prizes"
  on public.prizes
  for select
  to anon, authenticated
  using (is_active = true and status = 'open');

-- Everything below is server-only. With RLS enabled and no
-- policies, anon/authenticated get no rows and no writes.
-- The service role (used exclusively by /api) bypasses RLS.

-- Defence in depth: revoke direct table privileges from the
-- public API roles. The API uses the service role.
revoke all on public.customers       from anon, authenticated;
revoke all on public.orders          from anon, authenticated;
revoke all on public.order_items     from anon, authenticated;
revoke all on public.payments        from anon, authenticated;
revoke all on public.customer_prizes from anon, authenticated;
revoke all on public.settings        from anon, authenticated;

-- Allow read-only catalogue access for the anon role.
grant select on public.products to anon, authenticated;
grant select on public.prizes to anon, authenticated;
