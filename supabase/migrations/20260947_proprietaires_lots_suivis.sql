-- 1) Propriétaires personnes morales, lot par lot, regroupés par parcelle.
--
-- Fichier des locaux des personnes morales (DGFiP, Licence Ouverte) importé
-- par scripts/importer-proprietaires-lots.ts. La BDNB ne dit que « telle SCI
-- est propriétaire dans ce bâtiment » ; ici on sait combien de lots elle
-- détient et à quels étages. Jamais de particulier. Donnée publique, lue par
-- le serveur seulement.

CREATE TABLE IF NOT EXISTS public.parcelle_proprietaires (
  parcelle_id text NOT NULL CHECK (parcelle_id ~ '^[0-9A-Z]{14}$'),
  siren text NOT NULL DEFAULT '',
  denomination text NOT NULL,
  forme text,
  groupe smallint,
  droit text NOT NULL DEFAULT 'P',
  nb_lots integer NOT NULL CHECK (nb_lots > 0),
  niveaux smallint[] NOT NULL DEFAULT '{}',
  millesime smallint NOT NULL,
  PRIMARY KEY (parcelle_id, siren, denomination, droit)
);

-- Future couche carte « immeubles détenus par des SCI ».
CREATE INDEX IF NOT EXISTS parcelle_proprietaires_sci_idx
  ON public.parcelle_proprietaires (parcelle_id) WHERE forme = 'SCI';

ALTER TABLE public.parcelle_proprietaires ENABLE ROW LEVEL SECURITY;

-- 2) Immeubles suivis par un agent.
--
-- Un nouveau DPE, une vente ou un audit énergétique sur la parcelle devient
-- une proposition dans sa boîte « À valider » (cron quotidien). Chacun ne
-- voit et ne gère que ses propres suivis.

CREATE TABLE IF NOT EXISTS public.immeubles_suivis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parcelle_id text NOT NULL CHECK (parcelle_id ~ '^[0-9A-Z]{14}$'),
  ban_id text,
  libelle text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, parcelle_id)
);

CREATE INDEX IF NOT EXISTS immeubles_suivis_agency_idx ON public.immeubles_suivis (agency_id);

ALTER TABLE public.immeubles_suivis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS immeubles_suivis_select_soi ON public.immeubles_suivis;
CREATE POLICY immeubles_suivis_select_soi ON public.immeubles_suivis
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT current_user_agency_id()) AND profile_id = auth.uid());

DROP POLICY IF EXISTS immeubles_suivis_insert_soi ON public.immeubles_suivis;
CREATE POLICY immeubles_suivis_insert_soi ON public.immeubles_suivis
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = (SELECT current_user_agency_id()) AND profile_id = auth.uid());

DROP POLICY IF EXISTS immeubles_suivis_delete_soi ON public.immeubles_suivis;
CREATE POLICY immeubles_suivis_delete_soi ON public.immeubles_suivis
  FOR DELETE TO authenticated
  USING (agency_id = (SELECT current_user_agency_id()) AND profile_id = auth.uid());

-- 3) Nouveau type de proposition : ce qui arrive sur un immeuble suivi.

ALTER TABLE public.agency_actions DROP CONSTRAINT IF EXISTS agency_actions_kind_check;
ALTER TABLE public.agency_actions
  ADD CONSTRAINT agency_actions_kind_check
  CHECK (kind = ANY (ARRAY[
    'rapprochement_inverse'::text,
    'veille_dpe'::text,
    'veille_mutation'::text,
    'compte_rendu_mandat'::text,
    'engagement_note'::text,
    'estimation_dormante'::text,
    'immeuble_suivi'::text
  ]));
