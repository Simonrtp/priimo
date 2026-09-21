-- Rapport personnel de l'agent, distinct du modèle d'agence.

ALTER TABLE public.agency_rapport_pages
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS agency_rapport_pages_owner_pos_idx
  ON public.agency_rapport_pages (agency_id, owner_id, position, created_at);

COMMENT ON COLUMN public.agency_rapport_pages.owner_id IS
  'NULL = modèle de base de l''agence. Sinon, pages du rapport personnel de cet agent.';
