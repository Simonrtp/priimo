-- =====================================================================
-- Priimo — Schéma production (Supabase / PostgreSQL)
-- ---------------------------------------------------------------------
--  Architecture
--  ------------
--  - `auth.users`            : géré nativement par Supabase Auth (email,
--                              mot de passe, sessions). On ne le modifie
--                              jamais directement.
--  - `public.agencies`       : 1 ligne par agence cliente.
--  - `public.profiles`       : étend `auth.users` avec nos données métier
--                              (agence, rôle, identité). Lien 1-1 sur
--                              `auth.users.id`.
--  - `public.invitations`    : tokens d'invitation (onboarding directeur
--                              ou collaborateur). Consommés à la création
--                              de compte.
--
--  Sécurité
--  --------
--  - Row Level Security (RLS) activée sur toutes les tables.
--  - Aucun accès direct par défaut : tout passe par des policies explicites.
--  - Les opérations sensibles (création d'agence + premier directeur,
--    acceptation d'invitation) doivent être faites côté serveur via la
--    clé `service_role` qui bypasse RLS.
--  - Deux helpers SECURITY DEFINER (`current_user_agency_id`,
--    `current_user_role`) évitent la récursion infinie des policies qui
--    interrogent `profiles`.
--
--  Comment l'exécuter
--  ------------------
--  Supabase → SQL Editor → coller ce fichier → Run. Le script est
--  IDEMPOTENT : peut être ré-exécuté sans erreur (CREATE IF NOT EXISTS,
--  DROP POLICY IF EXISTS, CREATE OR REPLACE FUNCTION, etc.).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------
-- `pgcrypto` fournit `gen_random_uuid()` utilisé comme défaut des PK.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ---------------------------------------------------------------------
-- 1. Fonction utilitaire : trigger générique `set_updated_at`
-- ---------------------------------------------------------------------
-- Met à jour automatiquement la colonne `updated_at` à chaque UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- 2. Table `agencies`
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text          NOT NULL,
  address             text,
  phone               text,
  email               text,
  plan                text          NOT NULL DEFAULT 'fondateur',
  zone_type           text          NOT NULL DEFAULT 'radius',
  zone_center_address text,
  zone_latitude       double precision,
  zone_longitude      double precision,
  zone_radius_km      numeric,
  zone_postal_codes   text[],
  stripe_customer_id  text,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT agencies_plan_check
    CHECK (plan IN ('fondateur', 'standard', 'premium', 'reseau')),
  CONSTRAINT agencies_zone_radius_positive
    CHECK (zone_radius_km IS NULL OR zone_radius_km > 0),
  CONSTRAINT agencies_zone_type_check
    CHECK (zone_type IN ('radius', 'postal_codes'))
);

COMMENT ON TABLE  public.agencies                     IS 'Agences clientes Priimo (une ligne par agence).';
COMMENT ON COLUMN public.agencies.plan                IS 'Plan d''abonnement : fondateur | standard | premium | reseau.';
COMMENT ON COLUMN public.agencies.zone_center_address IS 'Adresse du centre de la zone de prospection (libellé BAN).';
COMMENT ON COLUMN public.agencies.zone_latitude       IS 'Latitude du centre de zone (WGS84).';
COMMENT ON COLUMN public.agencies.zone_longitude      IS 'Longitude du centre de zone (WGS84).';
COMMENT ON COLUMN public.agencies.zone_radius_km      IS 'Rayon de la zone de prospection en kilomètres.';
COMMENT ON COLUMN public.agencies.zone_type           IS 'Mode de zone : radius | postal_codes.';
COMMENT ON COLUMN public.agencies.zone_postal_codes   IS 'Codes postaux Paris (75001–75020) si zone_type = postal_codes.';

ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS zone_type text NOT NULL DEFAULT 'radius';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS zone_postal_codes text[];
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS zone_latitude double precision;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS zone_longitude double precision;
COMMENT ON COLUMN public.agencies.stripe_customer_id  IS 'Identifiant client Stripe — rempli au passage à un plan payant.';

CREATE INDEX IF NOT EXISTS idx_agencies_plan ON public.agencies (plan);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_agencies_set_updated_at ON public.agencies;
CREATE TRIGGER trg_agencies_set_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------
-- 3. Table `profiles`
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id   uuid          NOT NULL    REFERENCES public.agencies(id) ON DELETE CASCADE,
  role        text          NOT NULL,
  first_name  text          NOT NULL,
  last_name   text          NOT NULL,
  phone       text,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT profiles_role_check
    CHECK (role IN ('directeur', 'collaborateur'))
);

