-- Conversations de l'assistant.
--
-- Une conversation appartient à SON AUTEUR. Un directeur ne lit pas les
-- conversations de ses agents : ce sont des questions de travail, parfois
-- maladroites, et les rendre visibles tuerait l'usage. Même règle que les
-- notes privées.
--
-- `resume` porte le résumé roulant des messages anciens : on ne renvoie
-- jamais l'historique complet au modèle.

CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  titre text NOT NULL DEFAULT '',
  resume text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assistant_conversations IS
  'Fils de conversation avec l''assistant. Privés : visibles du seul auteur.';
COMMENT ON COLUMN public.assistant_conversations.resume IS
  'Résumé roulant des messages sortis de la fenêtre courante. Régénéré tous les 6 messages.';

CREATE INDEX IF NOT EXISTS assistant_conversations_owner_idx
  ON public.assistant_conversations (profile_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS assistant_conversations_agency_idx
  ON public.assistant_conversations (agency_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL
    REFERENCES public.assistant_conversations (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  contenu text NOT NULL,
  lignes_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assistant_messages IS
  'Messages d''un fil. lignes_sources = les lignes de base qui ont produit la réponse.';
COMMENT ON COLUMN public.assistant_messages.tokens IS
  'Tokens facturés pour ce message (prompt + complétion). 0 si aucun appel modèle.';

CREATE INDEX IF NOT EXISTS assistant_messages_conversation_idx
  ON public.assistant_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS : l'auteur, et lui seul.
-- ---------------------------------------------------------------------------
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assistant_conversations_select_own ON public.assistant_conversations;
CREATE POLICY assistant_conversations_select_own ON public.assistant_conversations
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    AND agency_id = public.current_user_agency_id()
  );

DROP POLICY IF EXISTS assistant_conversations_insert_own ON public.assistant_conversations;
CREATE POLICY assistant_conversations_insert_own ON public.assistant_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND agency_id = public.current_user_agency_id()
  );

DROP POLICY IF EXISTS assistant_conversations_update_own ON public.assistant_conversations;
CREATE POLICY assistant_conversations_update_own ON public.assistant_conversations
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS assistant_conversations_delete_own ON public.assistant_conversations;
CREATE POLICY assistant_conversations_delete_own ON public.assistant_conversations
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS assistant_messages_select_own ON public.assistant_messages;
CREATE POLICY assistant_messages_select_own ON public.assistant_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assistant_conversations c
      WHERE c.id = conversation_id
        AND c.profile_id = auth.uid()
        AND c.agency_id = public.current_user_agency_id()
    )
  );

DROP POLICY IF EXISTS assistant_messages_insert_own ON public.assistant_messages;
CREATE POLICY assistant_messages_insert_own ON public.assistant_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.assistant_conversations c
      WHERE c.id = conversation_id
        AND c.profile_id = auth.uid()
        AND c.agency_id = public.current_user_agency_id()
    )
  );

DROP POLICY IF EXISTS assistant_messages_delete_own ON public.assistant_messages;
CREATE POLICY assistant_messages_delete_own ON public.assistant_messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assistant_conversations c
      WHERE c.id = conversation_id
        AND c.profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Consommation : les tokens du mois, par agence. Sert au plafond et à l'admin.
-- SECURITY DEFINER car les messages sont privés : la fonction ne rend qu'un
-- agrégat, jamais un contenu.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assistant_tokens_du_mois(p_agency_id uuid, p_debut timestamptz)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(m.tokens), 0)::bigint
  FROM public.assistant_messages m
  JOIN public.assistant_conversations c ON c.id = m.conversation_id
  WHERE c.agency_id = p_agency_id
    AND m.created_at >= p_debut;
$$;

REVOKE ALL ON FUNCTION public.assistant_tokens_du_mois(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assistant_tokens_du_mois(uuid, timestamptz) TO authenticated, service_role;
