-- Boîte de réception d'actions : le socle des automatisations.
--
-- Une automatisation ne fait jamais l'action à la place de l'agent : elle
-- dépose une *proposition* que l'agent valide ou ignore en un geste. Rien ne
-- part vers un client sans validation humaine — c'est la règle qui rend
-- l'automatisation acceptable dans une agence.
--
-- La déduplication passe par `dedup_key`, construite par le générateur. Une
-- proposition récurrente (mensuelle par exemple) inclut la période dans sa clé
-- pour pouvoir revenir ; une proposition ponctuelle n'apparaît qu'une fois,
-- même si le cron tourne tous les jours.

CREATE TABLE IF NOT EXISTS public.agency_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  -- NULL = proposition d'agence, visible par tous les membres.
  assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN (
    'rapprochement_inverse',
    'veille_dpe',
    'veille_mutation',
    'compte_rendu_mandat',
    'engagement_note',
    'estimation_dormante'
  )),
  -- Empêche la même proposition de revenir à chaque passage du cron.
  dedup_key text NOT NULL,
  titre text NOT NULL,
  detail text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Tri de la boîte : 0–100, calculé par le générateur.
  score integer NOT NULL DEFAULT 50 CHECK (score BETWEEN 0 AND 100),
  statut text NOT NULL DEFAULT 'proposee'
    CHECK (statut IN ('proposee', 'validee', 'ignoree', 'expiree')),
  -- Au-delà, la proposition n'a plus de sens (le signal est froid).
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT agency_actions_resolved_coherent
    CHECK ((statut = 'proposee') = (resolved_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS agency_actions_dedup_idx
  ON public.agency_actions (agency_id, dedup_key);

-- Index de la boîte : les propositions ouvertes d'une agence, les mieux notées d'abord.
CREATE INDEX IF NOT EXISTS agency_actions_inbox_idx
  ON public.agency_actions (agency_id, statut, score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS agency_actions_assignee_idx
  ON public.agency_actions (assigned_to, statut)
  WHERE assigned_to IS NOT NULL;

ALTER TABLE public.agency_actions ENABLE ROW LEVEL SECURITY;

-- Lecture : membres de l'agence active. Le filtrage « mes propositions vs
-- celles des collègues » se fait au-dessus (lib/agency/visibility), pas ici :
-- la RLS garantit l'isolation inter-agences, elle n'arbitre pas le métier.
DROP POLICY IF EXISTS agency_actions_select ON public.agency_actions;
CREATE POLICY agency_actions_select ON public.agency_actions
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

-- L'agent ne peut que résoudre une proposition ; il n'en crée pas et n'en
-- réécrit pas le contenu. Les générateurs passent par la clé service_role.
DROP POLICY IF EXISTS agency_actions_resolve ON public.agency_actions;
CREATE POLICY agency_actions_resolve ON public.agency_actions
  FOR UPDATE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()))
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

GRANT SELECT, UPDATE ON public.agency_actions TO authenticated;

COMMENT ON TABLE public.agency_actions IS
  'Propositions générées par les automatisations, validées ou ignorées par l''agent.';
COMMENT ON COLUMN public.agency_actions.dedup_key IS
  'Clé de déduplication par agence ; inclut la période pour les propositions récurrentes.';

-- ---------------------------------------------------------------------------
-- Curseurs des automatisations : jusqu'où chaque veille a déjà lu.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agency_automation_runs (
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  automation text NOT NULL,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  -- Curseur libre (date de dernier DPE lu, dernier id traité…).
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  PRIMARY KEY (agency_id, automation)
);

ALTER TABLE public.agency_automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_automation_runs_select ON public.agency_automation_runs;
CREATE POLICY agency_automation_runs_select ON public.agency_automation_runs
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

GRANT SELECT ON public.agency_automation_runs TO authenticated;

COMMENT ON TABLE public.agency_automation_runs IS
  'État d''avancement de chaque automatisation par agence (curseur incrémental).';
