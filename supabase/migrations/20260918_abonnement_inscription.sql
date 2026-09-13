-- Inscription autonome + abonnement.
-- Les agences déjà là passent en actif : rien ne se casse.
-- Les colonnes de facturation ne sont pas modifiables par un client authentifié.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS statut_abonnement text,
  ADD COLUMN IF NOT EXISTS essai_fin_le timestamptz,
  ADD COLUMN IF NOT EXISTS sieges_inclus integer,
  ADD COLUMN IF NOT EXISTS prix_base numeric(10, 2),
  ADD COLUMN IF NOT EXISTS prix_siege_supplementaire numeric(10, 2),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS demande_decision text,
  ADD COLUMN IF NOT EXISTS demande_decidee_le timestamptz,
  ADD COLUMN IF NOT EXISTS demande_notes text;

UPDATE public.agencies
SET
  statut_abonnement = COALESCE(statut_abonnement, 'actif'),
  demande_decision = COALESCE(demande_decision, 'acceptee')
WHERE statut_abonnement IS NULL OR demande_decision IS NULL;

ALTER TABLE public.agencies
  ALTER COLUMN statut_abonnement SET DEFAULT 'en_attente';

ALTER TABLE public.agencies
  DROP CONSTRAINT IF EXISTS agencies_statut_abonnement_check;
ALTER TABLE public.agencies
  ADD CONSTRAINT agencies_statut_abonnement_check
  CHECK (statut_abonnement IN ('essai', 'actif', 'impaye', 'resilie', 'en_attente'));

ALTER TABLE public.agencies
  DROP CONSTRAINT IF EXISTS agencies_demande_decision_check;
ALTER TABLE public.agencies
  ADD CONSTRAINT agencies_demande_decision_check
  CHECK (demande_decision IS NULL OR demande_decision IN ('en_attente', 'acceptee', 'refusee'));

COMMENT ON COLUMN public.agencies.statut_abonnement IS
  'essai | actif | impaye | resilie | en_attente. Les existantes sont actives.';
COMMENT ON COLUMN public.agencies.essai_fin_le IS
  'Fin de l’essai, posée à l’activation. Null tant que la demande n’est pas acceptée.';
COMMENT ON COLUMN public.agencies.sieges_inclus IS
  'Sièges compris dans le prix de base, copiés depuis la config à l’activation.';
COMMENT ON COLUMN public.agencies.prix_base IS
  'Prix mensuel de base (€), copié depuis la config à l’activation.';
COMMENT ON COLUMN public.agencies.prix_siege_supplementaire IS
  'Prix d’un siège au-delà des inclus (€ / mois), copié depuis la config.';
COMMENT ON COLUMN public.agencies.stripe_subscription_id IS
  'Abonnement Stripe. Écrit uniquement par le webhook / service_role.';
COMMENT ON COLUMN public.agencies.demande_decision IS
  'Inscription : en_attente | acceptee | refusee. Les refusées restent, c’est de l’info commerciale.';

CREATE INDEX IF NOT EXISTS agencies_demande_decision_idx
  ON public.agencies (demande_decision)
  WHERE demande_decision = 'en_attente';

CREATE OR REPLACE FUNCTION public.protect_agency_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'Modification de plan interdite';
    END IF;
    IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
      RAISE EXCEPTION 'Modification de stripe_customer_id interdite';
    END IF;
    IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
      RAISE EXCEPTION 'Modification de stripe_subscription_id interdite';
    END IF;
    IF NEW.statut_abonnement IS DISTINCT FROM OLD.statut_abonnement THEN
      RAISE EXCEPTION 'Modification de statut_abonnement interdite';
    END IF;
    IF NEW.essai_fin_le IS DISTINCT FROM OLD.essai_fin_le THEN
      RAISE EXCEPTION 'Modification de essai_fin_le interdite';
    END IF;
    IF NEW.sieges_inclus IS DISTINCT FROM OLD.sieges_inclus THEN
      RAISE EXCEPTION 'Modification de sieges_inclus interdite';
    END IF;
    IF NEW.prix_base IS DISTINCT FROM OLD.prix_base THEN
      RAISE EXCEPTION 'Modification de prix_base interdite';
    END IF;
    IF NEW.prix_siege_supplementaire IS DISTINCT FROM OLD.prix_siege_supplementaire THEN
      RAISE EXCEPTION 'Modification de prix_siege_supplementaire interdite';
    END IF;
    IF NEW.demande_decision IS DISTINCT FROM OLD.demande_decision THEN
      RAISE EXCEPTION 'Modification de demande_decision interdite';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
