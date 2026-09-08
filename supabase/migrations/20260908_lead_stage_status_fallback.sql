CREATE OR REPLACE FUNCTION public.lead_status_for_stage(
  p_stage_id uuid,
  p_lost_reason text
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_stage_id IS NULL THEN 'nouveau'
    ELSE (
      SELECT CASE
        WHEN ls.cle IN ('pris', 'contacte') THEN 'contacte'
        WHEN ls.cle = 'rendez_vous' THEN 'interesse'
        WHEN ls.cle = 'mandat' THEN 'mandat_signe'
        WHEN ls.cle = 'perdu' THEN CASE
          WHEN p_lost_reason = 'vendeur_ailleurs' THEN 'vendeur_ailleurs'
          ELSE 'pas_interesse'
        END
        WHEN ls.type = 'entree' THEN 'contacte'
        WHEN ls.type = 'intermediaire' THEN 'contacte'
        WHEN ls.type = 'gagne' THEN 'mandat_signe'
        WHEN ls.type = 'perdu' THEN CASE
          WHEN p_lost_reason = 'vendeur_ailleurs' THEN 'vendeur_ailleurs'
          ELSE 'pas_interesse'
        END
        ELSE 'nouveau'
      END
      FROM public.lead_stages ls
      WHERE ls.id = p_stage_id
    )
  END;
$$;
