-- Perf dashboard : indexes FK / RLS + InitPlan auth.uid() / current_user_agency_id().
-- Ne change aucune règle de visibilité.

-- ---------------------------------------------------------------------------
-- Helpers : (select auth.uid()) pour un InitPlan unique par requête
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_agency_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pa.agency_id
  FROM public.profile_agencies pa
  WHERE pa.profile_id = (SELECT auth.uid());
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
      WHERE p.id = (SELECT auth.uid())
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
      WHERE pa.profile_id = (SELECT auth.uid())
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
  WHERE pa.profile_id = (SELECT auth.uid())
    AND pa.agency_id = public.current_user_agency_id();
$$;

-- ---------------------------------------------------------------------------
-- Policies chaudes : hoister current_user_agency_id()
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS leads_select_agency ON public.leads;
CREATE POLICY leads_select_agency ON public.leads
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS leads_update_agency ON public.leads;
CREATE POLICY leads_update_agency ON public.leads
  FOR UPDATE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()))
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS leads_delete_agency ON public.leads;
CREATE POLICY leads_delete_agency ON public.leads
  FOR DELETE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS contacts_select_agency ON public.contacts;
CREATE POLICY contacts_select_agency ON public.contacts
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS contacts_update_agency ON public.contacts;
CREATE POLICY contacts_update_agency ON public.contacts
  FOR UPDATE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()))
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS biens_select_agency ON public.biens;
CREATE POLICY biens_select_agency ON public.biens
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS biens_update_agency ON public.biens;
CREATE POLICY biens_update_agency ON public.biens
  FOR UPDATE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()))
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS voice_notes_select_agency ON public.voice_notes;
CREATE POLICY voice_notes_select_agency ON public.voice_notes
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS contact_interactions_select_agency ON public.contact_interactions;
CREATE POLICY contact_interactions_select_agency ON public.contact_interactions
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS profiles_select_self_or_agency ON public.profiles;
CREATE POLICY profiles_select_self_or_agency
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profile_agencies pa
      WHERE pa.profile_id = profiles.id
        AND pa.agency_id = (SELECT public.current_user_agency_id())
    )
  );

DROP POLICY IF EXISTS profile_agencies_select_self_or_agency ON public.profile_agencies;
CREATE POLICY profile_agencies_select_self_or_agency
  ON public.profile_agencies
  FOR SELECT
  TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR agency_id = (SELECT public.current_user_agency_id())
  );

-- ---------------------------------------------------------------------------
-- Indexes (IF NOT EXISTS) — Postgres n'indexe pas les FK automatiquement
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS leads_agency_id_idx ON public.leads (agency_id);
CREATE INDEX IF NOT EXISTS leads_stage_id_idx ON public.leads (stage_id);
CREATE INDEX IF NOT EXISTS contacts_created_by_idx ON public.contacts (agency_id, created_by);
CREATE INDEX IF NOT EXISTS biens_created_by_idx ON public.biens (agency_id, created_by);
CREATE INDEX IF NOT EXISTS voice_notes_created_by_idx ON public.voice_notes (agency_id, created_by);
CREATE INDEX IF NOT EXISTS note_liens_agency_id_idx ON public.note_liens (agency_id);
