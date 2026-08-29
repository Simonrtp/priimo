-- Demandes de couverture sectorielle depuis l’estimation.
-- Information commerciale : quels CP les agences réclament oriente les imports.

CREATE TABLE IF NOT EXISTS public.estimation_coverage_demands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  postal_code text NOT NULL CHECK (postal_code ~ '^\d{5}$'),
  city text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimation_coverage_demands_cp_idx
  ON public.estimation_coverage_demands (postal_code, created_at DESC);

CREATE INDEX IF NOT EXISTS estimation_coverage_demands_agency_idx
  ON public.estimation_coverage_demands (agency_id, created_at DESC);

ALTER TABLE public.estimation_coverage_demands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estimation_coverage_demands_insert ON public.estimation_coverage_demands;
CREATE POLICY estimation_coverage_demands_insert ON public.estimation_coverage_demands
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS estimation_coverage_demands_select ON public.estimation_coverage_demands;
CREATE POLICY estimation_coverage_demands_select ON public.estimation_coverage_demands
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

GRANT SELECT, INSERT ON public.estimation_coverage_demands TO authenticated;

COMMENT ON TABLE public.estimation_coverage_demands IS
  'Demandes de couverture DVF signalées depuis l’écran secteur non couvert.';
