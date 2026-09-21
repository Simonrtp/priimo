-- Une bibliothèque de pages par agence, un modèle ordonné.
-- Les pages « personnelles » (owner_id) rejoignent la bibliothèque.

-- ---------------------------------------------------------------------------
-- 1) Rattacher, puis retirer la propriété personnelle
-- ---------------------------------------------------------------------------
UPDATE public.agency_rapport_pages
SET owner_id = NULL
WHERE owner_id IS NOT NULL;

DROP INDEX IF EXISTS agency_rapport_pages_owner_pos_idx;

ALTER TABLE public.agency_rapport_pages
  DROP COLUMN IF EXISTS owner_id;

COMMENT ON TABLE public.agency_rapport_pages IS
  'Bibliothèque unique de l''agence. Pas de copie permanente par agent.';

-- ---------------------------------------------------------------------------
-- 2) Écriture : directeur. Lecture : toute l'agence.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS agency_rapport_pages_insert ON public.agency_rapport_pages;
CREATE POLICY agency_rapport_pages_insert ON public.agency_rapport_pages
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

DROP POLICY IF EXISTS agency_rapport_pages_update ON public.agency_rapport_pages;
CREATE POLICY agency_rapport_pages_update ON public.agency_rapport_pages
  FOR UPDATE TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  )
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

DROP POLICY IF EXISTS agency_rapport_pages_delete ON public.agency_rapport_pages;
CREATE POLICY agency_rapport_pages_delete ON public.agency_rapport_pages
  FOR DELETE TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

DROP POLICY IF EXISTS agency_rapport_modele_insert ON public.agency_rapport_modele;
CREATE POLICY agency_rapport_modele_insert ON public.agency_rapport_modele
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

DROP POLICY IF EXISTS agency_rapport_modele_update ON public.agency_rapport_modele;
CREATE POLICY agency_rapport_modele_update ON public.agency_rapport_modele
  FOR UPDATE TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  )
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

DROP POLICY IF EXISTS agency_rapport_modele_delete ON public.agency_rapport_modele;
CREATE POLICY agency_rapport_modele_delete ON public.agency_rapport_modele
  FOR DELETE TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );
