-- Import de contacts, étape 3.
--
-- 1. contact_imports.format : « telephone » pour les contacts choisis
--    directement dans le téléphone (Chrome sur Android).
-- 2. import_formats : les formats de fichier déjà importés. Une empreinte des
--    en-têtes (SHA-256) et les numéros de colonnes, aucun texte du fichier.
--    Commune à toutes les agences : un export relié une fois (par Mon
--    assistant ou par l'agent) est reconnu d'emblée partout.
--    Lecture et écriture : routes serveur (service role) seulement.

ALTER TABLE public.contact_imports
  DROP CONSTRAINT IF EXISTS contact_imports_format_check;

ALTER TABLE public.contact_imports
  ADD CONSTRAINT contact_imports_format_check
  CHECK (format IN ('tableur', 'vcard', 'google', 'telephone'));

CREATE TABLE IF NOT EXISTS public.import_formats (
  signature text PRIMARY KEY,
  nb_colonnes integer NOT NULL CHECK (nb_colonnes > 0),
  -- { "phone": 3, "lastName": 0, … } : champ Priimo → numéro de colonne
  correspondance jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- colonnes gardées dans le résumé
  notes integer[] NOT NULL DEFAULT '{}',
  imports integer NOT NULL DEFAULT 1,
  cree_le timestamptz NOT NULL DEFAULT now(),
  mis_a_jour_le timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.import_formats IS
  'Formats de fichiers de contacts déjà importés : empreinte des en-têtes et numéros de colonnes, sans contenu.';

-- Aucune policy : seules les routes serveur (service role) y accèdent.
ALTER TABLE public.import_formats ENABLE ROW LEVEL SECURITY;
