-- Traçabilité du moteur d’estimation.
-- Valeur moteur et prix agent restent séparés. nature_mutation pour ne retenir que les Ventes.
-- Ne pas appliquer ici : l’agent passe la migration.

ALTER TABLE public.building_transactions
  ADD COLUMN IF NOT EXISTS nature_mutation text;

COMMENT ON COLUMN public.building_transactions.nature_mutation IS
  'Nature DVF (Vente, VEFA, échange…). Le moteur ne retient que Vente. NULL = traité comme Vente (lignes ingérées avant cette colonne).';

ALTER TABLE public.agency_estimations
  ADD COLUMN IF NOT EXISTS moteur_valeur numeric,
  ADD COLUMN IF NOT EXISTS prix_agent numeric,
  ADD COLUMN IF NOT EXISTS moteur_impossible_motif text,
  ADD COLUMN IF NOT EXISTS moteur_trace jsonb;

COMMENT ON COLUMN public.agency_estimations.moteur_valeur IS
  'Proposition du moteur, arrondie au millier. Jamais 0. NULL si estimation impossible.';
COMMENT ON COLUMN public.agency_estimations.prix_agent IS
  'Prix final choisi par l’agent. Distinct de moteur_valeur. C’est ce chiffre qui mesure l’écart moteur / terrain.';
COMMENT ON COLUMN public.agency_estimations.moteur_impossible_motif IS
  'Raison exacte si le moteur n’a pas pu estimer (aucune vente, surface manquante…).';
COMMENT ON COLUMN public.agency_estimations.moteur_trace IS
  'Ventes retenues et exclues (avec motif), indice, ajustements, fiabilité. Pour améliorer le moteur.';
