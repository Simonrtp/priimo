-- Harden estimation_requests: opaque edit_token for unauthenticated updates.
-- Lock agencies.plan / stripe_customer_id to service_role only.
-- Restrict leads DELETE to directeur.

-- 1) Estimation edit tokens
ALTER TABLE public.estimation_requests
  ADD COLUMN IF NOT EXISTS edit_token text;

UPDATE public.estimation_requests
SET edit_token = encode(gen_random_bytes(32), 'hex')
WHERE edit_token IS NULL;

ALTER TABLE public.estimation_requests
  ALTER COLUMN edit_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

ALTER TABLE public.estimation_requests
  ALTER COLUMN edit_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS estimation_requests_edit_token_uidx
  ON public.estimation_requests (edit_token);

COMMENT ON COLUMN public.estimation_requests.edit_token IS
  'Secret opaque renvoyé au client à la création ; requis pour tout UPDATE via /api/estimation.';

-- 2) Freeze privileged agency columns for authenticated directors
CREATE OR REPLACE FUNCTION public.protect_agency_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / postgres bypass JWT claims; authenticated clients cannot change these.
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'Modification de plan interdite';
    END IF;
    IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
      RAISE EXCEPTION 'Modification de stripe_customer_id interdite';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_agency_privileged_columns ON public.agencies;
CREATE TRIGGER trg_protect_agency_privileged_columns
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_agency_privileged_columns();

-- 3) Lead DELETE: directeur only
DROP POLICY IF EXISTS leads_delete_agency ON public.leads;
CREATE POLICY leads_delete_agency
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  );
