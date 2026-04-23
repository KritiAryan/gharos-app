-- ─── Phase 5 — recipe-images storage bucket ──────────────────────────────────
--
-- Public bucket for Gemini-generated dish photos and manually uploaded images.
-- Service-role writes, anyone reads. Images are referenced by recipes.image_storage_path.
-- Idempotent: safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,                                          -- public read
  5242880,                                       -- 5 MB per file
  array['image/png', 'image/jpeg', 'image/webp'] -- no svg / no gif
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Policies: service_role bypasses RLS anyway, but we add an explicit public-read
-- policy so anon clients can fetch via /storage/v1/object/public/recipe-images/...
-- (Supabase requires a select policy for public buckets to be readable by anon.)
drop policy if exists "recipe-images public read" on storage.objects;
create policy "recipe-images public read"
  on storage.objects for select
  to public
  using (bucket_id = 'recipe-images');

-- Service-role write policy (explicit; service_role already bypasses RLS, but
-- having the policy makes intent clear and keeps the ACL self-documenting).
drop policy if exists "recipe-images service role write" on storage.objects;
create policy "recipe-images service role write"
  on storage.objects for all
  to service_role
  using (bucket_id = 'recipe-images')
  with check (bucket_id = 'recipe-images');

notify pgrst, 'reload schema';
