-- Diffusion portails (sortant) + captation leads entrants (Gmail).
-- Isolation agence : agency_id + current_user_agency_id() / current_user_agency_ids().
-- Jetons OAuth / passerelle : chiffrés côté app (bytea), jamais en clair, jamais client.

-- ---------------------------------------------------------------------------
-- 1) Contacts : origines élargies + provenance RGPD
-- ---------------------------------------------------------------------------
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_source_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_source_check
  CHECK (source IN (
    'manuel',
    'vocal',
    'prospection',
    'portail',
    'site_agence',
    'seloger',
    'bienici',
    'logicimmo',
    'leboncoin',
    'autre_portail'
  ));

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS collecte_provenance text NULL,
  ADD COLUMN IF NOT EXISTS collecte_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS collecte_base_legale text NULL;

COMMENT ON COLUMN public.contacts.collecte_provenance IS
  'Origine de la collecte (ex. email SeLoger). Requis pour les imports portail (RGPD).';
COMMENT ON COLUMN public.contacts.collecte_at IS
  'Date/heure de collecte des données personnelles importées.';
COMMENT ON COLUMN public.contacts.collecte_base_legale IS
  'Base légale / note juridique (avocat). Champ présent ; contenu à valider hors code.';

-- Négociateur porteur du mandat (assignation leads entrants)
ALTER TABLE public.biens
  ADD COLUMN IF NOT EXISTS assigned_to uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS biens_agency_assigned_idx
  ON public.biens (agency_id, assigned_to)
  WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN public.biens.assigned_to IS
  'Négociateur qui porte le mandat. Utilisé pour assigner les demandes portail entrantes.';

-- ---------------------------------------------------------------------------
-- 2) diffusion_portails — connexions agence × portail (via passerelle)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diffusion_portails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  portail text NOT NULL
    CHECK (portail IN (
      'seloger', 'bienici', 'logicimmo', 'leboncoin', 'ouestfrance', 'autre'
    )),
  actif boolean NOT NULL DEFAULT false,
  -- Identifiant de compte chez le portail / la passerelle (pas un secret).
  compte_externe_id text NULL,
  -- État de la connexion côté passerelle.
  etat text NOT NULL DEFAULT 'non_configure'
    CHECK (etat IN (
      'non_configure', 'en_attente', 'connecte', 'erreur', 'suspendu'
    )),
  dernier_erreur text NULL,
  -- Métadonnées non secrètes (libellé compte, etc.).
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, portail)
);

COMMENT ON TABLE public.diffusion_portails IS
  'Portails activés par agence. Les abonnements SeLoger/Bien''ici/Logic-Immo '
  'restent facturés à l''agence — Priimo ne les revend pas.';

CREATE INDEX IF NOT EXISTS diffusion_portails_agency_idx
  ON public.diffusion_portails (agency_id);

DROP TRIGGER IF EXISTS trg_diffusion_portails_updated ON public.diffusion_portails;
CREATE TRIGGER trg_diffusion_portails_updated
  BEFORE UPDATE ON public.diffusion_portails
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.diffusion_portails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diffusion_portails_select ON public.diffusion_portails;
CREATE POLICY diffusion_portails_select ON public.diffusion_portails
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS diffusion_portails_write ON public.diffusion_portails;
CREATE POLICY diffusion_portails_write ON public.diffusion_portails
  FOR ALL TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  )
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  );

-- ---------------------------------------------------------------------------
-- 3) diffusion_annonces — bien × portail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diffusion_annonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  bien_id uuid NOT NULL REFERENCES public.biens (id) ON DELETE CASCADE,
  portail text NOT NULL
    CHECK (portail IN (
      'seloger', 'bienici', 'logicimmo', 'leboncoin', 'ouestfrance', 'autre'
    )),
  statut text NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN (
      'brouillon', 'en_attente', 'publiee', 'refusee', 'retiree'
    )),
  -- Référence renvoyée par le portail / la passerelle (idempotence).
  reference_portail text NULL,
  -- Clé d'idempotence stable Priimo (bien + portail).
  cle_idempotence text NOT NULL,
  publiee_at timestamptz NULL,
  retiree_at timestamptz NULL,
  dernier_erreur text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, bien_id, portail),
  UNIQUE (agency_id, cle_idempotence)
);

