-- Connexion Google Agenda (jetons chiffrés, par utilisateur × agence).
-- Lecture seule : pas de création / modification d'événements.

CREATE TABLE IF NOT EXISTS public.calendar_connexions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  calendar_email text NOT NULL,
  token_ciphertext bytea NOT NULL,
  token_nonce bytea NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['https://www.googleapis.com/auth/calendar.readonly'],
  etat text NOT NULL DEFAULT 'actif'
    CHECK (etat IN ('actif', 'revoke', 'erreur')),
  dernier_erreur text NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, profile_id)
);

COMMENT ON TABLE public.calendar_connexions IS
  'OAuth Google Calendar calendar.readonly par utilisateur. '
  'Scope sensible Google : vérification OAuth avant prod >100 users test.';

DROP TRIGGER IF EXISTS trg_calendar_connexions_updated ON public.calendar_connexions;
CREATE TRIGGER trg_calendar_connexions_updated
  BEFORE UPDATE ON public.calendar_connexions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.calendar_connexions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_connexions_select ON public.calendar_connexions;
CREATE POLICY calendar_connexions_select ON public.calendar_connexions
  FOR SELECT TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND (
      profile_id = auth.uid()
      OR public.current_user_role() = 'directeur'
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.calendar_connexions FROM authenticated;
