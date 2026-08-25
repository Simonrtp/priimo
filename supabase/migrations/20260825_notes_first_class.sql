-- Notes vocales : la note EST la donnée. Les rattachements sont optionnels,
-- 0..n, et peuvent arriver plus tard. Isolation inchangée : agency_id.
-- visibilite 'privee' : lisible uniquement par l'auteur, y compris pour un
-- directeur. Filet applicatif en plus de ce RLS.

-- ---------------------------------------------------------------------------
-- 1) Colonnes voice_notes
-- ---------------------------------------------------------------------------
ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS visibilite text NOT NULL DEFAULT 'agence',
  ADD COLUMN IF NOT EXISTS source_info text,
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'brute',
  ADD COLUMN IF NOT EXISTS ban_id text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS adresse_normalisee text;

ALTER TABLE public.voice_notes
  DROP CONSTRAINT IF EXISTS voice_notes_visibilite_check;
ALTER TABLE public.voice_notes
  ADD CONSTRAINT voice_notes_visibilite_check
  CHECK (visibilite IN ('agence', 'privee'));

ALTER TABLE public.voice_notes
  DROP CONSTRAINT IF EXISTS voice_notes_source_info_check;
ALTER TABLE public.voice_notes
  ADD CONSTRAINT voice_notes_source_info_check
  CHECK (
    source_info IS NULL
    OR source_info IN ('proprietaire', 'gardien', 'voisin', 'tiers', 'agent')
  );

ALTER TABLE public.voice_notes
  DROP CONSTRAINT IF EXISTS voice_notes_statut_check;
ALTER TABLE public.voice_notes
  ADD CONSTRAINT voice_notes_statut_check
  CHECK (statut IN ('brute', 'revue'));

COMMENT ON COLUMN public.voice_notes.visibilite IS
  'agence = toute l''agence ; privee = uniquement l''auteur, même un directeur.';
COMMENT ON COLUMN public.voice_notes.source_info IS
  'Qui a dit ça sur le terrain. Distinct de l''auteur de la note.';
COMMENT ON COLUMN public.voice_notes.statut IS
  'brute = dictée enregistrée ; revue = l''agent a terminé l''écran de propositions.';

UPDATE public.voice_notes
SET statut = 'revue'
WHERE status = 'valide' AND statut = 'brute';

CREATE INDEX IF NOT EXISTS voice_notes_ban_id_idx ON public.voice_notes (agency_id, ban_id)
  WHERE ban_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS voice_notes_visibilite_idx
  ON public.voice_notes (agency_id, visibilite, created_by);

-- ---------------------------------------------------------------------------
-- 2) note_liens — 0..n rattachements, jamais obligatoires
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.note_liens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.voice_notes (id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  entite_type text NOT NULL
    CHECK (entite_type IN ('contact', 'bien', 'lead', 'immeuble')),
  entite_id text NOT NULL,
  confiance text NOT NULL
    CHECK (confiance IN ('certain', 'probable')),
  cree_par text NOT NULL
    CHECK (cree_par IN ('agent', 'extraction', 'reconciliation')),
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, entite_type, entite_id)
);

COMMENT ON TABLE public.note_liens IS
  'Rattachements optionnels d''une note. Une note sans lien est un cas normal.';
COMMENT ON COLUMN public.note_liens.entite_id IS
  'Id de l''entité, ou ban_id si entite_type = immeuble.';

CREATE INDEX IF NOT EXISTS note_liens_entite_idx
  ON public.note_liens (agency_id, entite_type, entite_id);

CREATE INDEX IF NOT EXISTS note_liens_note_idx
  ON public.note_liens (note_id);

-- Rattachements déjà posés sur voice_notes.contact_id : on les recopie,
-- on ne touche pas à la colonne.
INSERT INTO public.note_liens (
  note_id, agency_id, entite_type, entite_id, confiance, cree_par
)
SELECT
  id,
  agency_id,
  'contact',
  contact_id::text,
  'certain',
  'agent'
FROM public.voice_notes
WHERE contact_id IS NOT NULL
ON CONFLICT (note_id, entite_type, entite_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.note_liens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS voice_notes_select_agency ON public.voice_notes;
CREATE POLICY voice_notes_select_agency ON public.voice_notes
  FOR SELECT TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND (
      visibilite = 'agence'
      OR created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS note_liens_select_agency ON public.note_liens;
CREATE POLICY note_liens_select_agency ON public.note_liens
  FOR SELECT TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND EXISTS (
      SELECT 1
      FROM public.voice_notes vn
      WHERE vn.id = note_id
        AND vn.agency_id = public.current_user_agency_id()
        AND (
          vn.visibilite = 'agence'
          OR vn.created_by = auth.uid()
        )
    )
  );

-- Écriture réservée au service_role (routes API). Pas de policy INSERT/UPDATE
-- pour authenticated sur note_liens.

-- Storage : une note privée n'est pas lisible via le bucket non plus.
DROP POLICY IF EXISTS voice_notes_objects_select_agency ON storage.objects;
CREATE POLICY voice_notes_objects_select_agency ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = public.current_user_agency_id()::text
    AND EXISTS (
      SELECT 1
      FROM public.voice_notes vn
      WHERE vn.storage_path = name
        AND vn.agency_id = public.current_user_agency_id()
        AND (
          vn.visibilite = 'agence'
          OR vn.created_by = auth.uid()
        )
    )
  );
