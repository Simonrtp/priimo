-- Multi-agences : liaison profile ↔ agences + agence active.
-- Rétro-compatible : profiles.agency_id / profiles.role restent la valeur par défaut.

-- ---------------------------------------------------------------------
-- 1. Table profile_agencies
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_agencies (
  profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id   uuid        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  role        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, agency_id),
  CONSTRAINT profile_agencies_role_check
    CHECK (role IN ('directeur', 'collaborateur'))
);

COMMENT ON TABLE public.profile_agencies IS
  'Appartenance utilisateur ↔ agence avec rôle par agence (multi-agences).';

CREATE INDEX IF NOT EXISTS idx_profile_agencies_agency_id
  ON public.profile_agencies (agency_id);

CREATE INDEX IF NOT EXISTS idx_profile_agencies_profile_id
  ON public.profile_agencies (profile_id);

-- Un seul directeur par agence (dans la table de liaison).
CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_agencies_one_director_per_agency
  ON public.profile_agencies (agency_id)
  WHERE role = 'directeur';

-- ---------------------------------------------------------------------
-- 2. Agence active sur profiles
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.active_agency_id IS
  'Agence affichée dans le dashboard ; NULL = profiles.agency_id (défaut).';

-- ---------------------------------------------------------------------
-- 3. Backfill obligatoire
-- ---------------------------------------------------------------------
INSERT INTO public.profile_agencies (profile_id, agency_id, role)
SELECT p.id, p.agency_id, p.role
FROM public.profiles p
ON CONFLICT (profile_id, agency_id) DO NOTHING;

DO $$
DECLARE
  profile_count integer;
  link_count integer;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  SELECT COUNT(*) INTO link_count FROM public.profile_agencies;
  IF link_count <> profile_count THEN
    RAISE EXCEPTION
      'Backfill profile_agencies incomplet : % profils, % liaisons',
      profile_count, link_count;
  END IF;
  RAISE NOTICE 'Backfill profile_agencies OK : % lignes (= % profils)', link_count, profile_count;
END $$;

-- ---------------------------------------------------------------------
-- 4. Helpers SECURITY DEFINER (agence active + rôle contextuel)
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
  WHERE pa.profile_id = auth.uid()
  UNION
  SELECT p.agency_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profile_agencies pa2 WHERE pa2.profile_id = p.id
    );
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
    (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT pa.role
      FROM public.profile_agencies pa
      WHERE pa.profile_id = auth.uid()
        AND pa.agency_id = public.current_user_agency_id()
    ),
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_agency_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_agency_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_agency_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Validation active_agency_id
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_profile_active_agency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.active_agency_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profile_agencies pa
    WHERE pa.profile_id = NEW.id
      AND pa.agency_id = NEW.active_agency_id
  ) THEN
    RAISE EXCEPTION 'active_agency_id invalide : agence non rattachée au profil';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_validate_active_agency ON public.profiles;
CREATE TRIGGER trg_profiles_validate_active_agency
  BEFORE INSERT OR UPDATE OF active_agency_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_active_agency();

-- ---------------------------------------------------------------------
-- 6. RLS profile_agencies
-- ---------------------------------------------------------------------
ALTER TABLE public.profile_agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_agencies_select_own ON public.profile_agencies;
CREATE POLICY profile_agencies_select_own
  ON public.profile_agencies
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- ---------------------------------------------------------------------
-- 7. Policies agencies : voir toutes ses agences, modifier l'agence active
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS agencies_select_own ON public.agencies;
CREATE POLICY agencies_select_own
  ON public.agencies
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.current_user_agency_ids()));
