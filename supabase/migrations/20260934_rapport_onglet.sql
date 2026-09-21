-- Modèle de rapport d'agence, message d'envoi, versions figées.

-- ---------------------------------------------------------------------------
-- 1) Message d'e-mail par défaut (agence)
-- ---------------------------------------------------------------------------
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS rapport_email_modele text;

COMMENT ON COLUMN public.agencies.rapport_email_modele IS
  'Texte proposé à l''agent avant l''envoi de l''avis de valeur. NULL = texte Priimo.';

-- ---------------------------------------------------------------------------
-- 2) Premier assemblage du rapport (pour ne pas réappliquer le modèle)
-- ---------------------------------------------------------------------------
ALTER TABLE public.agency_estimations
  ADD COLUMN IF NOT EXISTS rapport_compose_at timestamptz;

COMMENT ON COLUMN public.agency_estimations.rapport_compose_at IS
  'Premier assemblage du rapport (modèle d''agence ou page ajoutée à la main).';

-- ---------------------------------------------------------------------------
-- 3) Modèle ordonné : pages de bibliothèque ou pages produites depuis le dossier
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_rapport_modele (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  source text NOT NULL CHECK (source IN ('bibliotheque', 'generee')),
  bibliotheque_id uuid REFERENCES public.agency_rapport_pages (id) ON DELETE CASCADE,
  kind_generee text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_rapport_modele_slot_check CHECK (
    (source = 'bibliotheque' AND bibliotheque_id IS NOT NULL AND kind_generee IS NULL)
    OR (
      source = 'generee'
      AND bibliotheque_id IS NULL
      AND kind_generee IN ('couverture', 'comparables', 'prix')
    )
  )
);

CREATE INDEX IF NOT EXISTS agency_rapport_modele_agency_pos_idx
  ON public.agency_rapport_modele (agency_id, position, created_at);

ALTER TABLE public.agency_rapport_modele ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_rapport_modele_select ON public.agency_rapport_modele;
CREATE POLICY agency_rapport_modele_select ON public.agency_rapport_modele
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS agency_rapport_modele_insert ON public.agency_rapport_modele;
CREATE POLICY agency_rapport_modele_insert ON public.agency_rapport_modele
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS agency_rapport_modele_update ON public.agency_rapport_modele;
CREATE POLICY agency_rapport_modele_update ON public.agency_rapport_modele
  FOR UPDATE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()))
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS agency_rapport_modele_delete ON public.agency_rapport_modele;
CREATE POLICY agency_rapport_modele_delete ON public.agency_rapport_modele
  FOR DELETE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

-- ---------------------------------------------------------------------------
-- 4) Envois figés — le client lit la version envoyée, pas le rapport vivant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estimation_rapport_envois (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimation_id uuid NOT NULL REFERENCES public.agency_estimations (id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  destinataire text NOT NULL,
  message text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  pdf_path text NOT NULL,
  bien_label text,
  agence_nom text NOT NULL,
  agent_nom text,
  envoye_at timestamptz NOT NULL DEFAULT now(),
  premier_vu_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS estimation_rapport_envois_est_idx
  ON public.estimation_rapport_envois (estimation_id, envoye_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS estimation_rapport_envois_est_version_idx
  ON public.estimation_rapport_envois (estimation_id, version);

ALTER TABLE public.estimation_rapport_envois ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estimation_rapport_envois_select ON public.estimation_rapport_envois;
CREATE POLICY estimation_rapport_envois_select ON public.estimation_rapport_envois
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS estimation_rapport_envois_insert ON public.estimation_rapport_envois;
CREATE POLICY estimation_rapport_envois_insert ON public.estimation_rapport_envois
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));
