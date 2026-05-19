-- Policies RLS pour la table leads (lecture / mise à jour / suppression par agence)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_select_agency ON public.leads;
CREATE POLICY leads_select_agency
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS leads_update_agency ON public.leads;
CREATE POLICY leads_update_agency
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS leads_delete_agency ON public.leads;
CREATE POLICY leads_delete_agency
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (agency_id = public.current_user_agency_id());
