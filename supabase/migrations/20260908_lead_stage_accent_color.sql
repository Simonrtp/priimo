ALTER TABLE public.lead_stages
  ADD COLUMN IF NOT EXISTS accent_color text;

UPDATE public.lead_stages
SET accent_color = CASE cle
  WHEN 'pris' THEN '#64748B'
  WHEN 'contacte' THEN '#E8743C'
  WHEN 'rendez_vous' THEN '#2E8B57'
  WHEN 'mandat' THEN '#2E8B57'
  WHEN 'perdu' THEN '#D16B5B'
  ELSE '#4A90E2'
END
WHERE accent_color IS NULL;

ALTER TABLE public.lead_stages
  ALTER COLUMN accent_color SET DEFAULT '#4A90E2';

ALTER TABLE public.lead_stages
  ALTER COLUMN accent_color SET NOT NULL;

ALTER TABLE public.lead_stages
  DROP CONSTRAINT IF EXISTS lead_stages_accent_color_hex_check;

ALTER TABLE public.lead_stages
  ADD CONSTRAINT lead_stages_accent_color_hex_check
  CHECK (accent_color ~* '^#[0-9a-f]{6}$');

COMMENT ON COLUMN public.lead_stages.accent_color IS
  'Couleur d’accent de la colonne kanban, personnalisable par agence.';
