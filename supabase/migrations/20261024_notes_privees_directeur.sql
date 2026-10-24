-- Le directeur lit toutes les notes de l'agence, y compris les privées.
-- Un collaborateur ne lit toujours pas les notes privées des autres.

DROP POLICY IF EXISTS voice_notes_select_agency ON public.voice_notes;
CREATE POLICY voice_notes_select_agency ON public.voice_notes
  FOR SELECT TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (
      visibilite = 'agence'
      OR created_by = (SELECT auth.uid())
      OR (SELECT public.current_user_role()) = 'directeur'
    )
  );

DROP POLICY IF EXISTS note_liens_select_agency ON public.note_liens;
CREATE POLICY note_liens_select_agency ON public.note_liens
  FOR SELECT TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND EXISTS (
      SELECT 1
      FROM public.voice_notes vn
      WHERE vn.id = note_id
        AND vn.agency_id = (SELECT public.current_user_agency_id())
        AND (
          vn.visibilite = 'agence'
          OR vn.created_by = (SELECT auth.uid())
          OR (SELECT public.current_user_role()) = 'directeur'
        )
    )
  );

DROP POLICY IF EXISTS voice_notes_objects_select_agency ON storage.objects;
CREATE POLICY voice_notes_objects_select_agency ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = (SELECT public.current_user_agency_id())::text
    AND EXISTS (
      SELECT 1
      FROM public.voice_notes vn
      WHERE vn.storage_path = name
        AND vn.agency_id = (SELECT public.current_user_agency_id())
        AND (
          vn.visibilite = 'agence'
          OR vn.created_by = (SELECT auth.uid())
          OR (SELECT public.current_user_role()) = 'directeur'
        )
    )
  );

COMMENT ON COLUMN public.voice_notes.visibilite IS
  'agence : toute l''agence. privee : l''auteur, et le directeur.';
