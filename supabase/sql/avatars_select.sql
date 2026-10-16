-- Fotos de perfil: faltaba el permiso de lectura sobre la carpeta propia.
-- Subir con "reemplazar si existe" (upsert) necesita INSERT + SELECT + UPDATE;
-- sin SELECT, Storage respondía 400 y la foto no subía.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.
create policy avatars_ver_propias on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
