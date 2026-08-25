-- Pipeline leads : étapes par agence, colonnes kanban, journal des transitions.
-- Reprise depuis leads.status (pastilles Nouveau / Contacté / Intéressé…).
-- leads.status devient dérivé de stage_id (trigger), jamais l'inverse.

-- ---------------------------------------------------------------------------
-- 1) lead_stages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  cle text NOT NULL,
  libelle text NOT NULL,
  ordre integer NOT NULL,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_stages_type_check
    CHECK (type IN ('entree', 'intermediaire', 'gagne', 'perdu')),
  CONSTRAINT lead_stages_agency_cle_unique UNIQUE (agency_id, cle),
  CONSTRAINT lead_stages_agency_ordre_unique UNIQUE (agency_id, ordre),
  CONSTRAINT lead_stages_id_agency_unique UNIQUE (id, agency_id)
);

COMMENT ON TABLE public.lead_stages IS
  'Étapes du pipeline leads par agence (colonnes kanban).';

CREATE INDEX IF NOT EXISTS lead_stages_agency_ordre_idx
  ON public.lead_stages (agency_id, ordre);

-- ---------------------------------------------------------------------------
-- 2) Seed des étapes (existant + nouvelles agences)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_lead_stages_for_agency(p_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lead_stages (agency_id, cle, libelle, ordre, type)
  VALUES
    (p_agency_id, 'pris', 'Pris', 1, 'entree'),
    (p_agency_id, 'contacte', 'Contacté', 2, 'intermediaire'),
    (p_agency_id, 'rendez_vous', 'Rendez-vous', 3, 'intermediaire'),
    (p_agency_id, 'mandat', 'Mandat signé', 4, 'gagne'),
    (p_agency_id, 'perdu', 'Perdu', 5, 'perdu')
  ON CONFLICT (agency_id, cle) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.seed_lead_stages_for_agency(uuid) IS
  'Insère les 5 étapes pipeline par défaut pour une agence.';

SELECT public.seed_lead_stages_for_agency(a.id)
FROM public.agencies a;

CREATE OR REPLACE FUNCTION public.trg_seed_lead_stages_on_agency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_lead_stages_for_agency(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agencies_seed_lead_stages ON public.agencies;
CREATE TRIGGER trg_agencies_seed_lead_stages
  AFTER INSERT ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_lead_stages_on_agency();

-- ---------------------------------------------------------------------------
-- 3) Colonnes pipeline sur leads
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS stage_id uuid NULL,
  ADD COLUMN IF NOT EXISTS stage_position numeric NULL,
  ADD COLUMN IF NOT EXISTS taken_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS lost_reason text NULL;

COMMENT ON COLUMN public.leads.stage_id IS
  'Étape pipeline. NULL = livré, pas encore pris (hors tableau kanban).';
COMMENT ON COLUMN public.leads.stage_position IS
  'Ordre fractionnaire dans la colonne kanban ((prec + suiv) / 2).';
COMMENT ON COLUMN public.leads.assigned_to IS
  'Négociateur qui a pris le lead.';
COMMENT ON COLUMN public.leads.taken_at IS
  'Horodatage de la prise en charge (premier passage stage_id NULL → étape).';
COMMENT ON COLUMN public.leads.stage_changed_at IS
  'Dernière transition de stage_id.';
COMMENT ON COLUMN public.leads.lost_reason IS
  'Motif de perte lorsque stage = perdu (ex. pas_interesse, vendeur_ailleurs).';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_stage_same_agency_fkey;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_stage_same_agency_fkey
  FOREIGN KEY (stage_id, agency_id)
  REFERENCES public.lead_stages (id, agency_id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS leads_pipeline_idx
  ON public.leads (agency_id, stage_id, stage_position);

-- ---------------------------------------------------------------------------
-- 4) lead_stage_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  from_stage_id uuid NULL REFERENCES public.lead_stages (id) ON DELETE SET NULL,
  to_stage_id uuid NULL REFERENCES public.lead_stages (id) ON DELETE SET NULL,
  profile_id uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_stage_events_source_check
    CHECK (source IN ('kanban', 'liste', 'mobile', 'systeme'))
);

COMMENT ON TABLE public.lead_stage_events IS
  'Journal append-only des transitions de stage_id. Écriture trigger-only.';

