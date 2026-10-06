-- Un négociateur choisit si sa fiche contact reste à lui ou se partage avec
-- l'agence.
--   privee : le titulaire de la fiche et la direction (comportement d'avant :
--            c'est la valeur par défaut, rien ne change pour l'existant) ;
--   agence : tous les membres de l'agence la voient et la complètent.
-- Seuls le titulaire et la direction changent ce réglage (contrôle applicatif,
-- comme le reste de la visibilité des contacts). Isolation inter-agences
-- inchangée : agency_id + RLS.
-- Le code lit et écrit cette colonne seulement si elle existe : appliquer
-- cette migration active le partage.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS visibilite text NOT NULL DEFAULT 'privee';

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_visibilite_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_visibilite_check
  CHECK (visibilite IN ('privee', 'agence'));

COMMENT ON COLUMN public.contacts.visibilite IS
  'privee = titulaire + direction ; agence = toute l''agence.';
