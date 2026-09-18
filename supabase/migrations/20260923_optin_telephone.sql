-- Consentement au rappel téléphonique : un seul endroit, deux provenances.
-- Et enregistrement de l'opposition.
--
-- Depuis le 11 août, appeler un particulier exige un consentement préalable et
-- prouvable. Priimo le recueille à deux endroits, et un seul schéma les reçoit :
--
--   * le tunnel /estimation et le widget embarqué sur le site de l'agence ;
--   * la page publique que le propriétaire ouvre en scannant le QR de l'agent,
--     sur le pas de sa porte, avec son propre téléphone.
--
-- Deux tables séparées auraient rendu impossible la question la plus fréquente :
-- « ai-je le droit d'appeler cette personne ? ». La réponse doit tenir en une
-- lecture, pas en une union.
--
-- `estimation_consents` (20260843) est remplacée par celle-ci. Elle compte
-- ZÉRO ligne : la reprise ne coûte rien. Elle reste en place jusqu'à ce que
-- app/api/embed/estimation/route.ts écrive ici, et sera supprimée ensuite —
-- laisser deux destinations vivantes serait la seule façon sûre de recréer le
-- problème qu'on vient d'éviter.

-- ---------------------------------------------------------------------------
-- 1) Catalogue des mentions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consentements_telephone_versions (
  version text PRIMARY KEY,
  corps text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.consentements_telephone_versions IS
  'Mentions affichées à côté de la case. {agence} est remplacé à l''affichage : le nom fait partie du texte opposable.';

-- La mention du QR terrain. Elle nomme la finalité — le recontact au sujet du
-- bien — et l'agence. Une case cochée d'avance, ou un texte qui ne dirait pas
-- pour quoi faire, ne vaudrait pas consentement.
INSERT INTO public.consentements_telephone_versions (version, corps)
VALUES (
  'qr-terrain-2026-09-v1',
  'J''accepte d''être recontacté par téléphone par {agence} au sujet de l''estimation et de la vente éventuelle de mon bien.'
)
ON CONFLICT (version) DO NOTHING;

-- Reprise de l'unique version du widget (estimation_consent_versions), à
-- l'identique, mot pour mot. Le texte n'est pas retouché au passage : les
-- consentements futurs du tunnel doivent référencer exactement ce que
-- lib/widget/consent.ts affiche déjà sous WIDGET_CONSENT_VERSION.
INSERT INTO public.consentements_telephone_versions (version, corps)
SELECT version, body FROM public.estimation_consent_versions
ON CONFLICT (version) DO NOTHING;

ALTER TABLE public.consentements_telephone_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consentements_telephone_versions_select ON public.consentements_telephone_versions;
CREATE POLICY consentements_telephone_versions_select ON public.consentements_telephone_versions
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.consentements_telephone_versions TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) La preuve du consentement — immuable
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consentements_telephone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,

  -- D'où vient l'accord. C'est la seule chose qui distingue les deux flux : le
  -- reste de la ligne a exactement la même valeur probatoire.
  provenance text NOT NULL CHECK (provenance IN (
    'page_qr_terrain',        -- QR affiché par l'agent, scanné par la personne
    'formulaire_estimation'   -- tunnel /estimation et widget des agences
  )),

  contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,

  -- Renseigné seulement quand l'accord vient du tunnel. Remplace le lien que
  -- portait estimation_consents.estimation_request_id.
  estimation_request_id uuid REFERENCES public.estimation_requests (id) ON DELETE SET NULL,

  -- L'agent qui tenait le QR. La personne se souvient d'un visage et d'un
  -- prénom, pas d'une raison sociale : sans lui, impossible de lui rappeler
  -- de quel échange il s'agit. NULL pour le tunnel, où il n'y a personne.
  agent_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  agent_prenom text,

  -- Preuve que l'accord a bien été donné devant la porte, et non recopié au
  -- bureau le soir. Facultatif : le navigateur peut refuser, et un refus de
  -- géolocalisation ne doit jamais bloquer un consentement.
  latitude double precision,
  longitude double precision,
  gps_precision_m real,

  -- Un accord peut être retiré. Une ligne n'étant jamais réécrite, le retrait
  -- est une nouvelle ligne : l'historique montre ce qui a été accordé, quand,
  -- et quand cela a cessé.
  sens text NOT NULL DEFAULT 'accord' CHECK (sens IN ('accord', 'retrait')),

  -- Ce que la personne a réellement lu, mot pour mot, nom de l'agence inclus.
  texte_affiche text NOT NULL,
  version text NOT NULL REFERENCES public.consentements_telephone_versions (version),
  texte_sha256 text NOT NULL,
  agence_nom_affiche text NOT NULL,

  horodatage timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT consentements_telephone_agent_si_qr
    CHECK (provenance <> 'page_qr_terrain' OR agent_id IS NOT NULL)
);

