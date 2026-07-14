-- Migration 2/2 multi-agences : profile_agencies = source de vérité unique.
-- À appliquer UNIQUEMENT après migration 20260713 + déploiement du code front/API.
--
-- PRÉ-VOL :
--   SELECT COUNT(*) FROM profiles;
--   SELECT COUNT(*) FROM profile_agencies;
--   (doivent être égaux)

-- ---------------------------------------------------------------------
-- 1. Backfill active_agency_id depuis la première membership si NULL
-- ---------------------------------------------------------------------
UPDATE public.profiles p
SET active_agency_id = sub.agency_id
FROM (
  SELECT DISTINCT ON (pa.profile_id)
    pa.profile_id,
    pa.agency_id
  FROM public.profile_agencies pa
  ORDER BY pa.profile_id, pa.created_at
) sub
WHERE p.id = sub.profile_id
  AND p.active_agency_id IS NULL;

-- ---------------------------------------------------------------------
-- 2. Helpers SECURITY DEFINER (sans fallback profiles.agency_id / role)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_agency_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pa.agency_id
  FROM public.profile_agencies pa
  WHERE pa.profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.active_agency_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.active_agency_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.profile_agencies pa
          WHERE pa.profile_id = p.id
            AND pa.agency_id = p.active_agency_id
        )
    ),
    (
      SELECT pa.agency_id
      FROM public.profile_agencies pa
      WHERE pa.profile_id = auth.uid()
      ORDER BY pa.created_at
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pa.role
  FROM public.profile_agencies pa
  WHERE pa.profile_id = auth.uid()
    AND pa.agency_id = public.current_user_agency_id();
$$;

REVOKE ALL ON FUNCTION public.current_user_agency_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_agency_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_agency_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Policies profiles (via profile_agencies)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_self_or_agency ON public.profiles;
CREATE POLICY profiles_select_self_or_agency
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profile_agencies pa
      WHERE pa.profile_id = profiles.id
        AND pa.agency_id = public.current_user_agency_id()
    )
  );

DROP POLICY IF EXISTS profiles_update_self_or_director ON public.profiles;
CREATE POLICY profiles_update_self_or_director
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR (
      public.current_user_role() = 'directeur'
      AND EXISTS (
        SELECT 1
        FROM public.profile_agencies pa
        WHERE pa.profile_id = profiles.id
          AND pa.agency_id = public.current_user_agency_id()
          AND pa.role = 'collaborateur'
      )
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR (
      public.current_user_role() = 'directeur'
      AND EXISTS (
        SELECT 1
        FROM public.profile_agencies pa
        WHERE pa.profile_id = profiles.id
          AND pa.agency_id = public.current_user_agency_id()
          AND pa.role = 'collaborateur'
      )
    )
  );

DROP POLICY IF EXISTS profiles_delete_director ON public.profiles;
CREATE POLICY profiles_delete_director
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'directeur'
    AND EXISTS (
      SELECT 1
      FROM public.profile_agencies pa
      WHERE pa.profile_id = profiles.id
        AND pa.agency_id = public.current_user_agency_id()
        AND pa.role = 'collaborateur'
    )
  );

-- ---------------------------------------------------------------------
-- 4. Suppression colonnes legacy profiles
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS uq_profiles_one_director_per_agency;
DROP INDEX IF EXISTS idx_profiles_agency_id;
DROP INDEX IF EXISTS idx_profiles_role;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS agency_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

COMMENT ON COLUMN public.profiles.active_agency_id IS
  'Agence affichée dans le dashboard ; NULL = première agence (profile_agencies).';

-- ---------------------------------------------------------------------
-- 5. Vérification backfill
-- ---------------------------------------------------------------------
DO $$
DECLARE
  profile_count integer;
  link_count integer;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  SELECT COUNT(*) INTO link_count FROM public.profile_agencies;
  IF link_count <> profile_count THEN
    RAISE EXCEPTION
      'Incohérence post-migration : % profils, % liaisons profile_agencies',
      profile_count, link_count;
  END IF;
  RAISE NOTICE 'Migration 2 OK : % profils = % memberships', profile_count, link_count;
END $$;
