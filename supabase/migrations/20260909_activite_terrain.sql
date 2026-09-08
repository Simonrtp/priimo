-- Activité terrain : six compteurs, objectifs, ratios.
--
-- Aucune table d'activités n'est créée, et c'est délibéré. Cinq des six
-- compteurs sont DÉRIVÉS de journaux qui existent déjà (lead_stage_events,
-- voice_notes, note_liens, leads.ban_id). Les matérialiser en lignes ferait
-- perdre la rejouabilité : recalculer une semaine passée deviendrait une
-- réconciliation au lieu d'une lecture. Le sixième, le contact physique, est
-- DÉCLARÉ, et il s'écrit déjà : sortie_events avec kind = 'rencontre'.
--
-- Ce que cette migration ajoute réellement :
--   1. l'étape « estimation » du pipeline, qui manquait ;
--   2. sortie_events.ban_id, pour qu'un contact physique compte comme immeuble
--      touché sans dépendre d'un lead ;
--   3. les objectifs hebdomadaires et mensuels par collaborateur ;
--   4. les ratios de référence métier, paramétrables par agence.

-- ---------------------------------------------------------------------------
-- 1) Étape « estimation », entre rendez_vous et mandat
-- ---------------------------------------------------------------------------

-- leads.status reste dérivé de stage_id. Sans cette branche, une estimation
-- retomberait sur 'nouveau' par le ELSE et l'étape serait invisible partout où
-- le code lit encore status.
CREATE OR REPLACE FUNCTION public.lead_status_for_stage(
  p_stage_id uuid,
  p_lost_reason text
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN p_stage_id IS NULL THEN 'nouveau'
    ELSE (
      SELECT CASE ls.cle
        WHEN 'pris' THEN 'contacte'
        WHEN 'contacte' THEN 'contacte'
        WHEN 'rendez_vous' THEN 'interesse'
        WHEN 'estimation' THEN 'interesse'
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
$fn$;

-- Nouvelles agences : six étapes au lieu de cinq.
CREATE OR REPLACE FUNCTION public.seed_lead_stages_for_agency(p_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.lead_stages (agency_id, cle, libelle, ordre, type)
  VALUES
    (p_agency_id, 'pris', 'Pris', 1, 'entree'),
    (p_agency_id, 'contacte', 'Contacté', 2, 'intermediaire'),
    (p_agency_id, 'rendez_vous', 'Rendez-vous', 3, 'intermediaire'),
    (p_agency_id, 'estimation', 'Estimation', 4, 'intermediaire'),
    (p_agency_id, 'mandat', 'Mandat signé', 5, 'gagne'),
    (p_agency_id, 'perdu', 'Perdu', 6, 'perdu')
  ON CONFLICT (agency_id, cle) DO NOTHING;
END;
$fn$;

-- Agences existantes : insertion juste avant « mandat ».
-- lead_stages_agency_ordre_unique n'est pas différable : un simple ordre + 1
-- échouerait en cours de balayage. On décale donc hors de portée, on insère,
-- puis on redescend.
DO $mig$
DECLARE
  v_agency uuid;
  v_pivot integer;
BEGIN
  FOR v_agency IN SELECT id FROM public.agencies LOOP
    IF EXISTS (
      SELECT 1 FROM public.lead_stages
      WHERE agency_id = v_agency AND cle = 'estimation'
    ) THEN
      CONTINUE;
    END IF;

    SELECT ordre INTO v_pivot
    FROM public.lead_stages
    WHERE agency_id = v_agency AND cle = 'mandat';

    IF v_pivot IS NULL THEN
      SELECT COALESCE(MAX(ordre), 0) + 1 INTO v_pivot
      FROM public.lead_stages
      WHERE agency_id = v_agency;
    END IF;

    UPDATE public.lead_stages
    SET ordre = ordre + 1000
    WHERE agency_id = v_agency AND ordre >= v_pivot;

    INSERT INTO public.lead_stages (agency_id, cle, libelle, ordre, type)
    VALUES (v_agency, 'estimation', 'Estimation', v_pivot, 'intermediaire');

    UPDATE public.lead_stages
    SET ordre = ordre - 999
    WHERE agency_id = v_agency AND ordre >= 1000;
  END LOOP;
END;
$mig$;

-- ---------------------------------------------------------------------------
-- 2) sortie_events — table (si 20260841 n'a pas tourné) + ban_id
-- ---------------------------------------------------------------------------
-- ALTER seul casse si le fichier est collé dans l'éditeur SQL, ou si la
-- migration 20260841_sortie_events n'a jamais été appliquée.
CREATE TABLE IF NOT EXISTS public.sortie_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  day date NOT NULL,
  kind text NOT NULL,
  lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  stop_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sortie_events_kind_check CHECK (
    kind IN (
      'start',
      'pause',
      'resume',
      'finish',
      'rencontre',
      'absent',
      'passer',
      'remove_stop',
      'recalc_origin',
      'dictee'
    )
  )
);

COMMENT ON TABLE public.sortie_events IS
  'Journal de tournée terrain — télémétrie Priimo / directeur, pas un journal agent.';

CREATE UNIQUE INDEX IF NOT EXISTS sortie_events_client_id_uidx
  ON public.sortie_events (agency_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sortie_events_agency_day_idx
  ON public.sortie_events (agency_id, day DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS sortie_events_profile_day_idx
  ON public.sortie_events (profile_id, day DESC, created_at DESC);

ALTER TABLE public.sortie_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sortie_events_select ON public.sortie_events;
CREATE POLICY sortie_events_select
  ON public.sortie_events
  FOR SELECT
  TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS sortie_events_insert ON public.sortie_events;
CREATE POLICY sortie_events_insert
  ON public.sortie_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND profile_id = auth.uid()
  );

GRANT SELECT, INSERT ON public.sortie_events TO authenticated;

ALTER TABLE public.sortie_events
  ADD COLUMN IF NOT EXISTS ban_id text;

COMMENT ON COLUMN public.sortie_events.ban_id IS
  'Immeuble touché (identifiant BAN). Renseigné pour kind = rencontre afin que le contact physique déclaré compte sans dépendre d''un lead_id.';

CREATE INDEX IF NOT EXISTS sortie_events_rencontre_semaine_idx
  ON public.sortie_events (agency_id, profile_id, day)
  WHERE kind = 'rencontre';

-- ---------------------------------------------------------------------------
-- 3) Objectifs par collaborateur
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  activite text NOT NULL,
  periode text NOT NULL,
  cible integer NOT NULL,
  updated_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_goals_activite_check CHECK (activite IN (
    'contacts_physiques',
    'immeubles_prospectes',
    'contacts_qualifies',
    'estimations',
    'informations_terrain',
    'mandats'
  )),
  CONSTRAINT activity_goals_periode_check CHECK (periode IN ('hebdo', 'mensuel')),
  CONSTRAINT activity_goals_cible_check CHECK (cible >= 0 AND cible <= 10000),
  CONSTRAINT activity_goals_unique UNIQUE (agency_id, profile_id, activite, periode)
);

COMMENT ON TABLE public.activity_goals IS
  'Objectifs d''activité par collaborateur. Une ligne absente n''est pas une erreur : le défaut vit dans lib/activite/objectifs.ts, ce qui évite de semer six lignes à chaque création de compte.';

CREATE INDEX IF NOT EXISTS activity_goals_agency_profile_idx
  ON public.activity_goals (agency_id, profile_id);

DROP TRIGGER IF EXISTS trg_activity_goals_set_updated_at ON public.activity_goals;
CREATE TRIGGER trg_activity_goals_set_updated_at
  BEFORE UPDATE ON public.activity_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) Ratios de référence métier, par agence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_activity_settings (
  agency_id uuid PRIMARY KEY REFERENCES public.agencies (id) ON DELETE CASCADE,
  physiques_par_qualifie numeric(6, 2) NULL,
  qualifies_par_estimation numeric(6, 2) NULL,
  estimations_par_mandat numeric(6, 2) NULL,
  updated_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_activity_settings_positifs CHECK (
    COALESCE(physiques_par_qualifie, 1) > 0
    AND COALESCE(qualifies_par_estimation, 1) > 0
    AND COALESCE(estimations_par_mandat, 1) > 0
  )
);

