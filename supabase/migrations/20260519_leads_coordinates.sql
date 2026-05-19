-- Coordonnées des leads pour la vue carte (WGS84)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS longitude double precision;

COMMENT ON COLUMN public.leads.latitude IS 'Latitude du bien (WGS84), renseignée par le pipeline ou le géocodage.';
COMMENT ON COLUMN public.leads.longitude IS 'Longitude du bien (WGS84), renseignée par le pipeline ou le géocodage.';
