-- Instantané hebdomadaire du bandeau Accueil (lundi, Europe/Paris).
-- Lecture : membres de l'agence. Écriture : même périmètre (idempotent).

CREATE TABLE IF NOT EXISTS public.agency_weekly_snapshots (
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  week_start date NOT NULL,
  mandats_actifs integer NOT NULL DEFAULT 0,
  leads_non_pris integer NOT NULL DEFAULT 0,
  rdv_sans_suite integer NOT NULL DEFAULT 0,
  mandats_60j integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, week_start)
);

COMMENT ON TABLE public.agency_weekly_snapshots IS
  'Valeurs du bandeau Accueil au lundi de chaque semaine — comparaison N vs N-1.';

ALTER TABLE public.agency_weekly_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_weekly_snapshots_select ON public.agency_weekly_snapshots;
CREATE POLICY agency_weekly_snapshots_select
  ON public.agency_weekly_snapshots
  FOR SELECT
  TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS agency_weekly_snapshots_write ON public.agency_weekly_snapshots;
CREATE POLICY agency_weekly_snapshots_write
  ON public.agency_weekly_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS agency_weekly_snapshots_update ON public.agency_weekly_snapshots;
CREATE POLICY agency_weekly_snapshots_update
  ON public.agency_weekly_snapshots
  FOR UPDATE
  TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());
