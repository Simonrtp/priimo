-- Parcelles cadastrales : identifiant (idu) seulement, jamais la géométrie.
-- Les polygones restent dans les tuiles IGN PCI.

-- 1) note_liens accepte le type parcelle (idu en entite_id)
ALTER TABLE public.note_liens
  DROP CONSTRAINT IF EXISTS note_liens_entite_type_check;

ALTER TABLE public.note_liens
  ADD CONSTRAINT note_liens_entite_type_check
  CHECK (entite_type IN ('contact', 'bien', 'lead', 'immeuble', 'parcelle'));

COMMENT ON COLUMN public.note_liens.entite_id IS
  'Id de l''entité, ban_id si entite_type = immeuble, idu PCI si entite_type = parcelle.';

-- 2) Synthèse publique (pipeline métier) — lisible par l'agence, sans agency_id
CREATE TABLE IF NOT EXISTS public.parcelle_synthese (
  idu text PRIMARY KEY,
  code_insee text,
  code_postal text,
  evenements_count integer NOT NULL DEFAULT 0,
  lots integer,
  periode_construction text,
  procedure_en_cours text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.parcelle_synthese IS
  'Synthèse publique d''une parcelle (idu PCI). Pas de géométrie.';

CREATE INDEX IF NOT EXISTS parcelle_synthese_cp_idx
  ON public.parcelle_synthese (code_postal)
  WHERE evenements_count > 0;

CREATE TABLE IF NOT EXISTS public.parcelle_adresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idu text NOT NULL,
  libelle text NOT NULL,
  principale boolean NOT NULL DEFAULT false,
  ban_id text,
  code_postal text,
  nom_commune text
);

CREATE INDEX IF NOT EXISTS parcelle_adresses_idu_idx
  ON public.parcelle_adresses (idu);

CREATE INDEX IF NOT EXISTS parcelle_adresses_ban_idx
  ON public.parcelle_adresses (ban_id)
  WHERE ban_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.parcelle_ventes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idu text NOT NULL,
  date_mutation date NOT NULL,
  prix numeric,
  surface numeric,
  prix_m2 numeric
);

CREATE INDEX IF NOT EXISTS parcelle_ventes_idu_idx
  ON public.parcelle_ventes (idu, date_mutation DESC);

CREATE TABLE IF NOT EXISTS public.parcelle_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idu text NOT NULL,
  date_diag date,
  etiquette text,
  type text
);

CREATE INDEX IF NOT EXISTS parcelle_diagnostics_idu_idx
  ON public.parcelle_diagnostics (idu);

ALTER TABLE public.parcelle_synthese ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelle_adresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelle_ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelle_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parcelle_synthese_select ON public.parcelle_synthese;
CREATE POLICY parcelle_synthese_select ON public.parcelle_synthese
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS parcelle_adresses_select ON public.parcelle_adresses;
CREATE POLICY parcelle_adresses_select ON public.parcelle_adresses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS parcelle_ventes_select ON public.parcelle_ventes;
CREATE POLICY parcelle_ventes_select ON public.parcelle_ventes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS parcelle_diagnostics_select ON public.parcelle_diagnostics;
CREATE POLICY parcelle_diagnostics_select ON public.parcelle_diagnostics
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.parcelle_synthese TO authenticated;
GRANT SELECT ON public.parcelle_adresses TO authenticated;
GRANT SELECT ON public.parcelle_ventes TO authenticated;
GRANT SELECT ON public.parcelle_diagnostics TO authenticated;
