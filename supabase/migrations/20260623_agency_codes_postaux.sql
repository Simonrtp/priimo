-- Secteur(s) de prospection par code postal (adresse agence + arrondissements limitrophes)
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS codes_postaux text[];

COMMENT ON COLUMN public.agencies.codes_postaux IS 'Secteur(s) de prospection — codes postaux couverts par l''agence.';
