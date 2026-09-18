-- Le QR ne crée pas de contact.
--
-- contacts_crees compte les scans reçus (plafond anti-abus), pas des fiches.
-- dernier_scan_* porte ce que l'agent voit en confirmation, sur son écran,
-- pendant que la personne est encore sur le palier.

ALTER TABLE public.qr_sessions_terrain
  ADD COLUMN IF NOT EXISTS dernier_scan_prenom text;
ALTER TABLE public.qr_sessions_terrain
  ADD COLUMN IF NOT EXISTS dernier_scan_nom text;
ALTER TABLE public.qr_sessions_terrain
  ADD COLUMN IF NOT EXISTS dernier_scan_le timestamptz;

COMMENT ON COLUMN public.qr_sessions_terrain.contacts_crees IS
  'Nombre de validations de la page publique, pas de fiches créées. Le QR déverrouille un numéro ; la fiche naît de la dictée.';
COMMENT ON COLUMN public.qr_sessions_terrain.dernier_scan_prenom IS
  'Prénom du dernier scan, recopié pour la confirmation agent. Pas une fiche.';

COMMENT ON COLUMN public.contacts.source IS
  'Par quel geste la fiche est entrée. qr_terrain n''est plus une naissance : le QR ne crée plus de contact.';

-- Mention opposable : la finalité est le recontact au sujet de la vente,
-- nommée, pas une case fourre-tout.
INSERT INTO public.consentements_telephone_versions (version, corps)
VALUES (
  'qr-terrain-2026-09-v2',
  'J''accepte d''être recontacté par {agence} au sujet de la vente de mon bien.'
)
ON CONFLICT (version) DO NOTHING;