COMMENT ON TABLE  public.profiles            IS 'Profils métier liés 1-1 aux utilisateurs auth.users.';
COMMENT ON COLUMN public.profiles.agency_id  IS 'Agence d''appartenance — un user ne peut être que dans UNE agence.';
COMMENT ON COLUMN public.profiles.role       IS 'Rôle métier : directeur (1 max par agence) | collaborateur.';
COMMENT ON COLUMN public.profiles.phone      IS 'Téléphone professionnel du membre (format FR).';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.profiles.preferences IS 'Préférences utilisateur (notifications, etc.) au format JSON.';

CREATE INDEX IF NOT EXISTS idx_profiles_agency_id ON public.profiles (agency_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role      ON public.profiles (role);

-- Unicité : un seul directeur par agence (index partiel).
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_one_director_per_agency
  ON public.profiles (agency_id)
  WHERE role = 'directeur';

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------
-- 4. Table `invitations`
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitations (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  token        text          NOT NULL UNIQUE,
  email        text          NOT NULL,
  role         text          NOT NULL,
  agency_id    uuid          REFERENCES public.agencies(id) ON DELETE CASCADE,
  agency_name  text,
  created_by   uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at   timestamptz   NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT invitations_role_check
    CHECK (role IN ('directeur', 'collaborateur')),
  -- Un directeur n'est rattaché à aucune agence existante (elle sera créée
  -- à l'acceptation) ; un collaborateur DOIT être rattaché à une agence.
  CONSTRAINT invitations_agency_consistency
    CHECK (
      (role = 'directeur'     AND agency_id IS NULL) OR
      (role = 'collaborateur' AND agency_id IS NOT NULL)
    )
);

COMMENT ON TABLE  public.invitations             IS 'Tokens d''invitation pour onboarding (directeurs et collaborateurs).';
COMMENT ON COLUMN public.invitations.token       IS 'Token aléatoire opaque servant d''URL d''invitation (cryptographiquement aléatoire, généré côté serveur).';
COMMENT ON COLUMN public.invitations.agency_id   IS 'NULL pour directeur (agence créée à l''acceptation) ; rempli pour collaborateur.';
COMMENT ON COLUMN public.invitations.agency_name IS 'Nom d''agence pré-rempli (invitation directeur) — optionnel.';
COMMENT ON COLUMN public.invitations.created_by  IS 'NULL si créé par un admin (Simon, via service_role) ; user_id du directeur pour une invitation collaborateur.';
COMMENT ON COLUMN public.invitations.expires_at  IS 'Date d''expiration du token (typiquement created_at + 7 jours).';
COMMENT ON COLUMN public.invitations.used_at     IS 'Tampon d''acceptation ; NULL tant que l''invitation est ouverte.';

CREATE INDEX IF NOT EXISTS idx_invitations_email   ON public.invitations (email);
CREATE INDEX IF NOT EXISTS idx_invitations_used_at ON public.invitations (used_at);


-- ---------------------------------------------------------------------
-- 5. Helpers SECURITY DEFINER
-- ---------------------------------------------------------------------
-- Évitent la récursion infinie des policies sur `profiles` qui doivent
-- interroger `profiles` pour connaître l'agence / le rôle courant.
-- `SECURITY DEFINER` ⇒ exécutées avec les droits du propriétaire (postgres),
-- donc en bypass de RLS. `STABLE` permet à Postgres de les cacher dans une
-- même requête.

CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Restreindre l'EXECUTE : authenticated only (anon n'a aucune raison d'appeler).
REVOKE ALL ON FUNCTION public.current_user_agency_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role()      FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role()      TO authenticated;


-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------
ALTER TABLE public.agencies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Important : `service_role` (clé serveur Supabase) bypasse TOUJOURS RLS.
-- Toutes les opérations privilégiées (création d'agence, acceptation
-- d'invitation, marquage `used_at`) doivent se faire depuis le backend
-- avec cette clé.


-- =====================================================================
-- 6.A — Policies `agencies`
-- =====================================================================

-- SELECT : un utilisateur voit uniquement son agence.
DROP POLICY IF EXISTS agencies_select_own ON public.agencies;
CREATE POLICY agencies_select_own
  ON public.agencies
  FOR SELECT
  TO authenticated
  USING (id = public.current_user_agency_id());

-- UPDATE : seul un directeur peut modifier son agence.
DROP POLICY IF EXISTS agencies_update_director ON public.agencies;
CREATE POLICY agencies_update_director
  ON public.agencies
  FOR UPDATE
  TO authenticated
  USING (
    id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  )
  WITH CHECK (
    id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  );

-- INSERT : aucune policy → bloqué par défaut pour authenticated/anon.
-- Création faite uniquement via service_role (flux d'invitation).

-- DELETE : aucune policy → interdit. Soft-delete possible plus tard.


-- =====================================================================
-- 6.B — Policies `profiles`
-- =====================================================================

-- SELECT : son propre profil + ceux des autres membres de son agence.
DROP POLICY IF EXISTS profiles_select_self_or_agency ON public.profiles;
CREATE POLICY profiles_select_self_or_agency
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR agency_id = public.current_user_agency_id()
  );

-- UPDATE : son propre profil OU un directeur sur ses collaborateurs.
DROP POLICY IF EXISTS profiles_update_self_or_director ON public.profiles;
CREATE POLICY profiles_update_self_or_director
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR (
      public.current_user_role() = 'directeur'
      AND agency_id = public.current_user_agency_id()
      AND role = 'collaborateur'
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR (
      public.current_user_role() = 'directeur'
      AND agency_id = public.current_user_agency_id()
      AND role = 'collaborateur'
    )
  );

-- DELETE : un directeur peut retirer un collaborateur de son agence.
DROP POLICY IF EXISTS profiles_delete_director ON public.profiles;
CREATE POLICY profiles_delete_director
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'directeur'
    AND agency_id = public.current_user_agency_id()
    AND role = 'collaborateur'
  );

-- INSERT : aucune policy → bloqué. Création via service_role (acceptation
-- d'invitation, qui crée auth.user + profile dans la même transaction).


-- =====================================================================
-- 6.C — Policies `invitations`
-- =====================================================================

-- SELECT : un utilisateur voit les invitations qu'il a créées (directeur
-- qui suit les invitations envoyées à ses collaborateurs).
DROP POLICY IF EXISTS invitations_select_creator ON public.invitations;
CREATE POLICY invitations_select_creator
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- INSERT : un directeur peut créer une invitation pour un collaborateur
-- de SA propre agence. Les invitations "directeur" (agency_id NULL) sont
-- réservées aux admins via service_role.
DROP POLICY IF EXISTS invitations_insert_director ON public.invitations;
CREATE POLICY invitations_insert_director
  ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'directeur'
    AND created_by = auth.uid()
    AND role = 'collaborateur'
    AND agency_id = public.current_user_agency_id()
  );

