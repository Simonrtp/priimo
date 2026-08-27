-- Estimations agents (avis de valeur) — isolées par agence.
-- Distinct de estimation_requests (funnel public / leads).

CREATE TABLE IF NOT EXISTS public.agency_estimations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,

  -- Adresse
  address text NOT NULL,
  postal_code text,
  city text,
  ban_id text,
  parcelle_id text,
  latitude double precision,
  longitude double precision,

  -- Entrées
  property_type text NOT NULL CHECK (property_type IN ('appartement', 'maison')),
  surface_m2 integer NOT NULL CHECK (surface_m2 > 0 AND surface_m2 < 10000),
  rooms integer NOT NULL CHECK (rooms > 0 AND rooms < 50),
  floor text,
  condition_rating integer CHECK (condition_rating IS NULL OR (condition_rating BETWEEN 1 AND 4)),
  dpe_class text,

  -- Résultat
  available boolean NOT NULL DEFAULT false,
  price_low integer,
  price_high integer,
  price_per_m2 integer,
  reliability integer NOT NULL DEFAULT 0 CHECK (reliability BETWEEN 0 AND 100),
  reliability_label text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  comparables jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Rattachements
  lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,
  bien_id uuid REFERENCES public.biens (id) ON DELETE SET NULL,

  -- Partage public
  share_token text UNIQUE,
  share_expires_at timestamptz,
  share_revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_estimations_agency_created_idx
  ON public.agency_estimations (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agency_estimations_share_token_idx
  ON public.agency_estimations (share_token)
  WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS agency_estimations_lead_idx
  ON public.agency_estimations (lead_id)
  WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS agency_estimations_contact_idx
  ON public.agency_estimations (contact_id)
  WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS agency_estimations_bien_idx
  ON public.agency_estimations (bien_id)
  WHERE bien_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_agency_estimations_updated ON public.agency_estimations;
CREATE TRIGGER trg_agency_estimations_updated
  BEFORE UPDATE ON public.agency_estimations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agency_estimations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_estimations_select ON public.agency_estimations;
CREATE POLICY agency_estimations_select ON public.agency_estimations
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS agency_estimations_insert ON public.agency_estimations;
CREATE POLICY agency_estimations_insert ON public.agency_estimations
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS agency_estimations_update ON public.agency_estimations;
CREATE POLICY agency_estimations_update ON public.agency_estimations
  FOR UPDATE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()))
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS agency_estimations_delete ON public.agency_estimations;
CREATE POLICY agency_estimations_delete ON public.agency_estimations
  FOR DELETE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_estimations TO authenticated;

COMMENT ON TABLE public.agency_estimations IS
  'Avis de valeur produits dans le dashboard. Partage public via share_token (service_role pour la page /avis).';
