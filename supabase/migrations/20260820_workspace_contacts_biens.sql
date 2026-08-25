-- Espace de travail agent : contacts rencontrés sur le terrain, mandats (biens),
-- historique des échanges et notes vocales.
--
-- Rien de ce qui existe n'est modifié : la table `leads` (moteur de prospection)
-- reste la source unique des adresses détectées. Les contacts sont des personnes,
-- saisies par l'agent (vocal ou manuel), pas des lignes de pipeline.
--
-- Isolation : même modèle que `leads` — agency_id + current_user_agency_id().
-- Différence : les agents CRÉENT ces lignes, donc des policies INSERT/UPDATE
-- existent ici, contrairement à `leads` (réservée au pipeline / service_role).

-- ---------------------------------------------------------------------------
-- 0) Utilitaire updated_at (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) contacts — les personnes rencontrées
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  created_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,

  first_name text NULL,
  last_name text NULL,
  contact_type text NOT NULL DEFAULT 'autre'
    CHECK (contact_type IN ('vendeur', 'acquereur', 'locataire', 'autre')),

  phone text NULL,
  email text NULL,

  -- Secteur en clair (ce que dit l'agent) + codes postaux normalisés (rapprochement).
  secteur text NULL,
  postal_codes text[] NOT NULL DEFAULT '{}',

  -- Critères de recherche (acquéreur / locataire). NULL = non renseigné.
  budget_min integer NULL,
  budget_max integer NULL,
  surface_min integer NULL,
  surface_max integer NULL,
  rooms_min integer NULL,

  -- Résumé libre issu de la dictée ou saisi à la main.
  summary text NULL,

  -- Dernier échange connu : sert au calcul des relances.
  last_interaction_at timestamptz NULL,

  source text NOT NULL DEFAULT 'manuel'
    CHECK (source IN ('manuel', 'vocal', 'prospection')),

  -- Rattachement optionnel à une adresse détectée par le moteur.
  lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contacts_identity_not_empty
    CHECK (COALESCE(first_name, '') <> '' OR COALESCE(last_name, '') <> ''),
  CONSTRAINT contacts_budget_coherent
    CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max),
  CONSTRAINT contacts_surface_coherent
    CHECK (surface_min IS NULL OR surface_max IS NULL OR surface_min <= surface_max)
);

COMMENT ON TABLE public.contacts IS 'Personnes rencontrées par l''agent (vendeur / acquéreur / locataire). Distinct de leads (adresses détectées par le moteur).';
COMMENT ON COLUMN public.contacts.postal_codes IS 'Codes postaux normalisés du secteur recherché — utilisés par le rapprochement acquéreur/bien.';
COMMENT ON COLUMN public.contacts.last_interaction_at IS 'Dernier échange enregistré. Alimente les cartes de relance de l''écran Aujourd''hui.';

CREATE INDEX IF NOT EXISTS contacts_agency_idx ON public.contacts (agency_id);
CREATE INDEX IF NOT EXISTS contacts_agency_type_idx ON public.contacts (agency_id, contact_type);
CREATE INDEX IF NOT EXISTS contacts_agency_last_interaction_idx
  ON public.contacts (agency_id, last_interaction_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS contacts_postal_codes_gin ON public.contacts USING gin (postal_codes);

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) biens — les mandats de l'agence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.biens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  created_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,

  address text NOT NULL,
  city text NULL,
  postal_code text NULL,

  property_type text NULL,
  surface_m2 integer NULL,
  rooms integer NULL,
  price integer NULL,

  mandat_statut text NOT NULL DEFAULT 'estimation'
    CHECK (mandat_statut IN (
      'estimation',
      'mandat_simple',
      'mandat_exclusif',
      'compromis',
      'vendu',
      'archive'
    )),

  -- Propriétaire : un contact de type vendeur.
  proprietaire_contact_id uuid NULL REFERENCES public.contacts (id) ON DELETE SET NULL,
  -- Origine éventuelle : une adresse détectée par le moteur puis travaillée.
  lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL,

  notes text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT biens_surface_positive CHECK (surface_m2 IS NULL OR surface_m2 > 0),
  CONSTRAINT biens_price_positive CHECK (price IS NULL OR price >= 0)
);

