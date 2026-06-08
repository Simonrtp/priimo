-- Estimation marché et plus-value (pipeline DVF / comparables)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimation_low integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimation_high integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimation_confidence text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimation_basis text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS plus_value_pct numeric;

COMMENT ON COLUMN public.leads.estimation_low IS 'Borne basse estimation (€), nullable.';
COMMENT ON COLUMN public.leads.estimation_high IS 'Borne haute estimation (€), nullable.';
COMMENT ON COLUMN public.leads.estimation_confidence IS 'Niveau de confiance estimation (ex. élevée, moyenne, faible).';
COMMENT ON COLUMN public.leads.estimation_basis IS 'Phrase explicative (approximation, pas une évaluation).';
COMMENT ON COLUMN public.leads.plus_value_pct IS 'Plus-value estimée en % depuis l''achat, nullable.';
