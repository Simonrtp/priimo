-- Déclaration agent : le numéro a été communiqué par la personne.
-- Remplace l'état « numéro non consenti » / le flux QR de consentement.
-- Ce n'est pas une preuve de consentement au démarchage.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS numero_communique_par_la_personne boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contacts.numero_communique_par_la_personne IS
  'Déclaration de l''agent : le numéro a été communiqué par la personne. Non pré-coché à la saisie.';
