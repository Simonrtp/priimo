-- Import de contacts annulable.
--
-- 1. contact_imports : un import (un fichier déposé), ses compteurs et, pour
--    chaque fiche existante qu'il a complétée, les valeurs d'avant et d'après.
-- 2. contacts.import_id : l'import qui a créé la fiche.
--
-- « Annuler cet import » (7 jours) retire les fiches créées que personne n'a
-- touchées depuis, et remet les fiches complétées comme avant, champ par champ,
-- tant que le champ n'a pas été modifié depuis.
--
-- Le code lit et écrit ces colonnes seulement si elles existent : tant que la
-- migration n'est pas passée, l'import marche, sans bouton « Annuler ».

-- ---------------------------------------------------------------------------
-- 1. contact_imports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  nom_fichier text NOT NULL DEFAULT '',
  format text NOT NULL DEFAULT 'tableur'
    CHECK (format IN ('tableur', 'vcard')),
  crees integer NOT NULL DEFAULT 0,
  completes integer NOT NULL DEFAULT 0,
  deja_presents integer NOT NULL DEFAULT 0,
  ecartes integer NOT NULL DEFAULT 0,
  -- [{ "id": uuid, "avant": { colonne: valeur }, "apres": { colonne: valeur } }]
  completions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  termine_le timestamptz NOT NULL DEFAULT now(),
  annule_le timestamptz NULL
);

CREATE INDEX IF NOT EXISTS contact_imports_auteur_idx
  ON public.contact_imports (created_by, created_at DESC);

COMMENT ON TABLE public.contact_imports IS
  'Un fichier de contacts importé : compteurs et complétions, pour pouvoir l''annuler.';

ALTER TABLE public.contact_imports ENABLE ROW LEVEL SECURITY;

-- Chacun ne voit et n'annule que ses propres imports.
DROP POLICY IF EXISTS contact_imports_select_soi ON public.contact_imports;
CREATE POLICY contact_imports_select_soi
  ON public.contact_imports
  FOR SELECT
  TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS contact_imports_insert_soi ON public.contact_imports;
CREATE POLICY contact_imports_insert_soi
  ON public.contact_imports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS contact_imports_update_soi ON public.contact_imports;
CREATE POLICY contact_imports_update_soi
  ON public.contact_imports
  FOR UPDATE
  TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND created_by = (SELECT auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. contacts.import_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS import_id uuid NULL
  REFERENCES public.contact_imports (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contacts_import_id_idx
  ON public.contacts (import_id) WHERE import_id IS NOT NULL;

COMMENT ON COLUMN public.contacts.import_id IS
  'Import de fichier qui a créé la fiche (annulable 7 jours).';
