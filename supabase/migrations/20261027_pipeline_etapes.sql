-- Pipeline : neuf étapes canoniques.
-- En prospection → Blacklisté → Contacté → Rendez-vous → Estimation →
-- Visite possible → Mandat signé → Vendu → Perdu.
-- La clé `pris` est conservée (historique lead_stage_events, démos) ; seul le
-- libellé devient « En prospection ».

CREATE OR REPLACE FUNCTION public.lead_status_for_stage(
  p_stage_id uuid,
  p_lost_reason text
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN p_stage_id IS NULL THEN 'nouveau'
    ELSE (
      SELECT CASE ls.cle
        WHEN 'pris' THEN 'contacte'
        WHEN 'prospection' THEN 'contacte'
        WHEN 'blackliste' THEN CASE
          WHEN p_lost_reason = 'vendeur_ailleurs' THEN 'vendeur_ailleurs'
          ELSE 'pas_interesse'
        END
        WHEN 'contacte' THEN 'contacte'
        WHEN 'rendez_vous' THEN 'interesse'
        WHEN 'estimation' THEN 'interesse'
        WHEN 'visite_possible' THEN 'interesse'
        WHEN 'mandat' THEN 'mandat_signe'
        WHEN 'vendu' THEN 'mandat_signe'
        WHEN 'perdu' THEN CASE
          WHEN p_lost_reason = 'vendeur_ailleurs' THEN 'vendeur_ailleurs'
          ELSE 'pas_interesse'
        END
        ELSE 'nouveau'
      END
      FROM public.lead_stages ls
      WHERE ls.id = p_stage_id
    )
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.seed_lead_stages_for_agency(p_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.lead_stages (agency_id, cle, libelle, ordre, type, accent_color)
  VALUES
    (p_agency_id, 'pris', 'En prospection', 1, 'entree', '#64748B'),
    (p_agency_id, 'blackliste', 'Blacklisté', 2, 'intermediaire', '#6B7280'),
    (p_agency_id, 'contacte', 'Contacté', 3, 'intermediaire', '#E8743C'),
    (p_agency_id, 'rendez_vous', 'Rendez-vous', 4, 'intermediaire', '#2E8B57'),
    (p_agency_id, 'estimation', 'Estimation', 5, 'intermediaire', '#1F8294'),
    (p_agency_id, 'visite_possible', 'Visite possible', 6, 'intermediaire', '#4A7C8C'),
    (p_agency_id, 'mandat', 'Mandat signé', 7, 'gagne', '#2E8B57'),
    (p_agency_id, 'vendu', 'Vendu', 8, 'gagne', '#1B6B45'),
    (p_agency_id, 'perdu', 'Perdu', 9, 'perdu', '#D16B5B')
  ON CONFLICT (agency_id, cle) DO NOTHING;
END;
$fn$;

-- Agences existantes : libellés, nouvelles colonnes, réordonnancement.
DO $mig$
DECLARE
  v_agency uuid;
BEGIN
  FOR v_agency IN SELECT id FROM public.agencies LOOP
    UPDATE public.lead_stages
    SET libelle = 'En prospection'
    WHERE agency_id = v_agency AND cle = 'pris';

    UPDATE public.lead_stages
    SET ordre = ordre + 1000
    WHERE agency_id = v_agency;

    INSERT INTO public.lead_stages (agency_id, cle, libelle, ordre, type, accent_color)
    VALUES
      (v_agency, 'blackliste', 'Blacklisté', 2002, 'intermediaire', '#6B7280'),
      (v_agency, 'visite_possible', 'Visite possible', 2006, 'intermediaire', '#4A7C8C'),
      (v_agency, 'vendu', 'Vendu', 2008, 'gagne', '#1B6B45')
    ON CONFLICT (agency_id, cle) DO NOTHING;

    UPDATE public.lead_stages SET ordre = 1, libelle = 'En prospection', accent_color = COALESCE(accent_color, '#64748B')
      WHERE agency_id = v_agency AND cle = 'pris';
    UPDATE public.lead_stages SET ordre = 2, libelle = 'Blacklisté', accent_color = COALESCE(accent_color, '#6B7280')
      WHERE agency_id = v_agency AND cle = 'blackliste';
    UPDATE public.lead_stages SET ordre = 3, libelle = 'Contacté'
      WHERE agency_id = v_agency AND cle = 'contacte';
    UPDATE public.lead_stages SET ordre = 4, libelle = 'Rendez-vous'
      WHERE agency_id = v_agency AND cle = 'rendez_vous';
    UPDATE public.lead_stages SET ordre = 5, libelle = 'Estimation'
      WHERE agency_id = v_agency AND cle = 'estimation';
    UPDATE public.lead_stages SET ordre = 6, libelle = 'Visite possible', accent_color = COALESCE(accent_color, '#4A7C8C')
      WHERE agency_id = v_agency AND cle = 'visite_possible';
    UPDATE public.lead_stages SET ordre = 7, libelle = 'Mandat signé'
      WHERE agency_id = v_agency AND cle = 'mandat';
    UPDATE public.lead_stages SET ordre = 8, libelle = 'Vendu', type = 'gagne', accent_color = COALESCE(accent_color, '#1B6B45')
      WHERE agency_id = v_agency AND cle = 'vendu';
    UPDATE public.lead_stages SET ordre = 9, libelle = 'Perdu'
      WHERE agency_id = v_agency AND cle = 'perdu';

    -- Étapes custom encore décalées : après Perdu, sans collision.
    WITH extras AS (
      SELECT id, 9 + ROW_NUMBER() OVER (ORDER BY ordre, cle) AS nouvel_ordre
      FROM public.lead_stages
      WHERE agency_id = v_agency AND ordre >= 1000
    )
    UPDATE public.lead_stages ls
    SET ordre = extras.nouvel_ordre
    FROM extras
    WHERE ls.id = extras.id;
  END LOOP;
END;
$mig$;