-- UPDATE : aucune policy → bloqué pour les clients. Le marquage `used_at`
-- lors de l'acceptation se fait côté serveur via service_role (sécurité :
-- garantit qu'on valide token, expiration et atomicité).

-- DELETE : aucune policy → interdit. On conserve l'historique des
-- invitations (auditabilité).


-- =====================================================================
-- 6.D — Policies `leads` (prospects scorés par agence)
-- =====================================================================
-- À exécuter si la table `public.leads` existe déjà en base.
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_select_agency ON public.leads;
CREATE POLICY leads_select_agency
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS leads_update_agency ON public.leads;
CREATE POLICY leads_update_agency
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS leads_delete_agency ON public.leads;
CREATE POLICY leads_delete_agency
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (agency_id = public.current_user_agency_id());

-- INSERT : réservé au service_role / pipeline de scoring (pas depuis le client).


-- =====================================================================
-- 7. Hardening — refus explicite des opérations directes par anon
-- =====================================================================
-- Par défaut Supabase laisse anon/authenticated en SELECT sur public.*
-- via les rôles ; RLS filtre déjà. On retire les droits inutiles à anon
-- pour éviter toute fuite future si une policy était relâchée par erreur.
REVOKE ALL ON public.agencies    FROM anon;
REVOKE ALL ON public.profiles    FROM anon;
REVOKE ALL ON public.invitations FROM anon;
REVOKE ALL ON public.leads         FROM anon;
