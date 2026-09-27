-- Objectif mensuel de mandats au niveau agence (Accueil directeur).
-- NULL = on retombe sur la somme des objectifs individuels.

ALTER TABLE public.agency_activity_settings
  ADD COLUMN IF NOT EXISTS objectif_mandats_mois integer NULL;

ALTER TABLE public.agency_activity_settings
  DROP CONSTRAINT IF EXISTS agency_activity_settings_objectif_mandats_check;

ALTER TABLE public.agency_activity_settings
  ADD CONSTRAINT agency_activity_settings_objectif_mandats_check
  CHECK (
    objectif_mandats_mois IS NULL
    OR (objectif_mandats_mois >= 0 AND objectif_mandats_mois <= 10000)
  );

COMMENT ON COLUMN public.agency_activity_settings.objectif_mandats_mois IS
  'Objectif mensuel de mandats de l''agence. Posé par le directeur depuis Mon équipe. NULL = somme des objectifs individuels.';