COMMENT ON TABLE public.biens IS 'Mandats de l''agence. Diffusion portails et registre des mandats (loi Hoguet) hors périmètre à ce stade.';

CREATE INDEX IF NOT EXISTS biens_agency_idx ON public.biens (agency_id);
CREATE INDEX IF NOT EXISTS biens_agency_statut_idx ON public.biens (agency_id, mandat_statut);
CREATE INDEX IF NOT EXISTS biens_proprietaire_idx ON public.biens (proprietaire_contact_id);

DROP TRIGGER IF EXISTS trg_biens_updated_at ON public.biens;
CREATE TRIGGER trg_biens_updated_at
  BEFORE UPDATE ON public.biens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) voice_notes — dictées terrain
-- ---------------------------------------------------------------------------
-- Le fichier audio n'est JAMAIS stocké ici : seul son chemin dans le bucket
-- privé `voice-notes` l'est. Voir 20260820_voice_notes_storage.sql.
CREATE TABLE IF NOT EXISTS public.voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  created_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,

  -- Chemin relatif dans le bucket privé : '{agency_id}/{uuid}.webm'.
  storage_path text NOT NULL,
  duration_seconds integer NULL,
  mime_type text NULL,

  transcript text NULL,
  -- Extraction brute renvoyée par le modèle, conservée pour audit.
  structured jsonb NULL,

  status text NOT NULL DEFAULT 'transcrit'
    CHECK (status IN ('transcrit', 'valide', 'erreur')),

  contact_id uuid NULL REFERENCES public.contacts (id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.voice_notes IS 'Dictées terrain. Contiennent des données personnelles : le fichier audio vit dans un bucket PRIVÉ, accessible uniquement par URL signée à durée limitée.';
COMMENT ON COLUMN public.voice_notes.storage_path IS 'Chemin dans le bucket privé voice-notes. Premier segment = agency_id (contrôle d''accès).';
COMMENT ON COLUMN public.voice_notes.structured IS 'Sortie brute du modèle avant validation par l''agent. Ne sert jamais de source directe : l''agent valide d''abord.';

CREATE INDEX IF NOT EXISTS voice_notes_agency_idx ON public.voice_notes (agency_id);
CREATE INDEX IF NOT EXISTS voice_notes_contact_idx ON public.voice_notes (contact_id);

DROP TRIGGER IF EXISTS trg_voice_notes_updated_at ON public.voice_notes;
CREATE TRIGGER trg_voice_notes_updated_at
  BEFORE UPDATE ON public.voice_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) contact_interactions — historique des échanges
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts (id) ON DELETE CASCADE,
  author_id uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,

  kind text NOT NULL DEFAULT 'note'
    CHECK (kind IN ('note', 'appel', 'visite', 'vocal', 'email')),
  body text NOT NULL,

  voice_note_id uuid NULL REFERENCES public.voice_notes (id) ON DELETE SET NULL,

  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contact_interactions IS 'Fil chronologique des échanges avec un contact. Les dictées s''y rattachent via voice_note_id.';

CREATE INDEX IF NOT EXISTS contact_interactions_contact_idx
  ON public.contact_interactions (contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS contact_interactions_agency_idx
  ON public.contact_interactions (agency_id);

-- Maintient contacts.last_interaction_at sans aller-retour applicatif.
CREATE OR REPLACE FUNCTION public.touch_contact_last_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contacts
  SET last_interaction_at = GREATEST(COALESCE(last_interaction_at, NEW.occurred_at), NEW.occurred_at)
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_interactions_touch ON public.contact_interactions;
CREATE TRIGGER trg_contact_interactions_touch
  AFTER INSERT ON public.contact_interactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_contact_last_interaction();

-- ---------------------------------------------------------------------------
-- 5) today_dismissals — cartes reportées ou ignorées
-- ---------------------------------------------------------------------------
-- L'écran Aujourd'hui est recalculé à chaque chargement à partir des données
-- vivantes (leads, contacts, biens). Cette table ne stocke donc pas les cartes,
-- seulement les décisions de l'agent : « pas maintenant » ou « plus jamais ».
-- La clé est stable et reconstruite par le moteur de cartes (ex : 'relance:<uuid>').
CREATE TABLE IF NOT EXISTS public.today_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  card_key text NOT NULL,
  /** NULL = ignorée définitivement ; sinon la carte réapparaît après cette date. */
  snoozed_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, card_key)
);

COMMENT ON TABLE public.today_dismissals IS 'Décisions « reporter » / « ignorer » sur les cartes de l''écran Aujourd''hui. Propres à chaque agent.';

CREATE INDEX IF NOT EXISTS today_dismissals_profile_idx
  ON public.today_dismissals (profile_id);

-- ---------------------------------------------------------------------------
-- 6) RLS — isolation stricte par agence active
-- ---------------------------------------------------------------------------
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.today_dismissals ENABLE ROW LEVEL SECURITY;

-- contacts
DROP POLICY IF EXISTS contacts_select_agency ON public.contacts;
CREATE POLICY contacts_select_agency ON public.contacts
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS contacts_insert_agency ON public.contacts;
CREATE POLICY contacts_insert_agency ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS contacts_update_agency ON public.contacts;
CREATE POLICY contacts_update_agency ON public.contacts
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS contacts_delete_agency ON public.contacts;
CREATE POLICY contacts_delete_agency ON public.contacts
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id());

-- biens
DROP POLICY IF EXISTS biens_select_agency ON public.biens;
CREATE POLICY biens_select_agency ON public.biens
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS biens_insert_agency ON public.biens;
CREATE POLICY biens_insert_agency ON public.biens
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS biens_update_agency ON public.biens;
CREATE POLICY biens_update_agency ON public.biens
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS biens_delete_agency ON public.biens;
CREATE POLICY biens_delete_agency ON public.biens
  FOR DELETE TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  );

-- voice_notes : lecture agence, écriture serveur (service_role) uniquement.
-- L'upload et la transcription passent par une route API qui contrôle l'agence.
DROP POLICY IF EXISTS voice_notes_select_agency ON public.voice_notes;
CREATE POLICY voice_notes_select_agency ON public.voice_notes
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS voice_notes_delete_agency ON public.voice_notes;
CREATE POLICY voice_notes_delete_agency ON public.voice_notes
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id());

-- contact_interactions
DROP POLICY IF EXISTS contact_interactions_select_agency ON public.contact_interactions;
CREATE POLICY contact_interactions_select_agency ON public.contact_interactions
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS contact_interactions_insert_agency ON public.contact_interactions;
CREATE POLICY contact_interactions_insert_agency ON public.contact_interactions
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS contact_interactions_delete_agency ON public.contact_interactions;
CREATE POLICY contact_interactions_delete_agency ON public.contact_interactions
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id());

-- today_dismissals : chaque agent ne voit et ne gère que ses propres décisions.
DROP POLICY IF EXISTS today_dismissals_select_own ON public.today_dismissals;
CREATE POLICY today_dismissals_select_own ON public.today_dismissals
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() AND agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS today_dismissals_insert_own ON public.today_dismissals;
CREATE POLICY today_dismissals_insert_own ON public.today_dismissals
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS today_dismissals_update_own ON public.today_dismissals;
CREATE POLICY today_dismissals_update_own ON public.today_dismissals
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid() AND agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS today_dismissals_delete_own ON public.today_dismissals;
CREATE POLICY today_dismissals_delete_own ON public.today_dismissals
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());
