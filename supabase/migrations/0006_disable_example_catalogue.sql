-- Hide rows created by the former demo seed migration. Keep the records for
-- auditability; admins can edit and reactivate them after verifying the data.
update public.products
set is_active = false,
    updated_at = now()
where slug in (
  'series-2-dragon',
  'hex-desk-organiser',
  'gearbox-prototype',
  'faceted-planter',
  'knight-set',
  'filament-bundle',
  'lattice-lamp',
  'modular-desk-riser'
);

update public.prizes
set is_active = false,
    updated_at = now()
where voucher_code in (
  '3DP-PRINTER-2026',
  '3DP-FILAMENT-2026',
  '3DP-CREDIT-2026'
);
