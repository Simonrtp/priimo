-- Garde-fous de facture : plafonds quotidiens communs à tous les serveurs,
-- à trois étages (agent, agence, tout Priimo), pour les services payés à
-- l'appel — lecture de pages par Bright Data, appels à Mistral.
--
-- Pourquoi en base : les limites en mémoire ne valent que pour une instance
-- du serveur ; Vercel en lance plusieurs. Ce compteur est commun et atomique :
-- cent requêtes simultanées ne franchissent pas un plafond ensemble.
--
-- Pourquoi réservé au service role : un plafond global partagé ne doit pas
-- pouvoir être gonflé par un utilisateur qui appellerait la fonction lui-même
-- (il bloquerait tout le monde). Le serveur passe l'identité qu'il a vérifiée.
--
-- Les plafonds vivent dans le code (lib/quota/regles.ts).

CREATE TABLE IF NOT EXISTS public.quota_compteurs (
  portee text NOT NULL CHECK (portee IN ('agent', 'agence', 'global')),
  cle text NOT NULL,
  jour date NOT NULL,
  usage text NOT NULL CHECK (length(usage) BETWEEN 1 AND 40),
  appels integer NOT NULL DEFAULT 0,
  PRIMARY KEY (portee, cle, jour, usage)
);

CREATE INDEX IF NOT EXISTS quota_compteurs_jour_idx ON public.quota_compteurs (jour, usage);

COMMENT ON TABLE public.quota_compteurs IS
  'Appels du jour (heure de Paris) aux services payants, par agent, agence et pour tout Priimo. Écrite par quota_reserver.';

-- Aucune lecture ni écriture directe : la fonction seule.
ALTER TABLE public.quota_compteurs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quota_compteurs FROM anon, authenticated;

-- Réserve un appel ; faux si l'un des trois plafonds du jour est atteint
-- (rien n'est alors compté).
CREATE OR REPLACE FUNCTION public.quota_reserver(
  p_profile uuid,
  p_agency uuid,
  p_usage text,
  p_plafond_agent integer,
  p_plafond_agence integer,
  p_plafond_global integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_jour date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_appels integer;
BEGIN
  IF p_profile IS NULL OR p_agency IS NULL OR p_usage IS NULL OR length(p_usage) NOT BETWEEN 1 AND 40 THEN
    RETURN false;
  END IF;
  IF coalesce(p_plafond_agent, 0) < 1 OR coalesce(p_plafond_agence, 0) < 1 OR coalesce(p_plafond_global, 0) < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.quota_compteurs AS c (portee, cle, jour, usage, appels)
  VALUES ('agent', p_profile::text, v_jour, p_usage, 1)
  ON CONFLICT (portee, cle, jour, usage) DO UPDATE SET appels = c.appels + 1
  WHERE c.appels < p_plafond_agent
  RETURNING appels INTO v_appels;
  IF v_appels IS NULL THEN
    RETURN false;
  END IF;

  v_appels := NULL;
  INSERT INTO public.quota_compteurs AS c (portee, cle, jour, usage, appels)
  VALUES ('agence', p_agency::text, v_jour, p_usage, 1)
  ON CONFLICT (portee, cle, jour, usage) DO UPDATE SET appels = c.appels + 1
  WHERE c.appels < p_plafond_agence
  RETURNING appels INTO v_appels;
  IF v_appels IS NULL THEN
    UPDATE public.quota_compteurs SET appels = appels - 1
    WHERE portee = 'agent' AND cle = p_profile::text AND jour = v_jour AND usage = p_usage;
    RETURN false;
  END IF;

  v_appels := NULL;
  INSERT INTO public.quota_compteurs AS c (portee, cle, jour, usage, appels)
  VALUES ('global', 'priimo', v_jour, p_usage, 1)
  ON CONFLICT (portee, cle, jour, usage) DO UPDATE SET appels = c.appels + 1
  WHERE c.appels < p_plafond_global
  RETURNING appels INTO v_appels;
  IF v_appels IS NULL THEN
    UPDATE public.quota_compteurs SET appels = appels - 1
    WHERE (portee = 'agent' AND cle = p_profile::text OR portee = 'agence' AND cle = p_agency::text)
      AND jour = v_jour AND usage = p_usage;
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.quota_reserver(uuid, uuid, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quota_reserver(uuid, uuid, text, integer, integer, integer) TO service_role;
