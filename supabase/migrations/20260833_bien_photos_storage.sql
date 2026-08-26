-- Photos de biens destinées à la fiche, à la liste et à l'export d'annonce.
-- Bucket PUBLIC : les URL https partent vers les portails. Chemin
-- '{agency_id}/{uuid}.jpg' — un navigateur ne peut pas écrire (service_role).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bien-photos',
  'bien-photos',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS bien_photos_objects_select_agency ON storage.objects;
CREATE POLICY bien_photos_objects_select_agency ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bien-photos'
    AND (storage.foldername(name))[1] = public.current_user_agency_id()::text
  );

DROP POLICY IF EXISTS bien_photos_objects_insert_authenticated ON storage.objects;
DROP POLICY IF EXISTS bien_photos_objects_update_authenticated ON storage.objects;
DROP POLICY IF EXISTS bien_photos_objects_delete_authenticated ON storage.objects;
