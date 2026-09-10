-- Objectifs posés par le négociateur lui-même.
--
-- 20260909_activite_terrain.sql réservait l'écriture de activity_goals au
-- directeur. C'était supposer que l'objectif descend toujours de la hiérarchie.
-- Sur le terrain, le négociateur règle d'abord ses propres chiffres — un
-- objectif qu'on n'a pas posé soi-même n'est pas un objectif, c'est un reproche
-- affiché en haut de l'écran toutes les semaines.
--
-- Le directeur garde son droit d'écriture sur toute l'agence : les politiques
-- ci-dessous s'ajoutent aux siennes, elles ne les remplacent pas (deux
-- politiques PERMISSIVE sur la même commande se cumulent en OR).
--
-- Ce qui reste fermé : écrire sur le compte d'un collègue. La lecture, elle, ne
-- bouge pas — activity_goals_select_agency couvrait déjà toute l'agence.

DROP POLICY IF EXISTS activity_goals_insert_soi ON public.activity_goals;
CREATE POLICY activity_goals_insert_soi
  ON public.activity_goals
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND profile_id = auth.uid()
  );

DROP POLICY IF EXISTS activity_goals_update_soi ON public.activity_goals;
CREATE POLICY activity_goals_update_soi
  ON public.activity_goals
  FOR UPDATE TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND profile_id = auth.uid()
  )
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    AND profile_id = auth.uid()
  );

DROP POLICY IF EXISTS activity_goals_delete_soi ON public.activity_goals;
CREATE POLICY activity_goals_delete_soi
  ON public.activity_goals
  FOR DELETE TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    AND profile_id = auth.uid()
  );

COMMENT ON TABLE public.activity_goals IS
  'Objectifs d''activité par collaborateur. Chacun pose les siens, le directeur pose ceux de son agence. Une ligne absente n''est pas une erreur : le défaut vit dans lib/activite/objectifs.ts, ce qui évite de semer six lignes à chaque création de compte.';
