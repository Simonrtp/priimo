-- Ordre manuel des contacts (liste « prenables », style boîte mail).
-- Position fractionnaire : un drag ne renumérote qu'une fiche.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS position numeric;

COMMENT ON COLUMN public.contacts.position IS
  'Ordre d’affichage dans la liste contacts (fractionnaire, plus petit = plus haut).';

-- Agences existantes : du plus récent au plus ancien, pas de 1000 en 1000.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY agency_id
      ORDER BY created_at DESC NULLS LAST, id
    ) AS rn
  FROM public.contacts
  WHERE position IS NULL
)
UPDATE public.contacts c
SET position = ranked.rn * 1000
FROM ranked
WHERE c.id = ranked.id;

CREATE INDEX IF NOT EXISTS contacts_agency_position_idx
  ON public.contacts (agency_id, position);
