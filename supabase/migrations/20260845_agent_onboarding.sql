-- Prise en main du négociateur.
--
-- Distincte de l'onboarding directeur (profiles.onboarding_completed_at, qui
-- suit la visite guidée des prospects) : ici on suit un agent qui découvre
-- Priimo seul, et on veut savoir à quelle étape il décroche. Sans cette
-- mesure, on ne saurait jamais où le parcours perd les gens.
--
-- L'état vit en base et non dans le navigateur : un agent qui ferme son
-- portable doit reprendre où il en était depuis son téléphone.

CREATE TABLE IF NOT EXISTS public.agent_onboarding (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,

  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),

  -- Étape affichée au moment de la reprise.
  current_step text,
  -- Étapes réellement atteintes, et celles que l'agent a passées.
  steps_reached text[] NOT NULL DEFAULT '{}',
  steps_skipped text[] NOT NULL DEFAULT '{}',
  -- Temps cumulé passé dans le parcours, en secondes.
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),

  -- Terminé par le bouton final, ou abandonné par « Passer ».
  completed_at timestamptz,
  skipped_at timestamptz,
  -- La relance ne s'affiche qu'une fois : après, plus rien.
  relance_dismissed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_onboarding IS
  'Prise en main du négociateur : progression, étapes passées, durée, abandon.';
COMMENT ON COLUMN public.agent_onboarding.steps_reached IS
  'Étapes atteintes, dans l''ordre d''arrivée. Sert à voir où les agents décrochent.';
COMMENT ON COLUMN public.agent_onboarding.skipped_at IS
  'Renseigné quand l''agent a cliqué « Passer ». Distinct d''un abandon silencieux.';
COMMENT ON COLUMN public.agent_onboarding.relance_dismissed_at IS
  'La bande de reprise a été refermée : on ne relance plus jamais.';

CREATE INDEX IF NOT EXISTS agent_onboarding_agency_idx
  ON public.agent_onboarding (agency_id);

DROP TRIGGER IF EXISTS trg_agent_onboarding_updated ON public.agent_onboarding;
CREATE TRIGGER trg_agent_onboarding_updated
  BEFORE UPDATE ON public.agent_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agent_onboarding ENABLE ROW LEVEL SECURITY;

-- L'agent écrit sa propre progression, et rien d'autre.
DROP POLICY IF EXISTS agent_onboarding_insert_self ON public.agent_onboarding;
CREATE POLICY agent_onboarding_insert_self ON public.agent_onboarding
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND agency_id = (SELECT public.current_user_agency_id())
  );

DROP POLICY IF EXISTS agent_onboarding_update_self ON public.agent_onboarding;
CREATE POLICY agent_onboarding_update_self ON public.agent_onboarding
  FOR UPDATE TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));

-- L'agent lit la sienne ; le directeur lit celles de son agence — l'adoption
-- est le premier signal qu'il obtient, bien avant les chiffres de production.
DROP POLICY IF EXISTS agent_onboarding_select ON public.agent_onboarding;
CREATE POLICY agent_onboarding_select ON public.agent_onboarding
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR (
      agency_id = (SELECT public.current_user_agency_id())
      AND (SELECT public.current_user_role()) = 'directeur'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.agent_onboarding TO authenticated;