CREATE INDEX IF NOT EXISTS lead_stage_events_agency_created_idx
  ON public.lead_stage_events (agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lead_stage_events_lead_created_idx
  ON public.lead_stage_events (lead_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5) Triggers leads — status dérivé, prise en charge, journal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lead_status_for_stage(
  p_stage_id uuid,
  p_lost_reason text
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_stage_id IS NULL THEN 'nouveau'
    ELSE (
      SELECT CASE ls.cle
        WHEN 'pris' THEN 'contacte'
        WHEN 'contacte' THEN 'contacte'
        WHEN 'rendez_vous' THEN 'interesse'
        WHEN 'mandat' THEN 'mandat_signe'
        WHEN 'perdu' THEN CASE
          WHEN p_lost_reason = 'vendeur_ailleurs' THEN 'vendeur_ailleurs'
          ELSE 'pas_interesse'
        END
        ELSE 'nouveau'
      END
      FROM public.lead_stages ls
      WHERE ls.id = p_stage_id
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_lead_pipeline_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_backfill boolean := COALESCE(current_setting('app.skip_lead_stage_event', true), '') = 'true';
BEGIN
  NEW.status := public.lead_status_for_stage(NEW.stage_id, NEW.lost_reason);

  IF v_backfill THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
      NEW.stage_changed_at := now();
      IF OLD.stage_id IS NULL AND NEW.stage_id IS NOT NULL AND NEW.taken_at IS NULL THEN
        NEW.taken_at := now();
      END IF;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.stage_id IS NOT NULL THEN
      NEW.stage_changed_at := COALESCE(NEW.stage_changed_at, now());
      NEW.taken_at := COALESCE(NEW.taken_at, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_lead_stage_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source text;
  v_from uuid;
  v_to uuid;
BEGIN
  IF COALESCE(current_setting('app.skip_lead_stage_event', true), '') = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.stage_id IS NULL THEN
      RETURN NEW;
    END IF;
    v_from := NULL;
    v_to := NEW.stage_id;
  ELSE
    IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
      RETURN NEW;
    END IF;
    v_from := OLD.stage_id;
    v_to := NEW.stage_id;
  END IF;

  v_source := COALESCE(NULLIF(current_setting('app.lead_stage_source', true), ''), 'systeme');
  IF v_source NOT IN ('kanban', 'liste', 'mobile', 'systeme') THEN
    v_source := 'systeme';
  END IF;

  INSERT INTO public.lead_stage_events (
    lead_id,
    agency_id,
    from_stage_id,
    to_stage_id,
    profile_id,
    source
  )
  VALUES (
    NEW.id,
    NEW.agency_id,
    v_from,
    v_to,
    auth.uid(),
    v_source
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_sync_pipeline_fields ON public.leads;
CREATE TRIGGER trg_leads_sync_pipeline_fields
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_pipeline_fields();

DROP TRIGGER IF EXISTS trg_leads_record_stage_event ON public.leads;
CREATE TRIGGER trg_leads_record_stage_event
  AFTER INSERT OR UPDATE OF stage_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.record_lead_stage_event();

-- ---------------------------------------------------------------------------
-- 6) Reprise des leads existants (status → stage_id)
-- ---------------------------------------------------------------------------
BEGIN;

SELECT set_config('app.skip_lead_stage_event', 'true', true);

UPDATE public.leads AS l
SET
  stage_id = CASE l.status
    WHEN 'nouveau' THEN NULL
    WHEN 'contacte' THEN (
      SELECT ls.id FROM public.lead_stages AS ls
      WHERE ls.agency_id = l.agency_id AND ls.cle = 'contacte'
    )
    WHEN 'interesse' THEN (
      SELECT ls.id FROM public.lead_stages AS ls
      WHERE ls.agency_id = l.agency_id AND ls.cle = 'rendez_vous'
    )
    WHEN 'mandat_signe' THEN (
      SELECT ls.id FROM public.lead_stages AS ls
      WHERE ls.agency_id = l.agency_id AND ls.cle = 'mandat'
    )
    WHEN 'pas_interesse' THEN (
      SELECT ls.id FROM public.lead_stages AS ls
      WHERE ls.agency_id = l.agency_id AND ls.cle = 'perdu'
    )
    WHEN 'vendeur_ailleurs' THEN (
      SELECT ls.id FROM public.lead_stages AS ls
      WHERE ls.agency_id = l.agency_id AND ls.cle = 'perdu'
    )
    ELSE NULL
  END,
  lost_reason = CASE l.status
    WHEN 'pas_interesse' THEN 'pas_interesse'
    WHEN 'vendeur_ailleurs' THEN 'vendeur_ailleurs'
    ELSE NULL
  END,
  taken_at = CASE
    WHEN l.status = 'nouveau' THEN NULL
    ELSE COALESCE(l.assigned_at, l.updated_at, l.created_at)
  END,
  stage_changed_at = CASE
    WHEN l.status = 'nouveau' THEN NULL
    ELSE COALESCE(l.updated_at, l.created_at)
  END;

WITH ranked AS (
  SELECT
    l.id,
    (ROW_NUMBER() OVER (
      PARTITION BY l.agency_id, l.stage_id
      ORDER BY l.created_at, l.id
    ) * 1000.0) AS pos
  FROM public.leads AS l
  WHERE l.stage_id IS NOT NULL
)
UPDATE public.leads AS l
SET stage_position = r.pos
FROM ranked AS r
WHERE l.id = r.id;

COMMIT;

-- ---------------------------------------------------------------------------
-- 7) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_stage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_stages_select_agency ON public.lead_stages;
CREATE POLICY lead_stages_select_agency
  ON public.lead_stages
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS lead_stages_insert_agency ON public.lead_stages;
CREATE POLICY lead_stages_insert_agency
  ON public.lead_stages
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS lead_stages_update_agency ON public.lead_stages;
CREATE POLICY lead_stages_update_agency
  ON public.lead_stages
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS lead_stages_delete_agency ON public.lead_stages;
CREATE POLICY lead_stages_delete_agency
  ON public.lead_stages
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS lead_stage_events_select_agency ON public.lead_stage_events;
CREATE POLICY lead_stage_events_select_agency
  ON public.lead_stage_events
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

-- Aucune policy INSERT/UPDATE/DELETE : écriture réservée au trigger SECURITY DEFINER.
REVOKE INSERT, UPDATE, DELETE ON public.lead_stage_events FROM authenticated, anon;

GRANT SELECT ON public.lead_stages TO authenticated;
GRANT SELECT ON public.lead_stage_events TO authenticated;
