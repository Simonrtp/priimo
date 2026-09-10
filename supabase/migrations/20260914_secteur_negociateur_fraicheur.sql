-- Le négociateur dessine SA zone. Le directeur peut la verrouiller.
-- La fréquence cible de passage est un repli d'agence, jamais un écran
-- de seuils demandé à l'installation.

ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS verrouillee boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.zones.verrouillee IS
  'Verrouillé par la direction : le titulaire lit, il ne retouche plus le contour.';

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS frequence_passage_jours integer;

COMMENT ON COLUMN public.agencies.frequence_passage_jours IS
  'Fréquence cible de passage, en jours. Null = repli 84 jours (12 semaines). Jamais demandée à l''installation.';

ALTER TABLE public.agencies
  DROP CONSTRAINT IF EXISTS agencies_frequence_passage_jours_check;
ALTER TABLE public.agencies
  ADD CONSTRAINT agencies_frequence_passage_jours_check CHECK (
    frequence_passage_jours IS NULL
    OR (frequence_passage_jours >= 14 AND frequence_passage_jours <= 365)
  );

-- Créer : le directeur partout, le négociateur pour lui-même.
DROP POLICY IF EXISTS zones_insert_directeur ON public.zones;
DROP POLICY IF EXISTS zones_insert_agence ON public.zones;
CREATE POLICY zones_insert_agence
  ON public.zones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND (
      (SELECT public.current_user_role()) = 'directeur'
      OR assigned_to = (SELECT auth.uid())
    )
  );

-- Modifier : le directeur partout ; le titulaire tant que ce n'est pas verrouillé.
DROP POLICY IF EXISTS zones_update_directeur ON public.zones;
DROP POLICY IF EXISTS zones_update_agence ON public.zones;
CREATE POLICY zones_update_agence
  ON public.zones
  FOR UPDATE
  TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (
      (SELECT public.current_user_role()) = 'directeur'
      OR (assigned_to = (SELECT auth.uid()) AND verrouillee = false)
    )
  )
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND (
      (SELECT public.current_user_role()) = 'directeur'
      OR (assigned_to = (SELECT auth.uid()) AND verrouillee = false)
    )
  );

-- Un titulaire ne peut ni se réattribuer, ni verrouiller, ni éteindre.
CREATE OR REPLACE FUNCTION public.zones_proteger_direction()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT public.current_user_role()) = 'directeur' THEN
    RETURN NEW;
  END IF;
  NEW.assigned_to := OLD.assigned_to;
  NEW.verrouillee := OLD.verrouillee;
  NEW.actif := OLD.actif;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zones_proteger_direction ON public.zones;
CREATE TRIGGER trg_zones_proteger_direction
  BEFORE UPDATE ON public.zones
  FOR EACH ROW
  EXECUTE FUNCTION public.zones_proteger_direction();

-- Une règle ne s'ajoute pas sur un secteur verrouillé, sauf par la direction.
DROP POLICY IF EXISTS zone_regles_insert ON public.zone_regles;
CREATE POLICY zone_regles_insert
  ON public.zone_regles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.zones z
      WHERE z.id = zone_regles.zone_id
        AND z.agency_id = (SELECT public.current_user_agency_id())
        AND (
          (SELECT public.current_user_role()) = 'directeur'
          OR (z.assigned_to = (SELECT auth.uid()) AND z.verrouillee = false)
        )
    )
  );

DROP POLICY IF EXISTS zone_regles_update ON public.zone_regles;
CREATE POLICY zone_regles_update
  ON public.zone_regles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.zones z
      WHERE z.id = zone_regles.zone_id
        AND z.agency_id = (SELECT public.current_user_agency_id())
        AND (
          (SELECT public.current_user_role()) = 'directeur'
          OR (z.assigned_to = (SELECT auth.uid()) AND z.verrouillee = false)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.zones z
      WHERE z.id = zone_regles.zone_id
        AND z.agency_id = (SELECT public.current_user_agency_id())
        AND (
          (SELECT public.current_user_role()) = 'directeur'
          OR (z.assigned_to = (SELECT auth.uid()) AND z.verrouillee = false)
        )
    )
  );

DROP POLICY IF EXISTS zone_regles_delete ON public.zone_regles;
CREATE POLICY zone_regles_delete
  ON public.zone_regles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.zones z
      WHERE z.id = zone_regles.zone_id
        AND z.agency_id = (SELECT public.current_user_agency_id())
        AND (
          (SELECT public.current_user_role()) = 'directeur'
          OR (z.assigned_to = (SELECT auth.uid()) AND z.verrouillee = false)
        )
    )
  );

-- Chevauchement : une alerte au directeur, sans bloquer le dessin.
ALTER TABLE public.agency_alerts
  DROP CONSTRAINT IF EXISTS agency_alerts_target;

ALTER TABLE public.agency_alerts
  DROP CONSTRAINT IF EXISTS agency_alerts_kind_check;

ALTER TABLE public.agency_alerts
  ADD CONSTRAINT agency_alerts_kind_check CHECK (
    kind IN ('baisse_prix', 'mandat_a_recuperer', 'chevauchement_zones')
  );

ALTER TABLE public.agency_alerts
  ADD CONSTRAINT agency_alerts_target CHECK (
    contact_id IS NOT NULL
    OR lead_id IS NOT NULL
    OR kind = 'chevauchement_zones'
  );
