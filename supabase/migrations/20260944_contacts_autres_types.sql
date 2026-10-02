-- Une personne peut avoir plusieurs casquettes : une vendeuse qui cherche aussi
-- à acheter. `contact_type` reste le rôle principal (filtres, couleurs) ;
-- `autres_types` porte les rôles en plus. Le code lit et écrit cette colonne
-- seulement si elle existe : appliquer cette migration active les rôles multiples.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS autres_types text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_autres_types_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_autres_types_check
  CHECK (autres_types <@ ARRAY['vendeur', 'acquereur', 'locataire', 'gardien', 'commercant', 'autre']::text[]);

-- « Tous les acquéreurs » doit trouver aussi les vendeurs qui achètent.
CREATE INDEX IF NOT EXISTS contacts_autres_types_idx
  ON public.contacts USING gin (autres_types);
