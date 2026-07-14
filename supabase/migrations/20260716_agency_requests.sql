-- Demandes de secteur par les directeurs (validation manuelle par admin).

CREATE TABLE IF NOT EXISTS public.agency_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_name    text        NOT NULL,
  address        text        NOT NULL,
  codes_postaux  text[]      NOT NULL DEFAULT '{}',
  message        text,
  status         text        NOT NULL DEFAULT 'en_attente',
  created_at     timestamptz NOT NULL DEFAULT now(),
  handled_at     timestamptz,
  CONSTRAINT agency_requests_status_check
    CHECK (status IN ('en_attente', 'acceptee', 'refusee'))
);

COMMENT ON TABLE public.agency_requests IS
  'Demandes de nouveaux secteurs par les directeurs — traitées manuellement par l''admin.';

CREATE INDEX IF NOT EXISTS idx_agency_requests_requested_by
  ON public.agency_requests (requested_by);

CREATE INDEX IF NOT EXISTS idx_agency_requests_status
  ON public.agency_requests (status)
  WHERE status = 'en_attente';

ALTER TABLE public.agency_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_requests_select_own ON public.agency_requests;
CREATE POLICY agency_requests_select_own
  ON public.agency_requests
  FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid());

DROP POLICY IF EXISTS agency_requests_insert_own ON public.agency_requests;
CREATE POLICY agency_requests_insert_own
  ON public.agency_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND status = 'en_attente'
  );

-- Pas de UPDATE/DELETE côté client : status modifié uniquement via service_role (admin).

-- Directeur : agency_id optionnel (agence pré-créée par admin ou créée à l'acceptation).
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_agency_consistency;
ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_agency_consistency
  CHECK (
    (role = 'collaborateur' AND agency_id IS NOT NULL)
    OR role = 'directeur'
  );
