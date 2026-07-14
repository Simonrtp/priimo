-- Purge du zonage legacy : codes_postaux = seule définition de zone.
-- Renomme zone_latitude/zone_longitude → latitude/longitude (géocodage adresse agence).
--
-- PRÉ-VOL (production) — exécuter manuellement avant apply :
--   SELECT name, address, zone_center_address, codes_postaux,
--          zone_latitude, zone_longitude, zone_type, zone_radius_km
--   FROM public.agencies ORDER BY name;
-- Attendu : Century 21 Quartier Latin → codes_postaux ['75005'],
--           Agence test → codes_postaux ['75020'].

-- 1. Bloquer si address et zone_center_address divergent (toutes deux renseignées).
DO $$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM public.agencies
  WHERE zone_center_address IS NOT NULL
    AND TRIM(zone_center_address) <> ''
    AND address IS NOT NULL
    AND TRIM(address) <> ''
    AND TRIM(zone_center_address) <> TRIM(address);

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION
      'Migration aborted: % row(s) have differing address and zone_center_address. Resolve manually first.',
      mismatch_count;
  END IF;
END $$;

-- 2. Backfill address depuis zone_center_address si address vide.
UPDATE public.agencies
SET address = zone_center_address
WHERE (address IS NULL OR TRIM(address) = '')
  AND zone_center_address IS NOT NULL
  AND TRIM(zone_center_address) <> '';

-- 3. Supprimer contraintes legacy.
ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_zone_radius_positive;
ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_zone_type_check;

-- 4. Supprimer colonnes zone legacy.
ALTER TABLE public.agencies DROP COLUMN IF EXISTS zone_type;
ALTER TABLE public.agencies DROP COLUMN IF EXISTS zone_postal_codes;
ALTER TABLE public.agencies DROP COLUMN IF EXISTS zone_radius_km;
ALTER TABLE public.agencies DROP COLUMN IF EXISTS zone_center_address;

-- 5. Renommer coordonnées agence.
ALTER TABLE public.agencies RENAME COLUMN zone_latitude TO latitude;
ALTER TABLE public.agencies RENAME COLUMN zone_longitude TO longitude;

-- 6. codes_postaux obligatoire (secteur = seule zone).
UPDATE public.agencies SET codes_postaux = '{}' WHERE codes_postaux IS NULL;
ALTER TABLE public.agencies ALTER COLUMN codes_postaux SET DEFAULT '{}';
ALTER TABLE public.agencies ALTER COLUMN codes_postaux SET NOT NULL;

COMMENT ON COLUMN public.agencies.address       IS 'Adresse de l''agence (libellé BAN).';
COMMENT ON COLUMN public.agencies.latitude      IS 'Latitude WGS84 du géocodage BAN de l''adresse agence.';
COMMENT ON COLUMN public.agencies.longitude     IS 'Longitude WGS84 du géocodage BAN de l''adresse agence.';
COMMENT ON COLUMN public.agencies.codes_postaux IS 'Secteur(s) de prospection — codes postaux couverts par l''agence.';

-- 7. Vérification post-migration (informatif — lève une exception si secteurs perdus).
DO $$
DECLARE
  missing_sectors integer;
BEGIN
  SELECT COUNT(*) INTO missing_sectors
  FROM public.agencies
  WHERE codes_postaux = '{}' OR array_length(codes_postaux, 1) IS NULL;

  IF missing_sectors > 0 THEN
    RAISE WARNING
      '% agencie(s) have empty codes_postaux after migration — verify Century 21 (75005) and Agence test (75020).',
      missing_sectors;
  END IF;
END $$;
