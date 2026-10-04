-- Plafond quotidien d'appels à Mistral, par agent (lib/ia/quota.ts).
-- Les limites en mémoire du serveur ne valent que pour une instance ; ce
-- compteur est commun à toutes. Les plafonds vivent dans le code.

CREATE TABLE IF NOT EXISTS public.ia_consommation (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  jour date NOT NULL,
  usage text NOT NULL CHECK (length(usage) BETWEEN 1 AND 40),
  appels integer NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, jour, usage)
);

CREATE INDEX IF NOT EXISTS ia_consommation_agence_jour_idx ON public.ia_consommation (agency_id, jour);

-- Écrite par la seule fonction ci-dessous ; lue par le serveur.
ALTER TABLE public.ia_consommation ENABLE ROW LEVEL SECURITY;

-- Réserve un appel pour l'agent connecté. Faux quand le plafond du jour
-- (heure de Paris) est atteint. Atomique : deux appels simultanés ne
-- franchissent pas le plafond ensemble.
CREATE OR REPLACE FUNCTION public.ia_reserver(p_usage text, p_plafond integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_agence uuid := public.current_user_agency_id();
  v_jour date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_appels integer;
BEGIN
  IF v_uid IS NULL OR v_agence IS NULL THEN
    RETURN false;
  END IF;
  IF p_usage IS NULL OR length(p_usage) NOT BETWEEN 1 AND 40 OR p_plafond IS NULL OR p_plafond < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.ia_consommation AS c (profile_id, agency_id, jour, usage, appels)
  VALUES (v_uid, v_agence, v_jour, p_usage, 1)
  ON CONFLICT (profile_id, jour, usage)
  DO UPDATE SET appels = c.appels + 1
  WHERE c.appels < p_plafond
  RETURNING appels INTO v_appels;

  RETURN v_appels IS NOT NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.ia_reserver(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ia_reserver(text, integer) TO authenticated, service_role;
