-- Gabarit avis v2 : 7 pages générées. Retire les pages absorbées et les
-- captures de test (Hello / Alan) du modèle d'agence et des rapports déjà composés.

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
    'immeuble_appartement',
    'secteur',
    'comparables',
    'concurrentiel',
    'prix'
  ];
BEGIN
  DELETE FROM public.agency_rapport_modele m
  USING public.agency_rapport_pages p
  WHERE m.bibliotheque_id = p.id
    AND (
      p.nom ~* '\yhello\y'
      OR p.nom ~* 'dans ton secteur'
      OR p.nom ~* '\yalan\y'
      OR p.nom ~* 'page de test'
      OR p.nom ~* '^test\y'
    );

  DELETE FROM public.estimation_rapport_pages e
  USING public.agency_rapport_pages p
  WHERE e.bibliotheque_id = p.id
    AND (
      p.nom ~* '\yhello\y'
      OR p.nom ~* 'dans ton secteur'
      OR p.nom ~* '\yalan\y'
      OR p.nom ~* 'page de test'
      OR p.nom ~* '^test\y'
    );

  DELETE FROM public.agency_rapport_pages
  WHERE nom ~* '\yhello\y'
     OR nom ~* 'dans ton secteur'
     OR nom ~* '\yalan\y'
     OR nom ~* 'page de test'
     OR nom ~* '^test\y';

  DELETE FROM public.estimation_rapport_pages
  WHERE source = 'generee'
    AND (
      contenu->>'kind' IN (
        'description',
        'points_interet',
        'connectivite',
        'permis',
        'indices',
        'prochaine_etape'
      )
    );

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
