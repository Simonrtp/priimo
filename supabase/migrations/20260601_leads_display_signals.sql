-- =====================================================================
-- Signaux d'affichage côté agent (séparés des signaux internes scoring)
-- ---------------------------------------------------------------------
-- `display_signals` regroupe par famille TOUT ce que le panneau de
-- détail lead doit afficher (DPE, cascade de ventes, copropriété,
-- événements de vie, plus-value). Le contenu est sûr à exposer côté
-- client — il ne révèle pas la mécanique de scoring.
--
-- À l'inverse `internal_signals` (jsonb, server-only) garde le détail
-- pondéré qui alimente le score. Aucune policy ne sera ouverte sur
-- cette colonne au client : la sélection RLS reste large, mais notre
-- application ne lit JAMAIS `internal_signals` côté navigateur.
--
-- Les deux colonnes sont nullables : tant que le pipeline ne les
-- alimente pas, l'UI affiche « Aucun signal détecté ».
-- =====================================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS display_signals  jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS internal_signals jsonb;

COMMENT ON COLUMN public.leads.display_signals  IS 'JSON par famille (dpe, cascade, copropriete, evenements_vie, plus_value) lu uniquement pour l''affichage agent.';
COMMENT ON COLUMN public.leads.internal_signals IS 'JSON détaillé des signaux pondérés utilisés pour le scoring — NE JAMAIS lire côté client.';
