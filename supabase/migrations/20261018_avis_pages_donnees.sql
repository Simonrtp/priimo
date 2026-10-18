-- Pages socio-économie, services, accessibilité, et réglage d'adresse des comparables.
-- La table INSEE n'est pas l'indice Notaires–INSEE des prix.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS comparables_adresse_complete boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agencies.comparables_adresse_complete IS
  'Avis de valeur : true affiche l’adresse complète des ventes comparables. Défaut : la rue seulement.';

CREATE TABLE IF NOT EXISTS public.insee_communes (
  code text PRIMARY KEY,
  nom text,
  population integer,
  serie jsonb NOT NULL DEFAULT '[]'::jsonb,
  ages jsonb NOT NULL DEFAULT '[]'::jsonb,
  csp jsonb NOT NULL DEFAULT '[]'::jsonb,
  taux_chomage numeric,
  millesime integer
);

COMMENT ON TABLE public.insee_communes IS
  'Recensement INSEE à la commune (arrondissement à Paris). Chargé par scripts/importer-insee-communes.ts. Pas l’indice des prix.';

ALTER TABLE public.insee_communes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insee_communes_select ON public.insee_communes;
CREATE POLICY insee_communes_select ON public.insee_communes
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.insee_communes TO authenticated;

CREATE TABLE IF NOT EXISTS public.osm_services_cache (
  cle text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.osm_services_cache IS
  'Services OpenStreetMap mis en cache par zone (latitude et longitude à 3 décimales).';

ALTER TABLE public.osm_services_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS osm_services_cache_select ON public.osm_services_cache;
CREATE POLICY osm_services_cache_select ON public.osm_services_cache
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS osm_services_cache_write ON public.osm_services_cache;
CREATE POLICY osm_services_cache_write ON public.osm_services_cache
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.osm_services_cache TO authenticated;

ALTER TABLE public.agency_rapport_modele
  DROP CONSTRAINT IF EXISTS agency_rapport_modele_slot_check;

ALTER TABLE public.agency_rapport_modele
  ADD CONSTRAINT agency_rapport_modele_slot_check CHECK (
    (source = 'bibliotheque' AND bibliotheque_id IS NOT NULL AND kind_generee IS NULL)
    OR (
      source = 'generee'
      AND bibliotheque_id IS NULL
      AND kind_generee IN (
        'couverture',
        'votre_bien',
        'description',
        'cadastre',
        'photos',
        'comparables',
        'secteur',
        'dpe_bien',
        'strategie',
        'prix',
        'immeuble_appartement',
        'points_interet',
        'connectivite',
        'permis',
        'concurrentiel',
        'indices',
        'prochaine_etape',
        'socio_economie',
        'services_proximite',
        'accessibilite'
      )
    )
  );
