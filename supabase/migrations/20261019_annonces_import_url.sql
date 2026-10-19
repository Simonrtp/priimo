-- Ajouter une annonce par son URL (panneau Annonces de la Prospection).
--
-- 1. annonces.origine : vue par la veille, ou collée par un agent.
-- 2. annonces_agences : les annonces qu'une agence a ajoutées à la main. Elle
--    les voit même hors de ses codes postaux ; deux agences peuvent ajouter
--    la même annonce.
-- 3. annonces_imports : chaque URL collée. Le résultat (colonnes `annonces`
--    déjà localisées + photos) attend que l'agent l'ajoute. Les portails que
--    nos serveurs ne lisent pas (PAP, SeLoger) restent `en_attente` jusqu'à
--    ce que le PC de la veille les lise (priimo-pipeline/scripts/lire_imports.py).
-- 4. annonces_suivies : la cloche « Suivre » d'une annonce, par agent.
--
-- Écriture des annonces, liens et imports : routes serveur (service role) et
-- pipeline. Suivis : l'agent lui-même (RLS). Lecture : RLS.

-- ---------------------------------------------------------------------------
-- 1. annonces
-- ---------------------------------------------------------------------------
ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'veille';

ALTER TABLE public.annonces DROP CONSTRAINT IF EXISTS annonces_origine_check;
ALTER TABLE public.annonces
  ADD CONSTRAINT annonces_origine_check CHECK (origine IN ('veille', 'manuelle'));

-- Portails des URL collées : Le Figaro Immobilier, et tout le reste.
ALTER TABLE public.annonces DROP CONSTRAINT IF EXISTS annonces_portail_check;
ALTER TABLE public.annonces
  ADD CONSTRAINT annonces_portail_check
  CHECK (portail IN ('seloger', 'pap', 'leboncoin', 'bienici', 'logicimmo', 'figaro', 'autre'));

COMMENT ON COLUMN public.annonces.origine IS
  'veille = vue par le pipeline dans un territoire ; manuelle = URL collée par un agent.';

-- ---------------------------------------------------------------------------
-- 2. annonces_agences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.annonces_agences (
  annonce_id uuid NOT NULL REFERENCES public.annonces (id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  ajoutee_par uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (annonce_id, agency_id)
);

CREATE INDEX IF NOT EXISTS annonces_agences_agency_idx ON public.annonces_agences (agency_id);

COMMENT ON TABLE public.annonces_agences IS
  'Annonces ajoutées à la main par une agence (URL collée) : visibles par elle même hors de ses codes postaux.';

ALTER TABLE public.annonces_agences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS annonces_agences_select_agence ON public.annonces_agences;
CREATE POLICY annonces_agences_select_agence
  ON public.annonces_agences
  FOR SELECT
  TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

-- Lecture des annonces : le territoire de l'agence, plus celles qu'elle a ajoutées.
DROP POLICY IF EXISTS annonces_select_agency_cp ON public.annonces;
CREATE POLICY annonces_select_agency_cp
  ON public.annonces
  FOR SELECT
  TO authenticated
  USING (
    code_postal = ANY (
      COALESCE(
        (
          SELECT a.codes_postaux
          FROM public.agencies a
          WHERE a.id = (SELECT public.current_user_agency_id())
        ),
        '{}'::text[]
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.annonces_agences aa
      WHERE aa.annonce_id = annonces.id
        AND aa.agency_id = (SELECT public.current_user_agency_id())
    )
  );

-- ---------------------------------------------------------------------------
-- 3. annonces_imports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.annonces_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  url text NOT NULL,
  portail text NOT NULL,
  id_portail text,
  statut text NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'en_cours', 'lue', 'echec')),
  -- Colonnes de public.annonces, localisation comprise, + "photos" (URLs).
  resultat jsonb,
  erreur text,
  annonce_id uuid REFERENCES public.annonces (id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  lue_le timestamptz
);

CREATE INDEX IF NOT EXISTS annonces_imports_attente_idx
  ON public.annonces_imports (cree_le) WHERE statut = 'en_attente';
CREATE INDEX IF NOT EXISTS annonces_imports_profile_idx
  ON public.annonces_imports (profile_id, cree_le DESC);

COMMENT ON TABLE public.annonces_imports IS
  'URL d''annonce collée par un agent : file de lecture (PC de la veille) et résultat localisé avant ajout.';

ALTER TABLE public.annonces_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS annonces_imports_select_soi ON public.annonces_imports;
CREATE POLICY annonces_imports_select_soi
  ON public.annonces_imports
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    AND agency_id = (SELECT public.current_user_agency_id())
  );

-- ---------------------------------------------------------------------------
-- 4. annonces_suivies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.annonces_suivies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id uuid NOT NULL REFERENCES public.annonces (id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  cree_le timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT annonces_suivies_unique UNIQUE (annonce_id, profile_id)
);

CREATE INDEX IF NOT EXISTS annonces_suivies_annonce_idx ON public.annonces_suivies (annonce_id);

COMMENT ON TABLE public.annonces_suivies IS
  'Cloche « Suivre » d''une annonce : baisse de prix et retrait notifiés à l''agent, quel que soit le vendeur.';

ALTER TABLE public.annonces_suivies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS annonces_suivies_select_soi ON public.annonces_suivies;
CREATE POLICY annonces_suivies_select_soi
  ON public.annonces_suivies
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    AND agency_id = (SELECT public.current_user_agency_id())
  );

DROP POLICY IF EXISTS annonces_suivies_insert_soi ON public.annonces_suivies;
CREATE POLICY annonces_suivies_insert_soi
  ON public.annonces_suivies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND agency_id = (SELECT public.current_user_agency_id())
  );

DROP POLICY IF EXISTS annonces_suivies_delete_soi ON public.annonces_suivies;
CREATE POLICY annonces_suivies_delete_soi
  ON public.annonces_suivies
  FOR DELETE
  TO authenticated
  USING (
    profile_id = auth.uid()
    AND agency_id = (SELECT public.current_user_agency_id())
  );

REVOKE ALL ON public.annonces_agences, public.annonces_imports, public.annonces_suivies FROM anon;
