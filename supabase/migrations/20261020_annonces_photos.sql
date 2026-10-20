-- Photos du portail, gardées sur l'annonce pour ne pas relire la page à chaque ouverture.
ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.annonces.photos IS
  'URLs des photos du portail. Remplies à la lecture de la page, surtout pour PAP.';
