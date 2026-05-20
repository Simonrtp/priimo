-- Zone par rayon ou par arrondissements Paris (codes postaux 75001–75020)
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS zone_type text NOT NULL DEFAULT 'radius',
  ADD COLUMN IF NOT EXISTS zone_postal_codes text[];

ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_zone_type_check;
ALTER TABLE public.agencies
  ADD CONSTRAINT agencies_zone_type_check
  CHECK (zone_type IN ('radius', 'postal_codes'));

COMMENT ON COLUMN public.agencies.zone_type IS 'Mode de zone : radius (adresse + rayon) ou postal_codes (arrondissements Paris).';
COMMENT ON COLUMN public.agencies.zone_postal_codes IS 'Codes postaux 75001–75020 lorsque zone_type = postal_codes.';
