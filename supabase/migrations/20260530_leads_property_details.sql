-- =====================================================================
-- Détails de bien enrichis pour les leads
-- ---------------------------------------------------------------------
-- Ajoute les colonnes alimentées par le pipeline d'enrichissement :
--   * rooms                    — nombre de pièces (DPE / cadastre)
--   * floor                    — étage (DPE)
--   * acquired_price_reliable  — fiabilité du prix d'achat DVF
--                                (FALSE = à NE PAS afficher en clair)
--
-- Toutes les colonnes sont nullables : tant que le pipeline ne les
-- alimente pas, l'UI ignore proprement le champ.
-- =====================================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS rooms integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS floor integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS acquired_price_reliable boolean;

COMMENT ON COLUMN public.leads.rooms IS 'Nombre de pièces du bien (DPE / cadastre), nullable.';
COMMENT ON COLUMN public.leads.floor IS 'Étage du bien (0 = RDC, négatif = sous-sol), nullable.';
COMMENT ON COLUMN public.leads.acquired_price_reliable IS 'FALSE si le pipeline juge le prix DVF non fiable (incohérence superficie / millésime / lot complexe) — l''UI doit alors masquer le prix au lieu d''afficher une valeur fausse.';