COMMENT ON TABLE public.consentements_telephone IS
  'Preuve du consentement au rappel téléphonique, quelle qu''en soit la provenance. Écriture seule. Remplace estimation_consents.';
COMMENT ON COLUMN public.consentements_telephone.texte_affiche IS
  'Le texte exact affiché. Si la mention change plus tard, cette ligne prouve toujours ce que CETTE personne a accepté.';
COMMENT ON COLUMN public.consentements_telephone.provenance IS
  'Seule différence entre le QR terrain et le tunnel d''estimation. Tout le reste est identique.';

CREATE INDEX IF NOT EXISTS consentements_telephone_contact_idx
  ON public.consentements_telephone (contact_id, horodatage DESC);
CREATE INDEX IF NOT EXISTS consentements_telephone_agency_idx
  ON public.consentements_telephone (agency_id, horodatage DESC);
CREATE INDEX IF NOT EXISTS consentements_telephone_agent_idx
  ON public.consentements_telephone (agent_id, horodatage DESC)
  WHERE agent_id IS NOT NULL;

-- Un tunnel validé deux fois ne produit pas deux accords. Rien d'équivalent
-- côté QR : chaque scan est une personne différente, il n'existe aucune clé
-- naturelle pour dédupliquer — c'est le jeton de session, côté 20260925, qui
-- limite les abus.
CREATE UNIQUE INDEX IF NOT EXISTS consentements_telephone_estimation_sens_uidx
  ON public.consentements_telephone (estimation_request_id, sens)
  WHERE estimation_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consentements_telephone_immuable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Seule exception : la cascade d'une agence supprimée, reconnaissable au fait
  -- que la ligne parente n'existe déjà plus. Sans elle, ce trigger rendrait la
  -- suppression d'une agence impossible.
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = OLD.agency_id)
  THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'consentements_telephone est en écriture seule : % interdit', TG_OP;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_consentements_telephone_immuable ON public.consentements_telephone;
CREATE TRIGGER trg_consentements_telephone_immuable
  BEFORE UPDATE OR DELETE ON public.consentements_telephone
  FOR EACH ROW EXECUTE FUNCTION public.consentements_telephone_immuable();

ALTER TABLE public.consentements_telephone ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consentements_telephone_select ON public.consentements_telephone;
CREATE POLICY consentements_telephone_select ON public.consentements_telephone
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

-- Écriture réservée au service_role : la page publique passe par lui, et un
-- agent ne fabrique pas un consentement depuis le dashboard.
GRANT SELECT ON public.consentements_telephone TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Opposition
-- ---------------------------------------------------------------------------
-- « Ne me recontactez plus », dit de vive voix à l'agent, ou exprimé depuis le
-- portail de droits. L'opposition doit survivre à la fiche : sinon, supprimer
-- le contact rendrait la personne à nouveau prospectable au prochain import.
-- D'où des empreintes poivrées plutôt que des coordonnées en clair — assez pour
-- bloquer, pas assez pour constituer un fichier de personnes opposées.

