-- Doublon entre collègues : un négociateur a tenté d'ajouter un contact dont
-- le téléphone ou l'e-mail est déjà dans la fiche d'un collègue. La direction
-- reçoit l'alerte dans « À valider » et peut créer la fiche quand même, au nom
-- du négociateur, ou l'ignorer.
--
-- Cette proposition parle de la fiche d'un collègue : seule la direction la lit
-- et la tranche. Le code l'écarte déjà des listes d'un négociateur ; la RLS
-- referme aussi l'accès direct par l'API.

ALTER TABLE public.agency_actions
  DROP CONSTRAINT IF EXISTS agency_actions_kind_check;

ALTER TABLE public.agency_actions
  ADD CONSTRAINT agency_actions_kind_check
  CHECK (kind = ANY (ARRAY[
    'rapprochement_inverse'::text,
    'veille_dpe'::text,
    'veille_mutation'::text,
    'compte_rendu_mandat'::text,
    'engagement_note'::text,
    'estimation_dormante'::text,
    'immeuble_suivi'::text,
    'doublon_contact'::text
  ]));

DROP POLICY IF EXISTS agency_actions_select ON public.agency_actions;
CREATE POLICY agency_actions_select ON public.agency_actions
  FOR SELECT TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (kind <> 'doublon_contact' OR (SELECT public.current_user_role()) = 'directeur')
  );

DROP POLICY IF EXISTS agency_actions_resolve ON public.agency_actions;
CREATE POLICY agency_actions_resolve ON public.agency_actions
  FOR UPDATE TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (kind <> 'doublon_contact' OR (SELECT public.current_user_role()) = 'directeur')
  )
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND (kind <> 'doublon_contact' OR (SELECT public.current_user_role()) = 'directeur')
  );
