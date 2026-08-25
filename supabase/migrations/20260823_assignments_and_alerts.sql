-- Assignation entre collègues + alertes urgentes pour le directeur.
-- Isolation inchangée : agency_id = current_user_agency_id() partout.
-- assigned_to pointe vers un profil ; l'appartenance à l'agence est
-- vérifiée côté application (liste des membres), pas par un nom libre.

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

COMMENT ON COLUMN public.contacts.assigned_to IS 'Membre de l''agence responsable de la fiche. Jamais un nom saisi à la main.';
COMMENT ON COLUMN public.contacts.assigned_by IS 'Qui a transmis la fiche. NULL si créée pour soi-même.';

UPDATE public.contacts
SET assigned_to = created_by
WHERE assigned_to IS NULL AND created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_assigned_to_idx ON public.contacts (agency_id, assigned_to);

-- ---------------------------------------------------------------------------
-- leads (assigned_to existe déjà)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

COMMENT ON COLUMN public.leads.assigned_by IS 'Qui a transmis le lead. Sert à la carte « Transmis par » d''Aujourd''hui.';

CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON public.leads (agency_id, assigned_to);

-- ---------------------------------------------------------------------------
-- voice_notes
-- ---------------------------------------------------------------------------
ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS voice_notes_assigned_to_idx ON public.voice_notes (agency_id, assigned_to);

-- ---------------------------------------------------------------------------
-- contact_interactions (notes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.contact_interactions
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS contact_interactions_assigned_to_idx
  ON public.contact_interactions (agency_id, assigned_to);

-- ---------------------------------------------------------------------------
-- Alertes urgentes destinées au directeur
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('baisse_prix', 'mandat_a_recuperer')),
  contact_id uuid NULL REFERENCES public.contacts (id) ON DELETE CASCADE,
  lead_id uuid NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  body text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_alerts_target CHECK (contact_id IS NOT NULL OR lead_id IS NOT NULL)
);

COMMENT ON TABLE public.agency_alerts IS 'Signalements urgents (baisse de prix, mandat à récupérer) destinés au directeur de l''agence active.';

CREATE INDEX IF NOT EXISTS agency_alerts_agency_idx
  ON public.agency_alerts (agency_id, created_at DESC);

ALTER TABLE public.agency_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_alerts_select_agency ON public.agency_alerts;
CREATE POLICY agency_alerts_select_agency ON public.agency_alerts
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS agency_alerts_insert_agency ON public.agency_alerts;
CREATE POLICY agency_alerts_insert_agency ON public.agency_alerts
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS agency_alerts_delete_director ON public.agency_alerts;
CREATE POLICY agency_alerts_delete_director ON public.agency_alerts
  FOR DELETE TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND (
      created_by = auth.uid()
      OR public.current_user_role() = 'directeur'
    )
  );