CREATE TABLE IF NOT EXISTS public.oppositions_personnes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,

  contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,

  -- Au moins une des deux empreintes. Poivrées côté application (secret hors
  -- base) : une empreinte nue de numéro à dix chiffres se retrouve en quelques
  -- secondes, ce qui n'aurait rien protégé.
  telephone_sha256 text,
  email_sha256 text,
  -- Forme masquée, pour que l'agent voie de quoi il s'agit sans que la table
  -- redevienne un annuaire.
  telephone_masque text,
  email_masque text,

  source text NOT NULL CHECK (source IN ('agent_terrain', 'portail_droits', 'stop_sms')),
  motif text,

  enregistre_le timestamptz NOT NULL DEFAULT now(),
  enregistre_par uuid REFERENCES public.profiles (id) ON DELETE SET NULL,

  -- Une opposition se lève si la personne revient d'elle-même. Traçable.
  levee_le timestamptz,
  levee_par uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  levee_motif text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT oppositions_personnes_une_empreinte
    CHECK (telephone_sha256 IS NOT NULL OR email_sha256 IS NOT NULL),
  CONSTRAINT oppositions_personnes_levee_motivee
    CHECK (levee_le IS NULL OR COALESCE(levee_motif, '') <> '')
);

COMMENT ON TABLE public.oppositions_personnes IS
  'Personnes ayant refusé toute prospection. Survit à la suppression de la fiche : c''est le but.';

CREATE UNIQUE INDEX IF NOT EXISTS oppositions_personnes_tel_uidx
  ON public.oppositions_personnes (agency_id, telephone_sha256)
  WHERE telephone_sha256 IS NOT NULL AND levee_le IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS oppositions_personnes_email_uidx
  ON public.oppositions_personnes (agency_id, email_sha256)
  WHERE email_sha256 IS NOT NULL AND levee_le IS NULL;
CREATE INDEX IF NOT EXISTS oppositions_personnes_contact_idx
  ON public.oppositions_personnes (contact_id);

DROP TRIGGER IF EXISTS trg_oppositions_personnes_updated ON public.oppositions_personnes;
CREATE TRIGGER trg_oppositions_personnes_updated
  BEFORE UPDATE ON public.oppositions_personnes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.oppositions_personnes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oppositions_personnes_select ON public.oppositions_personnes;
CREATE POLICY oppositions_personnes_select ON public.oppositions_personnes
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

-- L'agent enregistre l'opposition depuis la fiche : c'est lui qui a la personne
-- au téléphone. Écrire une opposition ne nuit à personne ; c'est la lever qui
-- engage, et la levée passe par le service_role après contrôle.
DROP POLICY IF EXISTS oppositions_personnes_insert ON public.oppositions_personnes;
CREATE POLICY oppositions_personnes_insert ON public.oppositions_personnes
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND enregistre_par = (SELECT auth.uid())
    AND levee_le IS NULL
  );

GRANT SELECT ON public.oppositions_personnes TO authenticated;
GRANT INSERT ON public.oppositions_personnes TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Le drapeau sur la fiche
-- ---------------------------------------------------------------------------
-- La fiche reste visible — l'agent doit savoir que la personne existe et
-- pourquoi il ne doit pas l'appeler — mais sort de la prospection. Colonne
-- dénormalisée pour que chaque écran de prospection puisse filtrer sans
-- jointure, et pour que lib/agency/visibility.ts ait un champ à lire.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS opposition_le timestamptz;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS opposition_le timestamptz;

COMMENT ON COLUMN public.contacts.opposition_le IS
  'Non NULL = la personne s''est opposée. Fiche consultable, jamais exploitable en prospection ni notifiable.';

CREATE INDEX IF NOT EXISTS contacts_opposition_idx
  ON public.contacts (agency_id) WHERE opposition_le IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_opposition_idx
  ON public.leads (agency_id) WHERE opposition_le IS NOT NULL;

-- Le drapeau suit l'opposition, dans les deux sens, sans que personne ait à y
-- penser depuis l'application.
CREATE OR REPLACE FUNCTION public.propager_opposition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE public.contacts
    SET opposition_le = CASE WHEN NEW.levee_le IS NULL THEN NEW.enregistre_le ELSE NULL END
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_oppositions_propager ON public.oppositions_personnes;
CREATE TRIGGER trg_oppositions_propager
  AFTER INSERT OR UPDATE ON public.oppositions_personnes
  FOR EACH ROW EXECUTE FUNCTION public.propager_opposition();
