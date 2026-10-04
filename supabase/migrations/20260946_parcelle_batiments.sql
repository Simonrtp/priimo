-- Cache de la Base de données nationale des bâtiments (BDNB) par parcelle.
--
-- L'API ouverte de la BDNB est limitée à 10 000 appels par mois et chaque
-- fiche parcelle en coûte deux. On garde la réponse résumée trente jours :
-- une parcelle consultée par plusieurs agents ou plusieurs agences ne coûte
-- qu'une fois. Donnée publique (Licence Ouverte), aucune donnée d'agence.
--
-- Lecture et écriture par le serveur seulement (service_role) : RLS activée,
-- aucune politique.

CREATE TABLE IF NOT EXISTS public.parcelle_batiments (
  parcelle_id text PRIMARY KEY CHECK (parcelle_id ~ '^[0-9A-Z]{14}$'),
  donnees jsonb,
  lu_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parcelle_batiments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.parcelle_batiments IS
  'Résumé BDNB par parcelle (usage, âge, logements, propriétaires personnes morales). Cache 30 jours, service_role uniquement.';
