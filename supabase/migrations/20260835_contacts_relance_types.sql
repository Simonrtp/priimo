-- Relance datée, types gardien / commerçant, lien de doublon probable.

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_contact_type_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_contact_type_check
  CHECK (contact_type IN (
    'vendeur',
    'acquereur',
    'locataire',
    'gardien',
    'commercant',
    'autre'
  ));

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS recontacter_le date NULL;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS doublon_de uuid NULL REFERENCES public.contacts (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contacts.recontacter_le IS
  'Date à laquelle l''agent doit relancer. Une date arrivée alimente les cartes Accueil.';
COMMENT ON COLUMN public.contacts.doublon_de IS
  'Fiche suspectée d''être un doublon. Posé à l''écriture sur une correspondance faible.';

CREATE INDEX IF NOT EXISTS contacts_agency_recontacter_idx
  ON public.contacts (agency_id, recontacter_le)
  WHERE recontacter_le IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_agency_doublon_idx
  ON public.contacts (agency_id, doublon_de)
  WHERE doublon_de IS NOT NULL;
