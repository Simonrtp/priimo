-- Télémétrie terrain : actions de tournée (Priimo / direction).
-- L'agent écrit ; la lecture reste au périmètre agence (directeur via RLS).

CREATE TABLE IF NOT EXISTS public.sortie_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  day date NOT NULL,
  kind text NOT NULL,
  lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  stop_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sortie_events_kind_check CHECK (
    kind IN (
      'start',
      'pause',
      'resume',
      'finish',
      'rencontre',
      'absent',
      'passer',
      'remove_stop',
      'recalc_origin',
      'dictee'
    )
  )
);

COMMENT ON TABLE public.sortie_events IS
  'Journal de tournée terrain — télémétrie Priimo / directeur, pas un journal agent.';

CREATE UNIQUE INDEX IF NOT EXISTS sortie_events_client_id_uidx
  ON public.sortie_events (agency_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sortie_events_agency_day_idx
  ON public.sortie_events (agency_id, day DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS sortie_events_profile_day_idx
  ON public.sortie_events (profile_id, day DESC, created_at DESC);

ALTER TABLE public.sortie_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sortie_events_select ON public.sortie_events;
CREATE POLICY sortie_events_select
  ON public.sortie_events
  FOR SELECT
  TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS sortie_events_insert ON public.sortie_events;
CREATE POLICY sortie_events_insert
  ON public.sortie_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND profile_id = auth.uid()
  );

GRANT SELECT, INSERT ON public.sortie_events TO authenticated;
