-- Zones de négociateur : le découpage INTERNE du territoire de l'agence.
--
-- Deux niveaux à ne jamais confondre :
--   * le TERRITOIRE de l'agence = agencies.codes_postaux. Il décide de ce que
--     Priimo livre et de ce que l'exclusivité protège. Cette migration n'y
--     touche pas.
--   * la ZONE du négociateur = ce découpage-ci. Aucun effet sur la facturation
--     ni sur la livraison : seulement sur l'attribution et l'affichage.
--
-- Une zone n'est pas une géométrie, c'est un ENSEMBLE DE RÈGLES qui se
-- cumulent (zone_regles). Aucune extension PostGIS : les contours sont du
-- GeoJSON en jsonb et le test point-dans-polygone se fait en TypeScript
-- (lib/zones/appartenance.ts).
--
-- L'appartenance n'est jamais stockée sur un lead, un contact ou un bien : 
-- elle se calcule à la lecture. Un négociateur qui part et dont la zone est
-- réattribuée ne doit pas voir l'historique de ses leads changer de main.

CREATE TABLE IF NOT EXISTS public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  nom text NOT NULL,
  couleur text NOT NULL,
  -- Titulaire de la zone. ON DELETE SET NULL : un départ laisse la zone en
  -- place, à réattribuer, il ne la supprime pas.
  assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  -- Jour de la semaine travaillé sur la zone, 1 = lundi. Facultatif : une
  -- agence peut découper sans calendrier.
  jour_semaine smallint,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zones_nom_non_vide CHECK (btrim(nom) <> ''),
  CONSTRAINT zones_couleur_hex CHECK (couleur ~* '^#[0-9a-f]{6}$'),
  CONSTRAINT zones_jour_semaine_check CHECK (
    jour_semaine IS NULL OR jour_semaine BETWEEN 1 AND 5
  )
);

COMMENT ON TABLE public.zones IS
  'Découpage interne du territoire agence entre négociateurs. Sans effet sur la livraison ni la facturation.';
COMMENT ON COLUMN public.zones.assigned_to IS
  'Titulaire de la zone. Null = zone dessinée mais pas encore attribuée.';
COMMENT ON COLUMN public.zones.jour_semaine IS
  'Jour travaillé sur la zone, 1 = lundi. Null = pas de calendrier de tournée.';
COMMENT ON COLUMN public.zones.couleur IS
  'Teinte de la palette zones (8 tons désaturés). Jamais l''orange lead #E8743C.';

CREATE INDEX IF NOT EXISTS zones_agency_actif_idx
  ON public.zones (agency_id, actif);

CREATE INDEX IF NOT EXISTS zones_assigned_to_idx
  ON public.zones (assigned_to)
  WHERE assigned_to IS NOT NULL;

-- Un seul titulaire par jour de tournée : deux zones le même mardi pour le
-- même agent rendraient la « zone du jour » indécidable.
CREATE UNIQUE INDEX IF NOT EXISTS zones_titulaire_jour_uidx
  ON public.zones (agency_id, assigned_to, jour_semaine)
  WHERE assigned_to IS NOT NULL AND jour_semaine IS NOT NULL AND actif;

DROP TRIGGER IF EXISTS trg_zones_set_updated_at ON public.zones;
CREATE TRIGGER trg_zones_set_updated_at
  BEFORE UPDATE ON public.zones
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.zone_regles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.zones (id) ON DELETE CASCADE,
  type text NOT NULL,
  valeur jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- false = la règle RETIRE : « tout ce polygone SAUF la rue de Bagnolet ».
  inclusion boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zone_regles_type_check CHECK (
    type IN ('polygone', 'voie', 'code_postal', 'parcelles')
  )
);

COMMENT ON TABLE public.zone_regles IS
  'Règles cumulatives d''une zone. Les exclusions l''emportent toujours sur les inclusions.';
COMMENT ON COLUMN public.zone_regles.valeur IS
  'polygone : géométrie GeoJSON. voie : nom_voie, code_postal, parite, numero_min, numero_max. code_postal : code_postal. parcelles : parcelle_ids.';
COMMENT ON COLUMN public.zone_regles.inclusion IS
  'true = ajoute au périmètre, false = en retire. Une zone se construit par ajouts et retraits successifs.';

CREATE INDEX IF NOT EXISTS zone_regles_zone_idx
  ON public.zone_regles (zone_id, type);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_regles ENABLE ROW LEVEL SECURITY;

-- Lecture : toute l'agence. Un négociateur doit voir les zones de ses
-- collègues, sinon il ne peut ni repérer les trous ni les chevauchements.
DROP POLICY IF EXISTS zones_select_agency ON public.zones;
CREATE POLICY zones_select_agency
  ON public.zones
  FOR SELECT
  TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

-- Créer, renommer, réattribuer, désactiver : directeur seulement.
DROP POLICY IF EXISTS zones_insert_directeur ON public.zones;
CREATE POLICY zones_insert_directeur
  ON public.zones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

DROP POLICY IF EXISTS zones_update_directeur ON public.zones;
CREATE POLICY zones_update_directeur
  ON public.zones
  FOR UPDATE
  TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  )
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

DROP POLICY IF EXISTS zones_delete_directeur ON public.zones;
CREATE POLICY zones_delete_directeur
  ON public.zones
  FOR DELETE
  TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

DROP POLICY IF EXISTS zone_regles_select_agency ON public.zone_regles;
CREATE POLICY zone_regles_select_agency
  ON public.zone_regles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.zones z
      WHERE z.id = zone_regles.zone_id
        AND z.agency_id = (SELECT public.current_user_agency_id())
    )
  );

-- Dessiner : le directeur sur toute l'agence, le négociateur sur SA zone.
-- Un secteur se corrige par son titulaire ; il se crée par la direction.
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
          OR z.assigned_to = (SELECT auth.uid())
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
          OR z.assigned_to = (SELECT auth.uid())
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
          OR z.assigned_to = (SELECT auth.uid())
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
          OR z.assigned_to = (SELECT auth.uid())
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zone_regles TO authenticated;
