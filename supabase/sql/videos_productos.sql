-- Videos de productos (hasta 3 por producto, máx. 20 MB cada uno) en el bucket
-- público "videos". Solo el admin los sube, cambia o borra.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.
alter table public.productos add column if not exists videos text[] default '{}';
alter table public.productos drop constraint if exists productos_videos_max,
  add constraint productos_videos_max check (videos is null or cardinality(videos) <= 3);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 20971520, array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'])
on conflict (id) do nothing;
create policy videos_admin on storage.objects for all to authenticated
  using (bucket_id = 'videos' and (select public.tiene_rol('admin')))
  with check (bucket_id = 'videos' and (select public.tiene_rol('admin')));
