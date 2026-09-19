-- Socle du rapport d'estimation (avis de valeur) : identité d'agence,
-- identité agent, bibliothèque de pages, composition par estimation.
-- Les pages générées depuis la donnée viendront plus tard (source = generee).

-- ---------------------------------------------------------------------------
-- 1) Identité d'agence
-- ---------------------------------------------------------------------------
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS nom_commercial text,
  ADD COLUMN IF NOT EXISTS site_web text;

COMMENT ON COLUMN public.agencies.logo_path IS
  'Chemin storage (bucket rapport-pages) du logo d''en-tête. Pas d''URL publique.';
COMMENT ON COLUMN public.agencies.nom_commercial IS
  'Nom commercial affiché sur le rapport. NULL = agencies.name.';
COMMENT ON COLUMN public.agencies.site_web IS
  'Site web de l''agence, sans obligation de schéma.';

-- ---------------------------------------------------------------------------
-- 2) Identité agent
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_pro text;

COMMENT ON COLUMN public.profiles.email_pro IS
  'Email professionnel affiché au pied du rapport. NULL = email de connexion.';

-- ---------------------------------------------------------------------------
-- 3) Bibliothèque de pages (agence)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_rapport_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  kind text NOT NULL CHECK (kind IN ('pdf', 'image')),
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  page_count integer NOT NULL DEFAULT 1 CHECK (page_count >= 1 AND page_count <= 40),
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_rapport_pages_agency_pos_idx
  ON public.agency_rapport_pages (agency_id, position, created_at);

DROP TRIGGER IF EXISTS trg_agency_rapport_pages_updated ON public.agency_rapport_pages;
CREATE TRIGGER trg_agency_rapport_pages_updated
  BEFORE UPDATE ON public.agency_rapport_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agency_rapport_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_rapport_pages_select ON public.agency_rapport_pages;
CREATE POLICY agency_rapport_pages_select ON public.agency_rapport_pages
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS agency_rapport_pages_insert ON public.agency_rapport_pages;
CREATE POLICY agency_rapport_pages_insert ON public.agency_rapport_pages
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS agency_rapport_pages_update ON public.agency_rapport_pages;
CREATE POLICY agency_rapport_pages_update ON public.agency_rapport_pages
  FOR UPDATE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()))
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS agency_rapport_pages_delete ON public.agency_rapport_pages;
CREATE POLICY agency_rapport_pages_delete ON public.agency_rapport_pages
  FOR DELETE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

-- ---------------------------------------------------------------------------
-- 4) Composition du rapport (par estimation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estimation_rapport_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimation_id uuid NOT NULL REFERENCES public.agency_estimations (id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('bibliotheque', 'import', 'generee')),
  bibliotheque_id uuid REFERENCES public.agency_rapport_pages (id) ON DELETE SET NULL,
  nom text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pdf', 'image', 'generee')),
  storage_path text,
  mime_type text,
  page_index integer NOT NULL DEFAULT 0 CHECK (page_index >= 0 AND page_index < 40),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimation_rapport_pages_est_pos_idx
  ON public.estimation_rapport_pages (estimation_id, position, created_at);

ALTER TABLE public.estimation_rapport_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estimation_rapport_pages_select ON public.estimation_rapport_pages;
CREATE POLICY estimation_rapport_pages_select ON public.estimation_rapport_pages
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS estimation_rapport_pages_insert ON public.estimation_rapport_pages;
CREATE POLICY estimation_rapport_pages_insert ON public.estimation_rapport_pages
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS estimation_rapport_pages_update ON public.estimation_rapport_pages;
CREATE POLICY estimation_rapport_pages_update ON public.estimation_rapport_pages
  FOR UPDATE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()))
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

DROP POLICY IF EXISTS estimation_rapport_pages_delete ON public.estimation_rapport_pages;
CREATE POLICY estimation_rapport_pages_delete ON public.estimation_rapport_pages
  FOR DELETE TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

-- ---------------------------------------------------------------------------
-- 5) Stockage privé — logo, bibliothèque, imports ponctuels
-- Chemin : '{agency_id}/logo|biblio|import/{fichier}'
-- Écriture réservée au service_role (routes API). Lecture agence.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rapport-pages',
  'rapport-pages',
  false,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS rapport_pages_objects_select_agency ON storage.objects;
CREATE POLICY rapport_pages_objects_select_agency ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rapport-pages'
    AND (storage.foldername(name))[1] = public.current_user_agency_id()::text
  );

DROP POLICY IF EXISTS rapport_pages_objects_insert_authenticated ON storage.objects;
DROP POLICY IF EXISTS rapport_pages_objects_update_authenticated ON storage.objects;
DROP POLICY IF EXISTS rapport_pages_objects_delete_authenticated ON storage.objects;
