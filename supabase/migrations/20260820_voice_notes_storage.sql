-- Stockage des dictées terrain.
--
-- CES FICHIERS CONTIENNENT DES DONNÉES PERSONNELLES (noms, numéros, situations).
-- Le bucket est PRIVÉ. Aucune URL publique n'est jamais générée par l'application :
-- la lecture passe exclusivement par une URL signée à durée limitée, produite
-- côté serveur après vérification que la note appartient à l'agence de l'agent.
--
-- Défense en profondeur, trois couches :
--   1. bucket public = false        → getPublicUrl ne renvoie rien d'exploitable
--   2. policies storage.objects     → un client authentifié ne lit que son agence
--   3. route API + URL signée 120 s → le chemin n'est jamais exposé au navigateur

-- ---------------------------------------------------------------------------
-- 1) Bucket privé
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  false,
  26214400, -- 25 Mo : largement au-dessus d'une dictée de quelques minutes en Opus
  ARRAY['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav']
)
ON CONFLICT (id) DO UPDATE
  SET public = false, -- re-force la confidentialité si le bucket a été créé à la main
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2) Policies storage.objects
-- ---------------------------------------------------------------------------
-- Convention de chemin : '{agency_id}/{voice_note_id}.webm'
-- Le premier segment porte le contrôle d'accès.

DROP POLICY IF EXISTS voice_notes_objects_select_agency ON storage.objects;
CREATE POLICY voice_notes_objects_select_agency ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = public.current_user_agency_id()::text
  );

-- Pas de policy INSERT / UPDATE / DELETE pour `authenticated` : l'écriture et la
-- suppression sont réservées au service_role, via les routes API qui vérifient
-- l'agence. Un navigateur compromis ne peut donc rien déposer dans le bucket.

DROP POLICY IF EXISTS voice_notes_objects_insert_authenticated ON storage.objects;
DROP POLICY IF EXISTS voice_notes_objects_update_authenticated ON storage.objects;
DROP POLICY IF EXISTS voice_notes_objects_delete_authenticated ON storage.objects;

-- ---------------------------------------------------------------------------
-- 3) Contrôle
-- ---------------------------------------------------------------------------
-- Doit renvoyer public = false :
--   SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'voice-notes';
--
-- Doit renvoyer la seule policy SELECT ci-dessus :
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND policyname LIKE 'voice_notes%';
