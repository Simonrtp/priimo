-- Abonnements Web Push.
--
-- Une ligne par appareil et par agent : le meme agent recoit sur son telephone
-- et sur son poste, et revoquer l'un ne doit pas couper l'autre. L'endpoint
-- fait office d'identite -- c'est lui que le service de push nous rend quand
-- l'abonnement expire.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_profile_idx
  ON public.push_subscriptions (profile_id);

CREATE INDEX IF NOT EXISTS push_subscriptions_agency_idx
  ON public.push_subscriptions (agency_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Un agent ne gere que ses propres appareils, jamais ceux d'un collegue.
DROP POLICY IF EXISTS push_subscriptions_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND agency_id = (SELECT public.current_user_agency_id())
  );

DROP POLICY IF EXISTS push_subscriptions_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (profile_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;

COMMENT ON TABLE public.push_subscriptions IS
  'Abonnements Web Push, un par appareil. Nettoyes automatiquement sur 404/410.';
