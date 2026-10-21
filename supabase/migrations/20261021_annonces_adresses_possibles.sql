-- Annonces ajoutées par URL : sans adresse sûre, les deux ou trois immeubles
-- qui restent possibles (adresse BAN, latitude, longitude), à vérifier sur place.
-- Écrites par l'import d'URL (Priimo) et la relocalisation nocturne ; lues par
-- la carte, le téléphone et la tournée. Le code fonctionne sans cette colonne
-- (il s'en passe) : l'appliquer rend les adresses possibles durables après « Ajouter ».

ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS adresses_possibles jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.annonces.adresses_possibles IS
  'Sans adresse sûre : [{adresse, latitude, longitude}] — trois immeubles possibles au plus (localiser.ts).';
