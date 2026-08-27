-- building_activity : agrégat Priimo, pas open data brut.
-- Lecture authentifiée limitée au secteur (codes_postaux) de l'agence active.

DROP POLICY IF EXISTS building_activity_select ON public.building_activity;

CREATE POLICY building_activity_select ON public.building_activity
  FOR SELECT TO authenticated
  USING (
    code_postal IS NOT NULL
    AND code_postal = ANY (
      COALESCE(
        (
          SELECT a.codes_postaux
          FROM public.agencies a
          WHERE a.id = (SELECT public.current_user_agency_id())
        ),
        '{}'::text[]
      )
    )
  );

COMMENT ON POLICY building_activity_select ON public.building_activity IS
  'Lecture réservée aux lignes dont code_postal ∈ codes_postaux de l''agence active. '
  'Les tables open data (buildings, DVF, DPE, RNC) restent en SELECT ouvert.';
