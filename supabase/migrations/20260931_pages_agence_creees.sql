-- Pages créées dans la bibliothèque d'agence (dispositions prédéfinies)
-- + couleur principale d'agence pour le gabarit.

-- ---------------------------------------------------------------------------
-- 1) Couleur d'accent — un seul champ, orange Priimo par défaut
-- ---------------------------------------------------------------------------
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS couleur_principale text NOT NULL DEFAULT '#E8743C';

ALTER TABLE public.agencies
  DROP CONSTRAINT IF EXISTS agencies_couleur_principale_hex;
ALTER TABLE public.agencies
  ADD CONSTRAINT agencies_couleur_principale_hex
  CHECK (couleur_principale ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON COLUMN public.agencies.couleur_principale IS
  'Couleur d''accent du rapport (#RRGGBB). Défaut orange Priimo #E8743C.';

-- ---------------------------------------------------------------------------
-- 2) Bibliothèque : pages modèle (créées) en plus des PDF / images importés
-- ---------------------------------------------------------------------------
ALTER TABLE public.agency_rapport_pages
  DROP CONSTRAINT IF EXISTS agency_rapport_pages_kind_check;
ALTER TABLE public.agency_rapport_pages
  ADD CONSTRAINT agency_rapport_pages_kind_check
  CHECK (kind IN ('pdf', 'image', 'modele'));

ALTER TABLE public.agency_rapport_pages
  ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE public.agency_rapport_pages
  ALTER COLUMN mime_type DROP NOT NULL;

ALTER TABLE public.agency_rapport_pages
  ADD COLUMN IF NOT EXISTS disposition text;

ALTER TABLE public.agency_rapport_pages
  DROP CONSTRAINT IF EXISTS agency_rapport_pages_disposition_check;
ALTER TABLE public.agency_rapport_pages
  ADD CONSTRAINT agency_rapport_pages_disposition_check
  CHECK (disposition IS NULL OR disposition IN ('texte', 'texte_image', 'image', 'points'));

ALTER TABLE public.agency_rapport_pages
  ADD COLUMN IF NOT EXISTS contenu jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.agency_rapport_pages
  DROP CONSTRAINT IF EXISTS agency_rapport_pages_kind_champs_check;
ALTER TABLE public.agency_rapport_pages
  ADD CONSTRAINT agency_rapport_pages_kind_champs_check
  CHECK (
    (kind IN ('pdf', 'image') AND storage_path IS NOT NULL AND mime_type IS NOT NULL)
    OR (kind = 'modele' AND disposition IS NOT NULL)
  );

COMMENT ON COLUMN public.agency_rapport_pages.disposition IS
  'Disposition prédéfinie d''une page créée (texte, texte_image, image, points).';
COMMENT ON COLUMN public.agency_rapport_pages.contenu IS
  'Contenu structuré d''une page créée. Jamais de mise en page libre.';

-- ---------------------------------------------------------------------------
-- 3) Composition : instantané de la page créée au moment de l'ajout
-- ---------------------------------------------------------------------------
ALTER TABLE public.estimation_rapport_pages
  DROP CONSTRAINT IF EXISTS estimation_rapport_pages_kind_check;
ALTER TABLE public.estimation_rapport_pages
  ADD CONSTRAINT estimation_rapport_pages_kind_check
  CHECK (kind IN ('pdf', 'image', 'generee', 'modele'));

ALTER TABLE public.estimation_rapport_pages
  ADD COLUMN IF NOT EXISTS disposition text;

ALTER TABLE public.estimation_rapport_pages
  DROP CONSTRAINT IF EXISTS estimation_rapport_pages_disposition_check;
ALTER TABLE public.estimation_rapport_pages
  ADD CONSTRAINT estimation_rapport_pages_disposition_check
  CHECK (disposition IS NULL OR disposition IN ('texte', 'texte_image', 'image', 'points'));

ALTER TABLE public.estimation_rapport_pages
  ADD COLUMN IF NOT EXISTS contenu jsonb;

COMMENT ON COLUMN public.estimation_rapport_pages.contenu IS
  'Instantané du contenu d''une page créée. L''édition de la bibliothèque ne réécrit pas le rapport.';
