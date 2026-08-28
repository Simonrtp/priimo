-- Widget d'estimation embarquable sur le site des agences.
--
-- Depuis l'interdiction du démarchage téléphonique du 11 août, un numéro de
-- particulier n'est appelable que s'il a été donné avec un consentement
-- explicite. Ce schéma stocke donc la preuve de ce consentement de façon
-- immuable : le texte exact affiché, sa version, l'horodatage, l'IP et la page
-- d'origine. Aucune ligne ne peut être modifiée ni supprimée après coup.

-- ---------------------------------------------------------------------------
-- 1) Configuration du widget, une ligne par agence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_widgets (
  agency_id uuid PRIMARY KEY REFERENCES public.agencies (id) ON DELETE CASCADE,

  -- Identifiant public collé dans data-agency. Opaque : ne révèle pas l'uuid.
  public_id text NOT NULL UNIQUE
    CHECK (public_id ~ '^[a-z0-9]{10,32}$'),

  enabled boolean NOT NULL DEFAULT false,

  -- Apparence côté site de l'agence.
  display_name text,
  accent_color text NOT NULL DEFAULT '#1F2937'
    CHECK (accent_color ~* '^#[0-9a-f]{6}$'),
  logo_url text,

  -- Domaines autorisés à charger le widget. Vide = aucun (le widget refuse).
  -- Stockés normalisés en minuscules, sans schéma ni port : « agence.fr ».
  allowed_domains text[] NOT NULL DEFAULT '{}',

  -- Plafond quotidien d'estimations abouties, garde-fou anti-abus.
  daily_cap integer NOT NULL DEFAULT 50 CHECK (daily_cap BETWEEN 1 AND 5000),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agency_widgets IS
  'Configuration du widget d''estimation embarqué sur le site de l''agence.';
COMMENT ON COLUMN public.agency_widgets.allowed_domains IS
  'Liste blanche des domaines. Contrôlée côté serveur sur l''origine de la requête.';
COMMENT ON COLUMN public.agency_widgets.daily_cap IS
  'Nombre maximum d''estimations abouties par jour civil pour cette agence.';

CREATE INDEX IF NOT EXISTS agency_widgets_enabled_idx
  ON public.agency_widgets (public_id) WHERE enabled;

DROP TRIGGER IF EXISTS trg_agency_widgets_updated ON public.agency_widgets;
CREATE TRIGGER trg_agency_widgets_updated
  BEFORE UPDATE ON public.agency_widgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agency_widgets ENABLE ROW LEVEL SECURITY;

-- Le membre de l'agence lit sa configuration ; l'écriture reste filtrée par
-- l'API (directeur seul). Isolation stricte : jamais une autre agence.
DROP POLICY IF EXISTS agency_widgets_select ON public.agency_widgets;
CREATE POLICY agency_widgets_select ON public.agency_widgets
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS agency_widgets_insert ON public.agency_widgets;
CREATE POLICY agency_widgets_insert ON public.agency_widgets
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS agency_widgets_update ON public.agency_widgets;
CREATE POLICY agency_widgets_update ON public.agency_widgets
  FOR UPDATE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()))
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

GRANT SELECT, INSERT, UPDATE ON public.agency_widgets TO authenticated;

-- Aucune policy pour anon : la page publique passe par le service_role, qui
-- ne renvoie au navigateur que le nom, le logo et la couleur.

-- ---------------------------------------------------------------------------
-- 2) Catalogue des textes de consentement
--    Une version n'est jamais réécrite : on en ajoute une nouvelle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estimation_consent_versions (
  version text PRIMARY KEY,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.estimation_consent_versions IS
  'Historique des mentions de consentement. Le corps contient {agence}, remplacé à l''affichage.';

ALTER TABLE public.estimation_consent_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estimation_consent_versions_select ON public.estimation_consent_versions;
CREATE POLICY estimation_consent_versions_select ON public.estimation_consent_versions
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.estimation_consent_versions TO authenticated;

