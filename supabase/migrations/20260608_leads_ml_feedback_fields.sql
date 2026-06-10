-- Feedback agent pour analyse de conversion et futur ML
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ml_feedback_reason text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ml_feedback_at timestamptz;

COMMENT ON COLUMN public.leads.ml_feedback_reason IS 'Note libre optionnelle expliquant le verdict (ml_feedback).';
COMMENT ON COLUMN public.leads.ml_feedback_at IS 'Horodatage du dernier verdict ou modification de note.';

-- Harmonise les anciennes étiquettes vers le vocabulaire produit actuel
UPDATE public.leads SET ml_feedback = 'vendeur_perdu' WHERE ml_feedback = 'vendeur_ailleurs';
UPDATE public.leads SET ml_feedback = 'injoignable' WHERE ml_feedback = 'pas_contacte';
