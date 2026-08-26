-- Dédoublonnage buildings.ban_id, backfill code_postal via parcelle_id,
-- agrégat rejouable, ANALYZE. Seuil DPE : argument de fonction, jamais un
-- INTERVAL en dur. Appel TS : PUBLIC_DPE_MIN_AGE_MONTHS.

-- ---------------------------------------------------------------------------
-- 1) code_postal manquant — DVF est keyed par parcelle_id, pas ban_id
-- ---------------------------------------------------------------------------
UPDATE public.building_transactions t
SET code_postal = src.code_postal
FROM (
  SELECT DISTINCT ON (parcelle_id)
    parcelle_id,
    code_postal
  FROM public.buildings
  WHERE parcelle_id IS NOT NULL
    AND code_postal IS NOT NULL
  ORDER BY parcelle_id, (ban_id IS NOT NULL) DESC, updated_at DESC NULLS LAST
) src
WHERE t.code_postal IS NULL
  AND t.parcelle_id = src.parcelle_id;

UPDATE public.parcelle_adresses a
SET code_postal = b.code_postal
FROM public.buildings b
WHERE a.code_postal IS NULL
  AND a.parcelle_id = b.parcelle_id
  AND b.code_postal IS NOT NULL;

UPDATE public.parcelle_adresses a
SET code_postal = b.code_postal
FROM public.buildings b
WHERE a.code_postal IS NULL
  AND a.ban_id = b.ban_id
  AND b.code_postal IS NOT NULL;

UPDATE public.parcelle_adresses a
SET code_postal = src.code_postal
FROM (
  SELECT DISTINCT ON (parcelle_id)
    parcelle_id,
    code_postal
  FROM public.parcelle_adresses
  WHERE code_postal IS NOT NULL
  ORDER BY parcelle_id, code_postal
) src
WHERE a.code_postal IS NULL
  AND a.parcelle_id = src.parcelle_id;

UPDATE public.parcelle_adresses a
SET code_postal = src.code_postal
FROM (
  SELECT DISTINCT ON (parcelle_id)
    parcelle_id,
    code_postal
  FROM public.building_transactions
  WHERE parcelle_id IS NOT NULL
    AND code_postal IS NOT NULL
  ORDER BY parcelle_id, code_postal
) src
WHERE a.code_postal IS NULL
  AND a.parcelle_id = src.parcelle_id;

UPDATE public.building_dpe d
SET code_postal = b.code_postal
FROM public.buildings b
WHERE d.code_postal IS NULL
  AND d.ban_id = b.ban_id
  AND b.code_postal IS NOT NULL;

UPDATE public.building_copro c
SET code_postal = b.code_postal
FROM public.buildings b
WHERE c.code_postal IS NULL
  AND c.ban_id = b.ban_id
  AND b.code_postal IS NOT NULL;

UPDATE public.building_activity a
SET code_postal = b.code_postal
FROM public.buildings b
WHERE a.code_postal IS NULL
  AND a.ban_id = b.ban_id
  AND b.code_postal IS NOT NULL;

-- Rattacher les mutations DVF sans BAN au pont parcelle ↔ adresse.
UPDATE public.building_transactions t
SET ban_id = src.ban_id
FROM (
  SELECT DISTINCT ON (parcelle_id)
    parcelle_id,
    ban_id
  FROM public.parcelle_adresses
  WHERE ban_id IS NOT NULL
  ORDER BY parcelle_id, ban_id
) src
WHERE t.ban_id IS NULL
  AND t.parcelle_id = src.parcelle_id;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.building_transactions WHERE code_postal IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'building_transactions.code_postal encore NULL : %', n;
  END IF;
  SELECT count(*) INTO n FROM public.building_dpe WHERE code_postal IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'building_dpe.code_postal encore NULL : %', n;
  END IF;
  SELECT count(*) INTO n FROM public.building_copro WHERE code_postal IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'building_copro.code_postal encore NULL : %', n;
  END IF;
  SELECT count(*) INTO n FROM public.building_activity WHERE code_postal IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'building_activity.code_postal encore NULL : %', n;
  END IF;
  SELECT count(*) INTO n FROM public.parcelle_adresses WHERE code_postal IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'parcelle_adresses.code_postal encore NULL : %', n;
  END IF;
  SELECT count(*) INTO n FROM public.buildings WHERE code_postal IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'buildings.code_postal encore NULL : %', n;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Dédoublonnage buildings.ban_id
--    Pas de ban_id en double non nul. Les 304 extras sont des lignes DVF
--    sans BAN : même parcelle déjà reliée à un immeuble nommé via
--    parcelle_adresses. Les supprimer (après backfill ci-dessus).
-- ---------------------------------------------------------------------------
DELETE FROM public.building_activity
WHERE ban_id IS NULL
   OR ban_id NOT LIKE '%\_%';

