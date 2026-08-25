-- Journal des recherches dans la base (vitrine).
-- Isolation inchangée : agency_id = current_user_agency_id().
-- On ne stocke jamais le texte de la réponse.

CREATE TABLE IF NOT EXISTS public.assistant_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  question text NOT NULL,
  detected_type text NOT NULL,
  lignes_count integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assistant_queries IS
  'Questions posées à la recherche en langage naturel. Sans le contenu de la réponse.';

CREATE INDEX IF NOT EXISTS assistant_queries_agency_idx
  ON public.assistant_queries (agency_id, created_at DESC);

ALTER TABLE public.assistant_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assistant_queries_select_agency ON public.assistant_queries;
CREATE POLICY assistant_queries_select_agency ON public.assistant_queries
  FOR SELECT TO authenticated
  USING (agency_id = public.current_user_agency_id());

DROP POLICY IF EXISTS assistant_queries_insert_own ON public.assistant_queries;
CREATE POLICY assistant_queries_insert_own ON public.assistant_queries
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND profile_id = auth.uid()
  );
