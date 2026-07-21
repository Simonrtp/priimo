-- Vérification marché : le pipeline contrôle si le bien est déjà en vente sur les
-- portails avant livraison. Seuls les leads 'hors_marche' sont livrés.
-- Les leads livrés avant cette feature restent NULL (aucun affichage front).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS marche_statut text NULL
    CHECK (marche_statut IN (
      'hors_marche',
      'annonce_pro',
      'annonce_exclusivite',
      'annonce_particulier',
      'doute'
    )),
  ADD COLUMN IF NOT EXISTS marche_verifie_le timestamptz NULL;

COMMENT ON COLUMN public.leads.marche_statut IS 'Statut de présence sur les portails de vente au moment de la livraison. NULL = non vérifié (leads antérieurs à la feature).';
COMMENT ON COLUMN public.leads.marche_verifie_le IS 'Horodatage de la vérification marché effectuée par le pipeline.';