DELETE FROM public.buildings
WHERE ban_id IS NULL
   OR btrim(ban_id) = '';

DROP INDEX IF EXISTS public.buildings_ban_id_idx;

ALTER TABLE public.buildings
  ALTER COLUMN ban_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS buildings_ban_id_uidx
  ON public.buildings (ban_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
    WHERE n.nspname = 'public'
      AND c.relname = 'building_activity'
      AND i.indisunique
      AND i.indnatts = 1
      AND a.attname = 'ban_id'
  ) THEN
    CREATE UNIQUE INDEX building_activity_ban_id_uidx
      ON public.building_activity (ban_id);
  END IF;
END $$;

COMMENT ON TABLE public.buildings IS
  'Immeuble BAN. ban_id UNIQUE NOT NULL. Écriture pipeline par lots. Pas de géométrie cadastrale.';

-- ---------------------------------------------------------------------------
-- 3) Agrégat rejouable — le pipeline appelle après chaque import
--    SELECT public.refresh_building_activity(codes, p_dpe_min_age_months)
--    p_dpe_min_age_months = PUBLIC_DPE_MIN_AGE_MONTHS côté TypeScript.
--    Un DPE sans date_dpe est exclu partout (compteur, étiquette, carte).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_building_activity(
  p_codes_postaux text[],
  p_dpe_min_age_months integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
BEGIN
  IF p_codes_postaux IS NULL OR cardinality(p_codes_postaux) = 0 THEN
    RAISE EXCEPTION 'refresh_building_activity : p_codes_postaux requis';
  END IF;
  IF p_dpe_min_age_months IS NULL OR p_dpe_min_age_months < 0 THEN
    RAISE EXCEPTION 'refresh_building_activity : p_dpe_min_age_months requis';
  END IF;

  DELETE FROM public.building_activity a
  WHERE a.code_postal = ANY (p_codes_postaux)
    AND NOT EXISTS (
      SELECT 1 FROM public.buildings b WHERE b.ban_id = a.ban_id
    );

  WITH scoped AS (
    SELECT b.ban_id, b.parcelle_id, b.code_postal
    FROM public.buildings b
    WHERE b.code_postal = ANY (p_codes_postaux)
  ),
  tx_stats AS (
    SELECT
      s.ban_id,
      count(*)::integer AS nb_transactions_total,
      count(*) FILTER (
        WHERE t.date_mutation >= CURRENT_DATE - INTERVAL '3 years'
      )::integer AS nb_transactions_3ans,
      max(t.date_mutation) AS derniere_transaction_le,
      (
        array_agg(t.valeur_fonciere ORDER BY t.date_mutation DESC NULLS LAST)
          FILTER (WHERE t.valeur_fonciere IS NOT NULL)
      )[1] AS dernier_prix
    FROM scoped s
    JOIN public.building_transactions t ON t.ban_id = s.ban_id
    GROUP BY s.ban_id
  ),
  tx_median AS (
    SELECT
      s.ban_id,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY t.prix_m2) AS prix_m2_median
    FROM scoped s
    JOIN public.building_transactions t ON t.ban_id = s.ban_id
    WHERE t.prix_m2 IS NOT NULL
      AND t.prix_m2 > 0
    GROUP BY s.ban_id
  ),
  dpe_stats AS (
    SELECT
      d.ban_id,
      count(*)::integer AS nb_dpe_total,
      count(*) FILTER (WHERE d.etiquette_dpe IN ('F', 'G'))::integer AS nb_passoires,
      max(d.date_dpe) AS dernier_dpe_le,
      (
        array_agg(d.etiquette_dpe ORDER BY d.date_dpe DESC)
          FILTER (WHERE d.etiquette_dpe IS NOT NULL)
      )[1] AS etiquette_dpe
    FROM public.building_dpe d
    JOIN scoped s ON s.ban_id = d.ban_id
    WHERE d.date_dpe IS NOT NULL
      AND d.date_dpe <= (CURRENT_DATE - make_interval(months => p_dpe_min_age_months))
    GROUP BY d.ban_id
  ),
  copro_stats AS (
    SELECT DISTINCT ON (c.ban_id)
      c.ban_id,
      c.nombre_lots AS nb_lots,
      COALESCE(c.procedure_en_cours, false) AS procedure_copro
    FROM public.building_copro c
    JOIN scoped s ON s.ban_id = c.ban_id
    ORDER BY c.ban_id, c.date_maj DESC NULLS LAST
  )
  INSERT INTO public.building_activity (
    ban_id,
    code_postal,
    nb_transactions_total,
    nb_transactions_3ans,
    derniere_transaction_le,
    prix_m2_median,
    dernier_prix,
    nb_dpe_total,
    dernier_dpe_le,
    etiquette_dpe,
    nb_passoires,
    nb_lots,
    procedure_copro,
    activite_score,
    calcule_le
  )
  SELECT
    s.ban_id,
    s.code_postal,
    COALESCE(tx.nb_transactions_total, 0),
    COALESCE(tx.nb_transactions_3ans, 0),
    tx.derniere_transaction_le,
    med.prix_m2_median,
    tx.dernier_prix,
    COALESCE(dpe.nb_dpe_total, 0),
    dpe.dernier_dpe_le,
    dpe.etiquette_dpe,
    COALESCE(dpe.nb_passoires, 0),
    copro.nb_lots,
    COALESCE(copro.procedure_copro, false),
    LEAST(100, (
      COALESCE(tx.nb_transactions_3ans, 0) * 12
      + LEAST(COALESCE(tx.nb_transactions_total, 0), 8) * 4
      + LEAST(COALESCE(dpe.nb_dpe_total, 0), 15)
      + CASE WHEN COALESCE(copro.procedure_copro, false) THEN 20 ELSE 0 END
      + LEAST(COALESCE(dpe.nb_passoires, 0), 8) * 2
    ))::integer,
    now()
  FROM scoped s
  LEFT JOIN tx_stats tx ON tx.ban_id = s.ban_id
  LEFT JOIN tx_median med ON med.ban_id = s.ban_id
  LEFT JOIN dpe_stats dpe ON dpe.ban_id = s.ban_id
  LEFT JOIN copro_stats copro ON copro.ban_id = s.ban_id
  ON CONFLICT (ban_id) DO UPDATE SET
    code_postal = EXCLUDED.code_postal,
    nb_transactions_total = EXCLUDED.nb_transactions_total,
    nb_transactions_3ans = EXCLUDED.nb_transactions_3ans,
    derniere_transaction_le = EXCLUDED.derniere_transaction_le,
    prix_m2_median = EXCLUDED.prix_m2_median,
    dernier_prix = EXCLUDED.dernier_prix,
    nb_dpe_total = EXCLUDED.nb_dpe_total,
    dernier_dpe_le = EXCLUDED.dernier_dpe_le,
    etiquette_dpe = EXCLUDED.etiquette_dpe,
    nb_passoires = EXCLUDED.nb_passoires,
    nb_lots = EXCLUDED.nb_lots,
    procedure_copro = EXCLUDED.procedure_copro,
    activite_score = EXCLUDED.activite_score,
    calcule_le = EXCLUDED.calcule_le;

  GET DIAGNOSTICS n = ROW_COUNT;
  ANALYZE public.building_activity;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.refresh_building_activity(text[], integer) IS
  'Recalcule building_activity pour les codes postaux donnés. 2e argument = PUBLIC_DPE_MIN_AGE_MONTHS (TS). DPE sans date exclus. Score 0–100 : 12×ventes 3 ans + 4×min(total,8) + min(dpe,15) + 20 si procédure copro + 2×min(passoires,8).';

