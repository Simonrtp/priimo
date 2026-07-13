-- Vérifications manuelles RLS multi-agences (à exécuter sur Supabase après migration).
-- Remplacer les UUID par des IDs réels de test.

-- 1) Backfill : une ligne profile_agencies par profil
SELECT
  (SELECT COUNT(*) FROM public.profiles) AS profiles_count,
  (SELECT COUNT(*) FROM public.profile_agencies) AS memberships_count,
  (SELECT COUNT(*) FROM public.profiles) =
    (SELECT COUNT(*) FROM public.profile_agencies) AS backfill_ok;

-- 2) Collaborateur agence A ne doit PAS voir les leads agence B (doit retourner 0 lignes)
-- SET LOCAL role authenticated;
-- SET LOCAL request.jwt.claim.sub = '<collaborateur_agence_a_user_id>';
-- SELECT COUNT(*) FROM public.leads WHERE agency_id = '<agency_b_id>';

-- 3) Directeur bi-agences : current_user_agency_id() suit active_agency_id
-- UPDATE profiles SET active_agency_id = '<agency_b_id>' WHERE id = '<directeur_id>';
-- SELECT public.current_user_agency_id(), public.current_user_role();

-- 4) Isolation leads : uniquement l'agence active
-- SELECT agency_id, COUNT(*) FROM public.leads GROUP BY agency_id;
-- (comparer avec l'agence active du directeur)
