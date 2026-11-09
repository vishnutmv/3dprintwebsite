-- Preserve released prize assignments while allowing a prize to be awarded
-- again. Only one active assignment may exist for a prize at a time.
alter table public.customer_prizes
  add column if not exists released_at timestamptz;

drop index if exists public.uq_customer_prizes_prize;
alter table public.customer_prizes
  drop constraint if exists customer_prizes_prize_id_key;

create unique index if not exists uq_customer_prizes_active_prize
  on public.customer_prizes (prize_id)
  where released_at is null;

create index if not exists idx_customer_prize_history
  on public.customer_prizes (prize_id, assigned_at desc);

create or replace function public.assign_prize_to_customer(
  p_prize_id uuid,
  p_customer_id uuid,
  p_assigned_by text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prize public.prizes;
begin
  select * into v_prize
  from public.prizes
  where id = p_prize_id
  for update;

  if not found or not v_prize.is_active or v_prize.status <> 'open' then
    raise exception 'prize_not_available';
  end if;

  if not exists (
    select 1
    from public.orders
    where customer_id = p_customer_id
      and payment_status = 'paid'
  ) then
    raise exception 'customer_not_eligible';
  end if;

  insert into public.customer_prizes (
    customer_id, prize_id, assigned_by, notification_status, notes
  ) values (
    p_customer_id, p_prize_id, p_assigned_by, 'pending', nullif(p_notes, '')
  );

  update public.prizes
  set status = 'awarded',
      updated_at = now()
  where id = p_prize_id;
end;
$$;

create or replace function public.release_prize_assignment(p_prize_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.prizes
  where id = p_prize_id
  for update;

  if not found then
    raise exception 'prize_not_found';
  end if;

  update public.customer_prizes
  set released_at = now()
  where prize_id = p_prize_id
    and released_at is null;

  update public.prizes
  set status = 'open',
      updated_at = now()
  where id = p_prize_id;
end;
$$;

revoke all on function public.assign_prize_to_customer(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.release_prize_assignment(uuid) from public, anon, authenticated;
