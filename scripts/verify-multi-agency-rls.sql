-- Vérifications RLS multi-agences (Supabase SQL Editor, après migrations 20260713 + 20260715).
-- Remplacer les UUID par des IDs réels.

-- =============================================================================
-- 1) Backfill : une ligne profile_agencies par profil
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM public.profiles) AS profiles_count,
  (SELECT COUNT(*) FROM public.profile_agencies) AS memberships_count,
  (SELECT COUNT(*) FROM public.profiles) =
    (SELECT COUNT(*) FROM public.profile_agencies) AS backfill_ok;

-- Attendu prod actuelle (mono-agence) :
--   Century 21 Quartier Latin → codes_postaux ['75005']
--   Agence test → codes_postaux ['75020']

-- =============================================================================
-- 2) TEST DE FUITE — collaborateur agence A ne voit PAS les leads agence B
-- =============================================================================
-- Connecté en tant que collaborateur agence A (JWT ou session test Supabase) :
--   SELECT COUNT(*) FROM public.leads WHERE agency_id = '<agency_b_uuid>';
-- DOIT retourner 0.

-- Variante : tenter un UPDATE cross-agence (doit affecter 0 lignes) :
--   UPDATE public.leads SET status = 'contacte'
--   WHERE agency_id = '<agency_b_uuid>' AND id = '<lead_b_uuid>';
-- DOIT retourner 0 rows updated.

-- =============================================================================
-- 3) Directeur bi-agences : isolation par agence active
-- =============================================================================
-- UPDATE profiles SET active_agency_id = '<agency_b_uuid>' WHERE id = '<directeur_uuid>';
-- SELECT public.current_user_agency_id(), public.current_user_role();
-- SELECT COUNT(*) FROM public.leads;
-- (ne doit compter que les leads de agency_b)

-- =============================================================================
-- 4) Ajouter Ulysse à plusieurs agences (manuel, Simon)
-- =============================================================================
-- INSERT INTO public.profile_agencies (profile_id, agency_id, role)
-- VALUES ('<ulysse_profile_id>', '<agency_2_id>', 'directeur')
-- ON CONFLICT DO NOTHING;
