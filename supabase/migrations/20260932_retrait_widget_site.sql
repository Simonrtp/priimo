-- Retrait du widget d'estimation embarquable sur les sites d'agence.

DROP FUNCTION IF EXISTS public.record_widget_seen(text, text);
DROP FUNCTION IF EXISTS public.agency_estimations_today(uuid);

DROP TABLE IF EXISTS public.agency_widgets;

ALTER TABLE public.estimation_requests
  DROP COLUMN IF EXISTS widget_public_id;

ALTER TABLE public.estimation_consents
  DROP COLUMN IF EXISTS widget_public_id;
