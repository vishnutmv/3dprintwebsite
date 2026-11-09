-- ============================================================
-- Supabase Storage buckets and policies
-- Run after 0002_rls.sql.
--
-- Public read is enabled for catalogue/prize media (the storefront
-- and admin previews need plain public URLs).
-- Writes are intentionally NOT granted to anon/authenticated:
-- admins upload through short-lived signed upload URLs minted by
-- /api/admin/uploads/sign (service role), and deletions go through
-- /api/admin/uploads on the server. The service-role key never
-- reaches the browser.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'products',
    'products',
    true,
    5242880, -- 5 MB
    array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'model/gltf-binary', 'model/gltf+json']
  ),
  (
    'product-videos',
    'product-videos',
    true,
    52428800, -- 50 MB
    array['video/mp4', 'video/webm', 'video/quicktime']
  ),
  (
    'prize-media',
    'prize-media',
    true,
    52428800, -- 50 MB
    array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime']
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read policies.
drop policy if exists "public read product media" on storage.objects;
create policy "public read product media"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id in ('products', 'product-videos', 'prize-media'));

-- No insert/update/delete policies are created for anon or
-- authenticated. Remove any broad policies that may exist from a
-- previous setup so uploads cannot bypass the admin API.
drop policy if exists "authenticated upload media" on storage.objects;
drop policy if exists "authenticated update media" on storage.objects;
drop policy if exists "authenticated delete media" on storage.objects;
drop policy if exists "public upload media" on storage.objects;
