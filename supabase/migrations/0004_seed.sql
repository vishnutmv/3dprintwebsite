-- Safe store defaults only. Product, prize, partner and customer records are
-- intentionally not seeded with fictional production-facing content.
insert into public.settings (setting_key, setting_value) values
  ('storeName', '3D Print Co.'),
  ('supportEmail', 'orders@3dprintco.in'),
  ('supportPhone', '+91 98400 00000'),
  ('city', 'Chennai'),
  ('gstin', ''),
  ('freeShippingOver', '149900'),
  ('shippingFlat', '4900'),
  ('notifyEmail', '')
on conflict (setting_key) do nothing;
