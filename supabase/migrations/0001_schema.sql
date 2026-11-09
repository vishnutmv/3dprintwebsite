-- ============================================================
-- 3D Print Co. — Supabase PostgreSQL schema
-- Run this first in the Supabase SQL editor (or `supabase db push`).
-- All money columns are integer paise (INR * 100).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Shared updated_at trigger
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Products
-- ------------------------------------------------------------
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  description    text not null default '',
  price          integer not null check (price > 0),
  mrp            integer check (mrp is null or mrp >= price),
  category       text not null default 'Uncategorised',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  images         text[] not null default '{}'::text[],
  video_url      text,
  specifications jsonb not null default '{}'::jsonb,
  -- Presentation columns preserved from the original storefront.
  material       text not null default '',
  dimensions     text not null default '',
  print_time     text not null default '',
  badge          text,
  variant        text not null default 'lattice',
  accent         text not null default '#a78bfa',
  model_url      text,
  rating         numeric(3, 2) not null default 0 check (rating >= 0 and rating <= 5),
  reviews        integer not null default 0 check (reviews >= 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_products_active_created
  on public.products (is_active, created_at desc);
create index if not exists idx_products_category
  on public.products (category);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Customers
-- ------------------------------------------------------------
create table if not exists public.customers (
  id               uuid primary key default gen_random_uuid(),
  customer_code    text not null unique
    default ('3DP-' || upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4))),
  full_name        text not null,
  email            text,
  phone            text not null,
  delivery_address text,
  city             text,
  state            text,
  postal_code      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists uq_customers_email
  on public.customers (lower(email)) where email is not null;
create unique index if not exists uq_customers_phone
  on public.customers (phone);

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Orders
-- ------------------------------------------------------------
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        text not null unique
    default ('ORD-' || upper(substr(md5(random()::text), 1, 8))),
  customer_id         uuid not null references public.customers (id) on delete restrict,
  subtotal            integer not null check (subtotal >= 0),
  shipping_charge     integer not null default 0 check (shipping_charge >= 0),
  total_amount        integer not null check (total_amount > 0),
  payment_status      text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  order_status        text not null default 'pending'
    check (order_status in ('pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled')),
  razorpay_order_id   text unique,
  razorpay_payment_id text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_orders_created on public.orders (created_at desc);
create index if not exists idx_orders_customer on public.orders (customer_id);
create index if not exists idx_orders_payment_status on public.orders (payment_status);
create index if not exists idx_orders_order_status on public.orders (order_status);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Order items (product name + price snapshot at purchase time)
-- ------------------------------------------------------------
create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  product_name  text not null,
  quantity      integer not null check (quantity > 0),
  unit_price    integer not null check (unit_price >= 0),
  total_price   integer not null check (total_price >= 0),
  image_url     text,
  model_url     text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items (order_id);

-- ------------------------------------------------------------
-- Payments
-- ------------------------------------------------------------
create table if not exists public.payments (
  id                         uuid primary key default gen_random_uuid(),
  order_id                   uuid not null references public.orders (id) on delete cascade,
  gateway                    text not null default 'razorpay',
  gateway_order_id           text,
  gateway_payment_id         text,
  amount                     integer not null check (amount > 0),
  currency                   text not null default 'INR',
  status                     text not null default 'created'
    check (status in ('created', 'pending', 'paid', 'failed', 'refunded')),
  payment_signature_verified boolean not null default false,
  raw_response               jsonb,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create unique index if not exists uq_payments_order on public.payments (order_id);
create unique index if not exists uq_payments_gateway_payment
  on public.payments (gateway_payment_id) where gateway_payment_id is not null;
create index if not exists idx_payments_gateway_order
  on public.payments (gateway_order_id) where gateway_order_id is not null;

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Prizes / vouchers
-- ------------------------------------------------------------
create table if not exists public.prizes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null default '',
  prize_type   text not null default 'regular'
    check (prize_type in ('bumper', 'mega', 'regular', 'consolation', 'voucher')),
  voucher_code text unique,
  worth        integer not null default 0 check (worth >= 0),
  sponsor      text not null default '',
  cycle        text not null default '',
  status       text not null default 'open'
    check (status in ('open', 'awarded', 'claimed')),
  media_urls   text[] not null default '{}'::text[],
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_prizes_status on public.prizes (status, is_active);

drop trigger if exists trg_prizes_updated_at on public.prizes;
create trigger trg_prizes_updated_at
  before update on public.prizes
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Customer prize assignments (manual only)
-- ------------------------------------------------------------
create table if not exists public.customer_prizes (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references public.customers (id) on delete cascade,
  prize_id            uuid not null unique references public.prizes (id) on delete cascade,
  assigned_by         text not null default 'admin',
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed', 'not_configured')),
  assigned_at         timestamptz not null default now(),
  notes               text
);

create index if not exists idx_customer_prizes_customer
  on public.customer_prizes (customer_id, assigned_at desc);

-- ------------------------------------------------------------
-- Settings (key/value)
-- ------------------------------------------------------------
create table if not exists public.settings (
  id            uuid primary key default gen_random_uuid(),
  setting_key   text not null unique,
  setting_value text not null default '',
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Atomic, idempotent payment confirmation
-- ------------------------------------------------------------
create or replace function public.mark_order_paid(
  p_razorpay_order_id text,
  p_razorpay_payment_id text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order
  from public.orders
  where razorpay_order_id = p_razorpay_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  -- Idempotent: a repeated callback must not decrement stock twice.
  if v_order.payment_status = 'paid' then
    return v_order;
  end if;

  update public.payments
     set status = 'paid',
         gateway_payment_id = p_razorpay_payment_id,
         payment_signature_verified = true,
         updated_at = now()
   where order_id = v_order.id;

  update public.products p
     set stock_quantity = greatest(0, p.stock_quantity - oi.quantity),
         updated_at = now()
    from public.order_items oi
   where oi.order_id = v_order.id
     and oi.product_id = p.id;

  update public.orders
     set payment_status = 'paid',
         razorpay_payment_id = p_razorpay_payment_id,
         order_status = case when order_status = 'pending' then 'confirmed' else order_status end,
         updated_at = now()
   where id = v_order.id
   returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.mark_order_paid(text, text) from public;
revoke all on function public.mark_order_paid(text, text) from anon, authenticated;

-- Record a failed payment without touching a previously paid order.
create or replace function public.mark_order_payment_failed(
  p_razorpay_order_id text,
  p_razorpay_payment_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order
  from public.orders
  where razorpay_order_id = p_razorpay_order_id
  for update;

  if not found or v_order.payment_status = 'paid' then
    return;
  end if;

  update public.payments
     set status = 'failed',
         gateway_payment_id = coalesce(p_razorpay_payment_id, gateway_payment_id),
         updated_at = now()
   where order_id = v_order.id;

  update public.orders
     set payment_status = 'failed',
         updated_at = now()
   where id = v_order.id;
end;
$$;

revoke all on function public.mark_order_payment_failed(text, text) from public;
revoke all on function public.mark_order_payment_failed(text, text) from anon, authenticated;
