-- Profil négociateur : anniversaire (jour/mois), consentement équipe, avatar.
-- Complète la prise en main v2 (écrans salut → final).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birthday_month smallint
    CHECK (birthday_month IS NULL OR (birthday_month >= 1 AND birthday_month <= 12)),
  ADD COLUMN IF NOT EXISTS birthday_day smallint
    CHECK (birthday_day IS NULL OR (birthday_day >= 1 AND birthday_day <= 31)),
  ADD COLUMN IF NOT EXISTS birthday_visible_team boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.profiles.birthday_month IS
  'Mois d''anniversaire (1–12). Pas d''année : donnée minimale.';
COMMENT ON COLUMN public.profiles.birthday_day IS
  'Jour d''anniversaire (1–31).';
COMMENT ON COLUMN public.profiles.birthday_visible_team IS
  'Si true, l''agence voit une carte le jour J. Consentement séparé de l''enregistrement.';
COMMENT ON COLUMN public.profiles.avatar_url IS
  'URL publique de l''avatar (illustration /avatars/… ou photo uploadée).';

-- Les deux champs jour/mois vont ensemble.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_birthday_pair;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_birthday_pair CHECK (
    (birthday_month IS NULL AND birthday_day IS NULL)
    OR (birthday_month IS NOT NULL AND birthday_day IS NOT NULL)
  );

-- Bucket avatars (photos personnelles). Les illustrations sont en /public/avatars/.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS avatars_read_public ON storage.objects;
CREATE POLICY avatars_read_public ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );
