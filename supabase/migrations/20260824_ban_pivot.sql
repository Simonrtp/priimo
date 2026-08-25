-- ban_id : identifiant BAN (api-adresse.data.gouv.fr) comme clé pivot
-- des entités géolocalisables. Les rattachements lead_id restent.
-- Isolation inchangée : agency_id = current_user_agency_id().

-- ---------------------------------------------------------------------------
-- Colonnes partagées
-- ---------------------------------------------------------------------------
-- ban_id              identifiant d'adresse BAN (ex. 59122_xxxx_00012)
-- latitude/longitude  WGS84, recopie du géocodage
-- adresse_normalisee  libellé BAN (pas la saisie brute)
-- geocode_score       confiance BAN 0-1
-- geocode_le          instant du dernier géocodage

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
-- Adresse brute saisie par l'agent : source du géocodage. Distincte du secteur.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS ban_id text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS adresse_normalisee text,
  ADD COLUMN IF NOT EXISTS geocode_score real,
  ADD COLUMN IF NOT EXISTS geocode_le timestamptz;

COMMENT ON COLUMN public.contacts.address IS 'Adresse brute saisie. Le géocodage BAN produit ban_id / lat / lng.';
COMMENT ON COLUMN public.contacts.ban_id IS 'Identifiant BAN. Pivot de géolocalisation, en plus de lead_id.';

CREATE INDEX IF NOT EXISTS contacts_ban_id_idx ON public.contacts (agency_id, ban_id)
  WHERE ban_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- biens
-- ---------------------------------------------------------------------------
ALTER TABLE public.biens
  ADD COLUMN IF NOT EXISTS ban_id text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS adresse_normalisee text,
  ADD COLUMN IF NOT EXISTS geocode_score real,
  ADD COLUMN IF NOT EXISTS geocode_le timestamptz;

COMMENT ON COLUMN public.biens.ban_id IS 'Identifiant BAN. Pivot de géolocalisation, en plus de lead_id.';

CREATE INDEX IF NOT EXISTS biens_ban_id_idx ON public.biens (agency_id, ban_id)
  WHERE ban_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- voice_notes
-- ---------------------------------------------------------------------------
ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS ban_id text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS adresse_normalisee text,
  ADD COLUMN IF NOT EXISTS geocode_score real,
  ADD COLUMN IF NOT EXISTS geocode_le timestamptz;

COMMENT ON COLUMN public.voice_notes.ban_id IS 'Identifiant BAN si une adresse a été extraite de la dictée.';

CREATE INDEX IF NOT EXISTS voice_notes_ban_id_idx ON public.voice_notes (agency_id, ban_id)
  WHERE ban_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- leads : lat/lng existent déjà. On ajoute ban_id et le reste de la sémantique.
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ban_id text,
  ADD COLUMN IF NOT EXISTS adresse_normalisee text,
  ADD COLUMN IF NOT EXISTS geocode_score real,
  ADD COLUMN IF NOT EXISTS geocode_le timestamptz;

COMMENT ON COLUMN public.leads.ban_id IS 'Identifiant BAN. Pivot partagé avec contacts / biens / notes vocales.';

CREATE INDEX IF NOT EXISTS leads_ban_id_idx ON public.leads (agency_id, ban_id)
  WHERE ban_id IS NOT NULL;
