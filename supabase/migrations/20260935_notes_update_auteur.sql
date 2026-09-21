-- L'auteur peut enregistrer visibilité et source depuis l'écran de revue.
-- L'écriture passait uniquement par service_role : un PATCH authentifié
-- tombait sans policy UPDATE.
--
-- `transcript_original` (20260834) n'est pas encore partout : le PATCH
-- la demandait au SELECT et échouait avant même d'écrire visibilité / source.

ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS transcript_original text;

COMMENT ON COLUMN public.voice_notes.transcript_original IS
  'Transcript tel que transcrit. Null tant que l''agent n''a pas corrigé.';

DROP POLICY IF EXISTS voice_notes_update_author ON public.voice_notes;
CREATE POLICY voice_notes_update_author ON public.voice_notes
  FOR UPDATE TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND created_by = (SELECT auth.uid())
  );
