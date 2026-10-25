-- Balayage des annonces de particuliers (PAP, SeLoger) — 25/10/2026.
--
-- Chaque nuit, le cron /api/cron/balayage lit les pages de résultats des codes
-- postaux des agences, crée les annonces neuves (`annonces`, origine 'veille'),
-- suit leurs prix, puis lit la fiche de chaque nouvelle pour la localiser.
-- Les pages arrivent par Bright Data en 5 à 50 s : le travail passe par cette
-- file, consommée par tranches de quelques minutes qui se relaient.
--
-- Écrite et lue par le service role seulement.

CREATE TABLE IF NOT EXISTS public.annonces_balayage_taches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nuit de balayage (date à Paris) : une page de résultats n'est lue qu'une fois par nuit.
  nuit date NOT NULL,
  portail text NOT NULL CHECK (portail IN ('pap', 'seloger')),
  code_postal text NOT NULL,
  -- recherche : une page de résultats ; fiche : lire et localiser une annonce neuve ;
  -- verification : rouvrir la fiche d'une annonce disparue des résultats ;
  -- cloture : fin du balayage d'un code postal (retraits à vérifier, journal).
  genre text NOT NULL CHECK (genre IN ('recherche', 'fiche', 'verification', 'cloture')),
  url text NOT NULL,
  page smallint,
  -- SeLoger : 'complet' (toutes les pages) ou 'recent' (jusqu'au seuil `depuis`).
  mode text CHECK (mode IN ('complet', 'recent')),
  depuis timestamptz,
  annonce_id uuid REFERENCES public.annonces(id) ON DELETE CASCADE,
  statut text NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'en_cours', 'faite', 'echec')),
  essais smallint NOT NULL DEFAULT 0,
  prise_le timestamptz,
  finie_le timestamptz,
  erreur text,
  resultat jsonb,
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nuit, genre, url)
);

CREATE INDEX IF NOT EXISTS annonces_balayage_taches_a_faire_idx
  ON public.annonces_balayage_taches (statut, genre, cree_le);
CREATE INDEX IF NOT EXISTS annonces_balayage_taches_groupe_idx
  ON public.annonces_balayage_taches (nuit, portail, code_postal, genre);

COMMENT ON TABLE public.annonces_balayage_taches IS
  'File du balayage nocturne des annonces de particuliers (PAP, SeLoger). Service role seulement.';

ALTER TABLE public.annonces_balayage_taches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.annonces_balayage_taches FROM anon, authenticated;

-- Prend jusqu'à p_n tâches à faire, atomiquement : deux tranches simultanées
-- ne prennent jamais la même. Une tâche « en cours » depuis plus de dix
-- minutes (tranche coupée) est reprise. Les pages de résultats passent avant
-- les fiches : elles créent le travail suivant.
CREATE OR REPLACE FUNCTION public.balayage_prendre(p_n integer, p_genres text[] DEFAULT NULL)
RETURNS SETOF public.annonces_balayage_taches
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.annonces_balayage_taches t
  SET statut = 'en_cours', prise_le = now(), essais = t.essais + 1
  WHERE t.id IN (
    SELECT id FROM public.annonces_balayage_taches
    WHERE genre <> 'cloture'
      AND (p_genres IS NULL OR genre = ANY (p_genres))
      AND (statut = 'a_faire' OR (statut = 'en_cours' AND prise_le < now() - interval '10 minutes'))
    ORDER BY CASE genre WHEN 'recherche' THEN 0 WHEN 'verification' THEN 1 ELSE 2 END, cree_le
    LIMIT greatest(p_n, 0)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING t.*;
$function$;

REVOKE ALL ON FUNCTION public.balayage_prendre(integer, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.balayage_prendre(integer, text[]) TO service_role;
