-- Jeu de données de démo réversible (agence test uniquement).
-- Toute ligne insérée par scripts/seed-demo-agency.ts porte is_demo = true.

-- ---------------------------------------------------------------------------
-- 1) Colonne is_demo
-- ---------------------------------------------------------------------------
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.biens
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.visites
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.offres
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.promesses
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.rendez_vous
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.contact_interactions
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.note_liens
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.agency_alerts
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contacts.is_demo IS 'Donnée fictive de démo — supprimable via purge-demo-agency.';

CREATE INDEX IF NOT EXISTS contacts_demo_idx ON public.contacts (agency_id) WHERE is_demo;
CREATE INDEX IF NOT EXISTS biens_demo_idx ON public.biens (agency_id) WHERE is_demo;
CREATE INDEX IF NOT EXISTS voice_notes_demo_idx ON public.voice_notes (agency_id) WHERE is_demo;
CREATE INDEX IF NOT EXISTS profiles_demo_idx ON public.profiles (id) WHERE is_demo;

-- ---------------------------------------------------------------------------
-- 2) Snapshots pour restaurer les leads réels touchés par le seed
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demo_lead_snapshots (
  lead_id uuid PRIMARY KEY REFERENCES public.leads (id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.demo_lead_snapshots IS
  'Sauvegarde des champs leads modifiés par le seed démo (réversible sans is_demo sur leads).';

ALTER TABLE public.demo_lead_snapshots ENABLE ROW LEVEL SECURITY;
-- Pas de policy authenticated : service_role uniquement.
