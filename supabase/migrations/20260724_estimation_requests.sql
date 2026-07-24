-- Demandes d'estimation particuliers (funnel /estimation).
-- Insertion uniquement via service_role (route API serveur).
-- Aucune lecture publique : RLS activée, aucune policy SELECT pour anon/authenticated.

CREATE TABLE IF NOT EXISTS public.estimation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  address text,
  latitude double precision,
  longitude double precision,
  postal_code text,
  insee_code text,

  property_type text,
  surface_m2 numeric,
  rooms integer,
  floor text,
  has_elevator boolean,
  bathrooms integer,

  features jsonb,
  view_type text,

  construction_year integer,
  dpe_class text,
  condition_rating integer,

  is_owner boolean,
  residence_type text,
  sale_timeline text,

  civility text,
  first_name text,
  last_name text,
  phone text,
  email text,

  consent_given boolean NOT NULL DEFAULT false,
  consent_text text,
  consent_version text,
  consent_at timestamptz,
  consent_ip text,
  consent_user_agent text,

  estimation_low numeric,
  estimation_value numeric,
  estimation_high numeric,
  estimation_confidence integer,

  status text NOT NULL DEFAULT 'nouveau',
  assigned_agency_id uuid REFERENCES public.agencies(id)
);

COMMENT ON TABLE public.estimation_requests IS 'Leads estimation particuliers — consentement RGPD + résultat calculé.';
COMMENT ON COLUMN public.estimation_requests.consent_version IS 'Version du texte de consentement affiché (ex. v1).';
COMMENT ON COLUMN public.estimation_requests.status IS 'nouveau | contacte | converti | abandonne, etc.';

CREATE INDEX IF NOT EXISTS estimation_requests_created_at_idx
  ON public.estimation_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS estimation_requests_postal_code_idx
  ON public.estimation_requests (postal_code);
CREATE INDEX IF NOT EXISTS estimation_requests_status_idx
  ON public.estimation_requests (status);

ALTER TABLE public.estimation_requests ENABLE ROW LEVEL SECURITY;

-- Pas de policy pour anon / authenticated : lecture/écriture réservées au service_role
-- (le service_role bypass RLS). Les inserts passent par /api/estimation.