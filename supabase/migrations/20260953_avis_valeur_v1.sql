-- Avis de valeur V1 : mention légale d'agence (texte avocat, vide par défaut),
-- événements de création, kinds de pages cadastre / photos / DPE / stratégie.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS avis_mention_legale text;

COMMENT ON COLUMN public.agencies.avis_mention_legale IS
  'Mention légale de l’avis, propre à l’agence. NULL = emplacement vide, le texte viendra de l’avocat.';

CREATE TABLE IF NOT EXISTS public.estimation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  estimation_id uuid NOT NULL REFERENCES public.agency_estimations (id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('created', 'shared', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimation_events_agency_kind_idx
  ON public.estimation_events (agency_id, kind, created_at DESC);

ALTER TABLE public.estimation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estimation_events_select ON public.estimation_events;
CREATE POLICY estimation_events_select ON public.estimation_events
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

GRANT SELECT ON public.estimation_events TO authenticated;

COMMENT ON TABLE public.estimation_events IS
  'Journal des avis de valeur. Compteur futur « estimations » du pilotage. La visibilité métier (créateur / assigné / directeur) se lit au-dessus, pas ici.';

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
        'prochaine_etape'
      )
    )
  );

DO $$
DECLARE
  ag uuid;
  biblio uuid[];
  pos integer;
  k text;
  bid uuid;
  kinds text[] := ARRAY[
    'couverture',
    'votre_bien',
    'description',
    'cadastre',
    'photos',
    'comparables',
    'secteur',
    'dpe_bien',
    'strategie',
    'prix'
  ];
BEGIN
  FOR ag IN SELECT id FROM public.agencies
  LOOP
    SELECT coalesce(array_agg(bibliotheque_id ORDER BY position, created_at), ARRAY[]::uuid[])
      INTO biblio
    FROM public.agency_rapport_modele
    WHERE agency_id = ag
      AND source = 'bibliotheque'
      AND bibliotheque_id IS NOT NULL;

    DELETE FROM public.agency_rapport_modele WHERE agency_id = ag;

    pos := 0;
    FOREACH k IN ARRAY kinds
    LOOP
      INSERT INTO public.agency_rapport_modele (agency_id, position, source, kind_generee)
      VALUES (ag, pos, 'generee', k);
      pos := pos + 1;
    END LOOP;

    IF biblio IS NOT NULL THEN
      FOREACH bid IN ARRAY biblio
      LOOP
        INSERT INTO public.agency_rapport_modele (agency_id, position, source, bibliotheque_id)
        VALUES (ag, pos, 'bibliotheque', bid);
        pos := pos + 1;
      END LOOP;
    END IF;
  END LOOP;
END $$;
