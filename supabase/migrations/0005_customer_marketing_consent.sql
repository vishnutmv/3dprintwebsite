-- Store an explicit, optional marketing consent with each customer.
alter table public.customers
  add column if not exists marketing_opt_in boolean not null default false;