COMMENT ON TABLE public.diffusion_annonces IS
  'Projection d''un bien sur un portail. Le bien reste la source de vérité ; '
  'l''annonce n''est pas éditable séparément.';

CREATE INDEX IF NOT EXISTS diffusion_annonces_agency_bien_idx
  ON public.diffusion_annonces (agency_id, bien_id);
CREATE INDEX IF NOT EXISTS diffusion_annonces_ref_idx
  ON public.diffusion_annonces (agency_id, reference_portail)
  WHERE reference_portail IS NOT NULL;

DROP TRIGGER IF EXISTS trg_diffusion_annonces_updated ON public.diffusion_annonces;
CREATE TRIGGER trg_diffusion_annonces_updated
  BEFORE UPDATE ON public.diffusion_annonces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.diffusion_annonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diffusion_annonces_select ON public.diffusion_annonces;
CREATE POLICY diffusion_annonces_select ON public.diffusion_annonces
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS diffusion_annonces_write ON public.diffusion_annonces;
CREATE POLICY diffusion_annonces_write ON public.diffusion_annonces
  FOR ALL TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());

-- ---------------------------------------------------------------------------
-- 4) diffusion_evenements — journal durable
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diffusion_evenements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  annonce_id uuid NULL REFERENCES public.diffusion_annonces (id) ON DELETE SET NULL,
  bien_id uuid NULL REFERENCES public.biens (id) ON DELETE SET NULL,
  portail text NULL,
  sens text NOT NULL DEFAULT 'sortie'
    CHECK (sens IN ('sortie', 'entree', 'systeme')),
  kind text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.diffusion_evenements IS
  'Journal des envois / retours portail. Un refus doit rester lisible ≥ 6 mois.';

CREATE INDEX IF NOT EXISTS diffusion_evenements_agency_created_idx
  ON public.diffusion_evenements (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS diffusion_evenements_annonce_idx
  ON public.diffusion_evenements (annonce_id, created_at DESC)
  WHERE annonce_id IS NOT NULL;

ALTER TABLE public.diffusion_evenements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diffusion_evenements_select ON public.diffusion_evenements;
CREATE POLICY diffusion_evenements_select ON public.diffusion_evenements
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS diffusion_evenements_insert ON public.diffusion_evenements;
CREATE POLICY diffusion_evenements_insert ON public.diffusion_evenements
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id());

-- Pas d'UPDATE/DELETE client : journal append-only côté app (service_role pour purge).

-- ---------------------------------------------------------------------------
-- 5) Domaines email portails (liste blanche captation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portail_email_domaines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domaine text NOT NULL,
  portail text NOT NULL
    CHECK (portail IN (
      'seloger', 'bienici', 'logicimmo', 'leboncoin', 'ouestfrance',
      'site_agence', 'autre'
    )),
  actif boolean NOT NULL DEFAULT true,
  agency_id uuid NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  -- NULL agency_id = domaine global (toutes agences).
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.portail_email_domaines IS
  'Liste blanche des expéditeurs portail. Seuls ces domaines sont lus via Gmail. '
  'agency_id NULL = global ; sinon override / ajout agence.';

CREATE UNIQUE INDEX IF NOT EXISTS portail_email_domaines_global_uidx
  ON public.portail_email_domaines (domaine)
  WHERE agency_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS portail_email_domaines_agency_uidx
  ON public.portail_email_domaines (domaine, agency_id)
  WHERE agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS portail_email_domaines_domaine_idx
  ON public.portail_email_domaines (domaine)
  WHERE actif;

ALTER TABLE public.portail_email_domaines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portail_email_domaines_select ON public.portail_email_domaines;
CREATE POLICY portail_email_domaines_select ON public.portail_email_domaines
  FOR SELECT TO authenticated
  USING (
    agency_id IS NULL
    OR agency_id = public.current_user_agency_id()
  );

DROP POLICY IF EXISTS portail_email_domaines_write ON public.portail_email_domaines;
CREATE POLICY portail_email_domaines_write ON public.portail_email_domaines
  FOR ALL TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  )
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  );