INSERT INTO public.estimation_consent_versions (version, body)
VALUES (
  'widget-2026-08-v1',
  'J''accepte d''être recontacté par téléphone par {agence} au sujet de l''estimation de mon bien et de mon projet immobilier.'
)
ON CONFLICT (version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Colonnes ajoutées aux demandes d'estimation
-- ---------------------------------------------------------------------------
ALTER TABLE public.estimation_requests
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'priimo',
  ADD COLUMN IF NOT EXISTS origin_url text,
  ADD COLUMN IF NOT EXISTS widget_public_id text,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimation_price_per_m2 integer,
  ADD COLUMN IF NOT EXISTS estimation_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS estimation_sources jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.estimation_requests.source IS
  'priimo (funnel priimo.fr) | estimation_site_agence (widget embarqué).';
COMMENT ON COLUMN public.estimation_requests.origin_url IS
  'URL de la page qui portait le widget au moment de la demande.';

CREATE INDEX IF NOT EXISTS estimation_requests_agency_created_idx
  ON public.estimation_requests (agency_id, created_at DESC)
  WHERE agency_id IS NOT NULL;

-- Jusqu'ici estimation_requests n'avait aucune policy : seul le service_role
-- y accédait. Le widget rend ces demandes visibles dans le dashboard, donc
-- l'agence doit pouvoir lire les siennes — et seulement les siennes.
DROP POLICY IF EXISTS estimation_requests_select_agency ON public.estimation_requests;
CREATE POLICY estimation_requests_select_agency ON public.estimation_requests
  FOR SELECT TO authenticated
  USING (agency_id IS NOT NULL AND agency_id = (SELECT public.current_user_agency_id()));

-- Suivi du traitement (statut, prise en charge). Le contenu de la demande et
-- la preuve de consentement ne sont pas modifiables par ce biais : la preuve
-- vit dans estimation_consents, table en écriture seule.
DROP POLICY IF EXISTS estimation_requests_update_agency ON public.estimation_requests;
CREATE POLICY estimation_requests_update_agency ON public.estimation_requests
  FOR UPDATE TO authenticated
  USING (agency_id IS NOT NULL AND agency_id = (SELECT public.current_user_agency_id()))
  WITH CHECK (agency_id IS NOT NULL AND agency_id = (SELECT public.current_user_agency_id()));

-- Droits colonne par colonne : `edit_token` est le secret qui permet de
-- réécrire un brouillon depuis le navigateur du visiteur. Il n'a rien à faire
-- dans une réponse lue par le dashboard.
GRANT SELECT (
  id, created_at, agency_id, source, origin_url, widget_public_id,
  address, latitude, longitude, postal_code, insee_code,
  property_type, surface_m2, rooms, floor, has_elevator, bathrooms,
  features, view_type, construction_year, dpe_class, condition_rating,
  is_owner, residence_type, sale_timeline,
  civility, first_name, last_name, phone, email,
  consent_given, consent_text, consent_version, consent_at,
  consent_ip, consent_user_agent,
  estimation_low, estimation_value, estimation_high,
  estimation_price_per_m2, estimation_confidence,
  estimation_context, estimation_sources,
  status, assigned_agency_id, assigned_to, contact_id
) ON public.estimation_requests TO authenticated;

-- Seul le suivi est modifiable : ni les réponses du visiteur, ni le consentement.
GRANT UPDATE (status, assigned_to, contact_id) ON public.estimation_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Preuve de consentement — append-only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estimation_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimation_request_id uuid NOT NULL
    REFERENCES public.estimation_requests (id) ON DELETE RESTRICT,
  agency_id uuid REFERENCES public.agencies (id) ON DELETE SET NULL,

  -- Ce qui a été coché, mot pour mot, au moment du clic.
  consent_text text NOT NULL,
  consent_version text NOT NULL,
  consent_text_sha256 text NOT NULL,

  agency_name_displayed text,
  channel text NOT NULL DEFAULT 'telephone',

  consent_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  origin_url text,
  widget_public_id text,

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.estimation_consents IS
  'Preuve immuable du consentement au rappel téléphonique. Aucune mise à jour ni suppression.';
COMMENT ON COLUMN public.estimation_consents.consent_text IS
  'Texte exact affiché à la personne — jamais un identifiant de version seul.';

CREATE INDEX IF NOT EXISTS estimation_consents_request_idx
  ON public.estimation_consents (estimation_request_id);
CREATE INDEX IF NOT EXISTS estimation_consents_agency_idx
  ON public.estimation_consents (agency_id, consent_at DESC);

-- Immuabilité : le trigger refuse toute écriture qui n'est pas un INSERT,
-- y compris depuis le service_role.
CREATE OR REPLACE FUNCTION public.estimation_consents_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  RAISE EXCEPTION 'estimation_consents est en écriture seule : % interdit', TG_OP;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_estimation_consents_no_update ON public.estimation_consents;
CREATE TRIGGER trg_estimation_consents_no_update
  BEFORE UPDATE OR DELETE ON public.estimation_consents
  FOR EACH ROW EXECUTE FUNCTION public.estimation_consents_immutable();

ALTER TABLE public.estimation_consents ENABLE ROW LEVEL SECURITY;

-- L'agence peut relire ses propres preuves (défense en cas de contrôle).
DROP POLICY IF EXISTS estimation_consents_select ON public.estimation_consents;
CREATE POLICY estimation_consents_select ON public.estimation_consents
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

GRANT SELECT ON public.estimation_consents TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Compteur anti-abus — estimations abouties du jour pour une agence
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agency_estimations_today(p_agency_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COUNT(*)::integer
  FROM public.estimation_requests
  WHERE agency_id = p_agency_id
    AND consent_given
    AND created_at >= date_trunc('day', now());
$fn$;

REVOKE ALL ON FUNCTION public.agency_estimations_today(uuid) FROM PUBLIC;
-- Seule la route publique du widget compte les demandes du jour.
GRANT EXECUTE ON FUNCTION public.agency_estimations_today(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Valeur centrale de l'avis de valeur
--    La fourchette n'est plus le titre : c'est la valeur centrale qui l'est,
--    et elle doit être relue telle quelle depuis la page publique /avis.
-- ---------------------------------------------------------------------------
ALTER TABLE public.agency_estimations
  ADD COLUMN IF NOT EXISTS price_value integer;

COMMENT ON COLUMN public.agency_estimations.price_value IS
  'Valeur centrale retenue. price_low / price_high peuvent être nuls si la dispersion est trop élevée.';
