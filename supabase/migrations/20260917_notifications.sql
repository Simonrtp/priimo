-- Ce qui s'est passé, pour UN destinataire. Jamais une tâche : si ça se fait,
-- ça vit sur l'Accueil. Isolation : profile_id = auth.uid() ET l'agence active.
-- L'écriture passe par le service role (événements serveur). Le client ne
-- fait que lire et marquer comme lu.

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type text NOT NULL,
  titre text NOT NULL,
  corps text NOT NULL,
  lien text NOT NULL,
  entite_type text,
  entite_id uuid,
  lue_le timestamptz,
  groupe_cle text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_check CHECK (
    type IN (
      'leads_livres',
      'leads_assignes',
      'contact_transfere',
      'invitation_acceptee',
      'zone_modifiee',
      'estimation_consultee',
      'demande_estimation',
      'lead_portail',
      'note_transcrite',
      'estimation_calculee',
      'import_termine',
      'anniversaire',
      'negociateur_sans_activite',
      'zone_non_travaillee',
      'mandat_60_jours'
    )
  )
);

COMMENT ON TABLE public.notifications IS
  'Historique lisible, un destinataire. Pas une file de tâches.';
COMMENT ON COLUMN public.notifications.profile_id IS
  'Destinataire. Une notification ne se partage jamais.';
COMMENT ON COLUMN public.notifications.groupe_cle IS
  'Regroupement d''affichage : même clé dans une fenêtre de 2 h = une ligne.';
COMMENT ON COLUMN public.notifications.lien IS
  'Route à ouvrir. Une notification sans destination n''a pas lieu d''être.';

CREATE INDEX notifications_destinataire_idx
  ON public.notifications (profile_id, agency_id, created_at DESC);

CREATE INDEX notifications_non_lues_idx
  ON public.notifications (profile_id, agency_id)
  WHERE lue_le IS NULL;

CREATE INDEX notifications_groupe_idx
  ON public.notifications (profile_id, groupe_cle, created_at DESC)
  WHERE groupe_cle IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    AND agency_id = (SELECT public.current_user_agency_id())
  );

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    AND agency_id = (SELECT public.current_user_agency_id())
  )
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND agency_id = (SELECT public.current_user_agency_id())
  );

REVOKE ALL ON public.notifications FROM PUBLIC;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
