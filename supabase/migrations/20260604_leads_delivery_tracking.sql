-- =====================================================================
-- Suivi des livraisons pipeline (lots de leads)
-- ---------------------------------------------------------------------
-- `leads.delivered_at`     : date du lot (remplie par le pipeline à l'insert).
-- `profiles.leads_last_seen_at` : dernière visite dashboard par utilisateur
--                                  (bandeau « pipeline mis à jour »).
-- =====================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS delivered_at date;

UPDATE public.leads
SET delivered_at = created_at::date
WHERE delivered_at IS NULL;

ALTER TABLE public.leads
  ALTER COLUMN delivered_at SET DEFAULT (CURRENT_DATE);

-- NOT NULL après backfill — les inserts pipeline doivent renseigner delivered_at.
ALTER TABLE public.leads
  ALTER COLUMN delivered_at SET NOT NULL;

COMMENT ON COLUMN public.leads.delivered_at IS
  'Date de livraison du lot pipeline. Regroupe les leads insérés ensemble.';

CREATE INDEX IF NOT EXISTS idx_leads_agency_delivered_at
  ON public.leads (agency_id, delivered_at DESC);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leads_last_seen_at timestamptz;

COMMENT ON COLUMN public.profiles.leads_last_seen_at IS
  'Horodatage de la dernière visite du dashboard prospects par cet utilisateur.';