COMMENT ON TABLE public.agency_activity_settings IS
  'Référence métier de dernier recours pour la cascade de ratios. NULL = chiffre pas encore fourni par le réseau : l''interface affiche une valeur provisoire ET le dit.';

DROP TRIGGER IF EXISTS trg_agency_activity_settings_set_updated_at
  ON public.agency_activity_settings;
CREATE TRIGGER trg_agency_activity_settings_set_updated_at
  BEFORE UPDATE ON public.agency_activity_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5) RLS — lecture agence, écriture directeur
-- ---------------------------------------------------------------------------
ALTER TABLE public.activity_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_activity_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_goals_select_agency ON public.activity_goals;
CREATE POLICY activity_goals_select_agency
  ON public.activity_goals
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS activity_goals_insert_directeur ON public.activity_goals;
CREATE POLICY activity_goals_insert_directeur
  ON public.activity_goals
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  );

DROP POLICY IF EXISTS activity_goals_update_directeur ON public.activity_goals;
CREATE POLICY activity_goals_update_directeur
  ON public.activity_goals
  FOR UPDATE TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  )
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  );

DROP POLICY IF EXISTS activity_goals_delete_directeur ON public.activity_goals;
CREATE POLICY activity_goals_delete_directeur
  ON public.activity_goals
  FOR DELETE TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  );

DROP POLICY IF EXISTS agency_activity_settings_select_agency
  ON public.agency_activity_settings;
CREATE POLICY agency_activity_settings_select_agency
  ON public.agency_activity_settings
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS agency_activity_settings_insert_directeur
  ON public.agency_activity_settings;
CREATE POLICY agency_activity_settings_insert_directeur
  ON public.agency_activity_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  );

DROP POLICY IF EXISTS agency_activity_settings_update_directeur
  ON public.agency_activity_settings;
CREATE POLICY agency_activity_settings_update_directeur
  ON public.agency_activity_settings
  FOR UPDATE TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  )
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND public.current_user_role() = 'directeur'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agency_activity_settings TO authenticated;
