-- Un numéro détenu n'est pas un numéro appelable.
--
-- Le consentement recueilli par QR (ou par le tunnel d'estimation) ouvre le
-- droit d'appeler et d'envoyer des messages. Il ne conditionne ni la prise de
-- note, ni la création de contact, ni la dictée : ces actes relèvent de
-- l'intérêt légitime, déjà couvert par le support premier_contact (20260922).
--
-- La preuve reste dans consentements_telephone, en écriture seule. On y ajoute
-- le numéro saisi — sans lui, un accord ne pourrait pas vivre sans fiche, et le
-- QR créerait des contacts pour exister. C'est précisément ce qu'on refuse :
-- la personne donne son accord ; la fiche naît plus tard, de la dictée, au
-- bureau.
--
-- telephone_consenti_le est un drapeau dénormalisé, même esprit que
-- opposition_le : chaque écran lit un champ, pas une jointure. NULL = le
-- numéro s'affiche, aucune action d'appel / SMS / mail.

-- ---------------------------------------------------------------------------
-- 1) Normalisation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normaliser_telephone(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d = '' THEN NULL
    WHEN d LIKE '0033%' AND length(d) >= 13 THEN '0' || substr(d, 5)
    WHEN d LIKE '33%' AND length(d) >= 11 THEN '0' || substr(d, 3)
    ELSE d
  END
  FROM (SELECT regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g') AS d) s;
$$;

COMMENT ON FUNCTION public.normaliser_telephone(text) IS
  'Chiffres seuls, +33 → 0. Sert à rattacher un consentement à un numéro, pas à une fiche.';

-- ---------------------------------------------------------------------------
-- 2) Ce que la personne a saisi sur la page QR
-- ---------------------------------------------------------------------------
ALTER TABLE public.consentements_telephone
  ADD COLUMN IF NOT EXISTS telephone_normalise text;
ALTER TABLE public.consentements_telephone
  ADD COLUMN IF NOT EXISTS prenom_saisi text;
ALTER TABLE public.consentements_telephone
  ADD COLUMN IF NOT EXISTS nom_saisi text;
ALTER TABLE public.consentements_telephone
  ADD COLUMN IF NOT EXISTS email_saisi text;

COMMENT ON COLUMN public.consentements_telephone.telephone_normalise IS
  'Numéro auquel l''accord s''applique. Peut exister sans contact_id : le QR ne crée pas de fiche.';
COMMENT ON COLUMN public.consentements_telephone.prenom_saisi IS
  'Prénom tapé sur la page publique. Sert à la confirmation agent, pas à ouvrir une fiche.';

CREATE INDEX IF NOT EXISTS consentements_telephone_numero_idx
  ON public.consentements_telephone (agency_id, telephone_normalise, horodatage DESC)
  WHERE telephone_normalise IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Drapeau sur la fiche — lecture, jamais décision
-- ---------------------------------------------------------------------------
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS telephone_consenti_le timestamptz;
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS telephone_consenti_le timestamptz;

COMMENT ON COLUMN public.contacts.telephone_consenti_le IS
  'Horodatage du dernier accord encore valable pour le numéro de cette fiche. NULL = numéro visible, non appelable. N''interdit ni la note ni la création.';
COMMENT ON COLUMN public.leads.telephone_consenti_le IS
  'Idem, pour owner_phone / company_phone. Un lead peut porter un numéro longtemps sans jamais être appelable.';

CREATE INDEX IF NOT EXISTS contacts_telephone_consenti_idx
  ON public.contacts (agency_id)
  WHERE telephone_consenti_le IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_telephone_consenti_idx
  ON public.leads (agency_id)
  WHERE telephone_consenti_le IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) Propagation : l'accord suit le numéro, la fiche le rattrape
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dernier_accord_telephone(p_agency uuid, p_tel text)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT CASE WHEN x.sens = 'accord' THEN x.horodatage ELSE NULL END
  FROM (
    SELECT sens, horodatage
    FROM public.consentements_telephone
    WHERE agency_id = p_agency
      AND telephone_normalise = p_tel
    ORDER BY horodatage DESC
    LIMIT 1
  ) x;
$$;

CREATE OR REPLACE FUNCTION public.propager_consentement_telephone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_le timestamptz;
BEGIN
  IF NEW.telephone_normalise IS NULL THEN
    RETURN NEW;
  END IF;

  v_le := public.dernier_accord_telephone(NEW.agency_id, NEW.telephone_normalise);

  UPDATE public.contacts
  SET telephone_consenti_le = v_le
  WHERE agency_id = NEW.agency_id
    AND public.normaliser_telephone(phone) = NEW.telephone_normalise;

  UPDATE public.leads
  SET telephone_consenti_le = v_le
  WHERE agency_id = NEW.agency_id
    AND (
      public.normaliser_telephone(owner_phone) = NEW.telephone_normalise
      OR public.normaliser_telephone(company_phone) = NEW.telephone_normalise
    );

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.propager_consentement_telephone() IS
  'Un accord (ou un retrait) se pose sur tous les numéros identiques de l''agence. Jamais de création de fiche.';

DROP TRIGGER IF EXISTS trg_consentements_propager ON public.consentements_telephone;
CREATE TRIGGER trg_consentements_propager
  AFTER INSERT ON public.consentements_telephone
  FOR EACH ROW EXECUTE FUNCTION public.propager_consentement_telephone();

CREATE OR REPLACE FUNCTION public.rattacher_consentement_au_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_tel text;
BEGIN
  v_tel := public.normaliser_telephone(NEW.phone);
  IF v_tel IS NULL THEN
    NEW.telephone_consenti_le := NULL;
    RETURN NEW;
  END IF;
  NEW.telephone_consenti_le := public.dernier_accord_telephone(NEW.agency_id, v_tel);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_contacts_rattacher_consentement ON public.contacts;
CREATE TRIGGER trg_contacts_rattacher_consentement
  BEFORE INSERT OR UPDATE OF phone ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.rattacher_consentement_au_numero();

CREATE OR REPLACE FUNCTION public.rattacher_consentement_au_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_owner text;
  v_co text;
  v_le timestamptz;
BEGIN
  v_owner := public.normaliser_telephone(NEW.owner_phone);
  v_co := public.normaliser_telephone(NEW.company_phone);
  v_le := NULL;
  IF v_owner IS NOT NULL THEN
    v_le := public.dernier_accord_telephone(NEW.agency_id, v_owner);
  END IF;
  IF v_le IS NULL AND v_co IS NOT NULL THEN
    v_le := public.dernier_accord_telephone(NEW.agency_id, v_co);
  END IF;
  NEW.telephone_consenti_le := v_le;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_leads_rattacher_consentement ON public.leads;
CREATE TRIGGER trg_leads_rattacher_consentement
  BEFORE INSERT OR UPDATE OF owner_phone, company_phone ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.rattacher_consentement_au_lead();
