-- Deuxième passe de l'audit : les fonctions SECURITY DEFINER qu'un
-- utilisateur connecté pouvait appeler avec l'identifiant d'une AUTRE agence.

-- 1) Jamais appelées par l'application (ni RPC, ni politique, ni vue) : seuls
--    le serveur (clé secrète) et la base elle-même les gardent. seed_* reste
--    appelée par le trigger de création d'agence, qui tourne en propriétaire.
REVOKE EXECUTE ON FUNCTION public.agency_estimations_today(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.calculer_dernier_contact_contact(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.calculer_dernier_contact_lead(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_lead_stages_for_agency(uuid) FROM authenticated;

-- 2) Budget de « Mon assistant » : appelé avec la session de l'agent. Un
--    agent ne lit plus que la consommation de ses propres agences ; le
--    serveur et l'admin voient tout.
CREATE OR REPLACE FUNCTION public.assistant_tokens_du_mois(p_agency_id uuid, p_debut timestamp with time zone)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(m.tokens), 0)::bigint
  FROM public.assistant_messages m
  JOIN public.assistant_conversations c ON c.id = m.conversation_id
  WHERE c.agency_id = p_agency_id
    AND m.created_at >= p_debut
    AND (
      COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated')
      OR p_agency_id IN (SELECT public.current_user_agency_ids())
    );
$function$;

-- 3) search_path figé sur les fonctions de trigger (plpgsql, jamais
--    « inlinées » : aucun effet sur les performances). Les fonctions SQL
--    restantes (normaliser_telephone, conservation_prospection_annees,
--    dernier_accord_telephone, parcelle_counts_for_agency) sont SECURITY
--    INVOKER et qualifiées : un SET les empêcherait d'être inlinées dans les
--    requêtes, pour un gain de sécurité nul. On les laisse.
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.validate_profile_active_agency() SET search_path = public;
ALTER FUNCTION public.compute_mandat_irrevocable() SET search_path = public;
ALTER FUNCTION public.zones_proteger_direction() SET search_path = public;
