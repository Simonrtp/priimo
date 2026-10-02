-- Le lien adresse ↔ parcelle a deux sources de plus que les ventes DVF et
-- l'API Carto : la Base Adresse Nationale (colonne cad_parcelles) et le
-- rattachement géométrique au cadastre Etalab, quand la commune ne publie
-- pas le lien. Voir scripts/indexer-adresses-parcelles.ts.
--
-- Sans eux, la fiche parcelle ne trouvait les DPE que d'une adresse sur
-- trois hors du 20e (mesure du 02/10/2026).

ALTER TABLE public.parcelle_adresses DROP CONSTRAINT IF EXISTS parcelle_adresses_source_check;

ALTER TABLE public.parcelle_adresses
  ADD CONSTRAINT parcelle_adresses_source_check
  CHECK (source = ANY (ARRAY['dvf'::text, 'apicarto'::text, 'ban'::text, 'geo'::text]));
