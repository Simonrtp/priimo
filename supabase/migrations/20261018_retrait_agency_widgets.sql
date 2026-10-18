-- À appliquer à la main, après sauvegarde.
-- Ne pas lancer depuis l’agent. Idempotent si 20260932 a déjà été appliquée.

DROP FUNCTION IF EXISTS public.record_widget_seen(text, text);
DROP FUNCTION IF EXISTS public.agency_estimations_today(uuid);

DROP TABLE IF EXISTS public.agency_widgets;

ALTER TABLE public.estimation_requests
  DROP COLUMN IF EXISTS widget_public_id;

ALTER TABLE public.estimation_consents
  DROP COLUMN IF EXISTS widget_public_id;