INSERT INTO public.portail_email_domaines (domaine, portail, actif, agency_id)
SELECT v.domaine, v.portail, true, NULL
FROM (VALUES
  ('seloger.com', 'seloger'),
  ('groupeseloger.com', 'seloger'),
  ('mail.seloger.com', 'seloger'),
  ('bienici.com', 'bienici'),
  ('logic-immo.com', 'logicimmo'),
  ('logicimmo.com', 'logicimmo'),
  ('leboncoin.fr', 'leboncoin'),
  ('leboncoin.com', 'leboncoin')
) AS v(domaine, portail)
WHERE NOT EXISTS (
  SELECT 1 FROM public.portail_email_domaines d
  WHERE d.domaine = v.domaine AND d.agency_id IS NULL
);

-- ---------------------------------------------------------------------------
-- 6) Connexion Gmail (jetons chiffrés, par utilisateur × agence)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gmail_connexions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  gmail_address text NOT NULL,
  -- Access + refresh tokens chiffrés (AES-GCM app). Jamais en clair.
  token_ciphertext bytea NOT NULL,
  token_nonce bytea NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['https://www.googleapis.com/auth/gmail.readonly'],
  watch_history_id text NULL,
  watch_expiration timestamptz NULL,
  pubsub_topic text NULL,
  etat text NOT NULL DEFAULT 'actif'
    CHECK (etat IN ('actif', 'revoke', 'erreur', 'en_attente_verif_oauth')),
  dernier_erreur text NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, profile_id)
);

COMMENT ON TABLE public.gmail_connexions IS
  'OAuth Gmail gmail.readonly par utilisateur. Scope restreint Google : '
  'vérification OAuth + audit annuel requis avant prod >100 users test.';

DROP TRIGGER IF EXISTS trg_gmail_connexions_updated ON public.gmail_connexions;
CREATE TRIGGER trg_gmail_connexions_updated
  BEFORE UPDATE ON public.gmail_connexions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.gmail_connexions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gmail_connexions_select ON public.gmail_connexions;
CREATE POLICY gmail_connexions_select ON public.gmail_connexions
  FOR SELECT TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND (
      profile_id = auth.uid()
      OR public.current_user_role() = 'directeur'
    )
  );

-- Écriture uniquement via service_role (routes serveur) — pas de policy INSERT client.
REVOKE INSERT, UPDATE, DELETE ON public.gmail_connexions FROM authenticated;

-- ---------------------------------------------------------------------------
-- 7) Leads entrants (staging / journal métier, pas le corps email)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads_portail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  portail text NOT NULL,
  gmail_message_id text NOT NULL,
  -- Dédup absolue : un message Gmail = une ligne.
  contact_id uuid NULL REFERENCES public.contacts (id) ON DELETE SET NULL,
  bien_id uuid NULL REFERENCES public.biens (id) ON DELETE SET NULL,
  annonce_id uuid NULL REFERENCES public.diffusion_annonces (id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'importe'
    CHECK (statut IN (
      'importe', 'a_traiter_main', 'doublon', 'ignore', 'erreur_parse'
    )),
  nom text NULL,
  telephone text NULL,
  email text NULL,
  reference_annonce text NULL,
  type_demande text NULL,
  message_extrait text NULL,
  demande_at timestamptz NULL,
  parse_erreur text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, gmail_message_id)
);

COMMENT ON TABLE public.leads_portail IS
  'Demandes extraites des emails portail. Aucun corps brut stocké — '
  'seulement champs utiles + gmail_message_id anti-doublon.';

CREATE INDEX IF NOT EXISTS leads_portail_agency_created_idx
  ON public.leads_portail (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_portail_contact_idx
  ON public.leads_portail (contact_id)
  WHERE contact_id IS NOT NULL;

ALTER TABLE public.leads_portail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_portail_select ON public.leads_portail;
CREATE POLICY leads_portail_select ON public.leads_portail
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS leads_portail_write ON public.leads_portail;
CREATE POLICY leads_portail_write ON public.leads_portail
  FOR ALL TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diffusion_portails TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diffusion_annonces TO authenticated;
GRANT SELECT, INSERT ON public.diffusion_evenements TO authenticated;
GRANT SELECT ON public.portail_email_domaines TO authenticated;
GRANT SELECT ON public.gmail_connexions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.leads_portail TO authenticated;
