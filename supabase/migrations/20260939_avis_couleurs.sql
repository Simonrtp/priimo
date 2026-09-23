-- Deuxième couleur d’identité de l’avis de valeur (maquette v2).
-- Ne pas appliquer ici : l’agent passe la migration.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS couleur_secondaire text;

UPDATE public.agencies
SET couleur_secondaire = '#1F6FB5'
WHERE couleur_secondaire IS NULL;

ALTER TABLE public.agencies
  ALTER COLUMN couleur_secondaire SET DEFAULT '#1F6FB5';

ALTER TABLE public.agencies
  DROP CONSTRAINT IF EXISTS agencies_couleur_secondaire_hex;

ALTER TABLE public.agencies
  ADD CONSTRAINT agencies_couleur_secondaire_hex
  CHECK (couleur_secondaire IS NULL OR couleur_secondaire ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON COLUMN public.agencies.couleur_secondaire IS
  'Seconde couleur de l’avis (bandes, titres clairs, pied). Nuancier fermé côté UI.';