REVOKE ALL ON FUNCTION public.refresh_building_activity(text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_building_activity(text[], integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) EXPLAIN (service_role) — plans couche + fiche
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.explain_parcelle_queries(
  p_codes_postaux text[],
  p_parcelle_id text,
  p_south double precision,
  p_north double precision,
  p_west double precision,
  p_east double precision
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  layer jsonb;
  fiche jsonb;
BEGIN
  EXECUTE format(
    $q$
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT ban_id, parcelle_id, adresse, code_postal, commune, lat, lng
      FROM public.buildings
      WHERE code_postal = ANY (%L::text[])
        AND lat >= %s AND lat <= %s
        AND lng >= %s AND lng <= %s
        AND lat IS NOT NULL
        AND lng IS NOT NULL
      LIMIT 2500
    $q$,
    p_codes_postaux,
    p_south,
    p_north,
    p_west,
    p_east
  ) INTO layer;

  EXECUTE format(
    $q$
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT parcelle_id, ban_id, date_mutation, valeur_fonciere,
             surface_reelle_bati, prix_m2, type_local, nombre_pieces
      FROM public.building_transactions
      WHERE parcelle_id = %L
      ORDER BY date_mutation DESC
    $q$,
    p_parcelle_id
  ) INTO fiche;

  RETURN jsonb_build_object('layer', layer, 'fiche', fiche);
END;
$$;

REVOKE ALL ON FUNCTION public.explain_parcelle_queries(text[], text, double precision, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explain_parcelle_queries(text[], text, double precision, double precision, double precision, double precision) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) parcelle_synthese : reliquat 20260829, aucune requête du module lecture
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.parcelle_synthese CASCADE;

-- ---------------------------------------------------------------------------
-- 6) Stats planificateur
-- ---------------------------------------------------------------------------
ANALYZE public.buildings;
ANALYZE public.building_transactions;
ANALYZE public.building_dpe;
ANALYZE public.building_copro;
ANALYZE public.building_activity;
ANALYZE public.parcelle_adresses;
