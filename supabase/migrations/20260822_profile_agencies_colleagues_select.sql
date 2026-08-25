-- Les membres voient les liaisons de leur agence ACTIVE (pour lister les
-- collègues), plus toutes leurs propres liaisons (changement d'agence).
-- Un membre de A ne voit jamais les lignes de B.

DROP POLICY IF EXISTS profile_agencies_select_own ON public.profile_agencies;
DROP POLICY IF EXISTS profile_agencies_select_self_or_agency ON public.profile_agencies;

CREATE POLICY profile_agencies_select_self_or_agency
  ON public.profile_agencies
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR agency_id = public.current_user_agency_id()
  );