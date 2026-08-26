-- Un schéma parcelle : parcelle_id partout, immeuble (ban_id) distinct.
-- Pas de géométrie. Écriture pipeline par lots (COPY / jsonb_to_recordset), jamais ligne à ligne via PostgREST.
--
-- Tables d'événements : buildings, building_transactions, building_dpe,
-- building_copro, building_activity, parcelle_adresses.
-- Supprime les doublons vides issus de 20260829 (idu).

-- ---------------------------------------------------------------------------
-- 1) Doublons 20260829
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.parcelle_ventes CASCADE;
DROP TABLE IF EXISTS public.parcelle_diagnostics CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parcelle_adresses' AND column_name = 'idu'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parcelle_adresses' AND column_name = 'parcelle_id'
  ) THEN
    ALTER TABLE public.parcelle_adresses RENAME COLUMN idu TO parcelle_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parcelle_adresses' AND column_name = 'idu'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parcelle_adresses' AND column_name = 'parcelle_id'
  ) THEN
    ALTER TABLE public.parcelle_adresses DROP COLUMN idu;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parcelle_synthese' AND column_name = 'idu'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parcelle_synthese' AND column_name = 'parcelle_id'
  ) THEN
    ALTER TABLE public.parcelle_synthese RENAME COLUMN idu TO parcelle_id;
  END IF;
END $$;

DROP INDEX IF EXISTS parcelle_adresses_idu_idx;
DROP INDEX IF EXISTS parcelle_synthese_cp_idx;
DROP INDEX IF EXISTS parcelle_ventes_idu_idx;
DROP INDEX IF EXISTS parcelle_diagnostics_idu_idx;

COMMENT ON COLUMN public.note_liens.entite_id IS
  'Id de l''entité : ban_id si entite_type = immeuble, parcelle_id PCI (14 car.) si entite_type = parcelle.';

-- ---------------------------------------------------------------------------
-- 2) code_postal sur chaque table d'événements (filtrage agence, jamais un préfixe INSEE)
-- ---------------------------------------------------------------------------
ALTER TABLE public.parcelle_adresses
  ADD COLUMN IF NOT EXISTS code_postal text;

ALTER TABLE public.building_transactions
  ADD COLUMN IF NOT EXISTS code_postal text;

ALTER TABLE public.building_dpe
  ADD COLUMN IF NOT EXISTS code_postal text;

ALTER TABLE public.building_copro
  ADD COLUMN IF NOT EXISTS code_postal text;

ALTER TABLE public.building_activity
  ADD COLUMN IF NOT EXISTS code_postal text;

-- Agrégat carte : une lettre DPE publique par immeuble, un prix de dernière mutation.
-- Doit rester aligné sur PUBLIC_DPE_MIN_AGE_MONTHS (12) dans lib/carte/dpe-public.ts.
ALTER TABLE public.building_activity
  ADD COLUMN IF NOT EXISTS etiquette_dpe text;

ALTER TABLE public.building_activity
  ADD COLUMN IF NOT EXISTS dernier_prix numeric;

UPDATE public.parcelle_adresses a
SET code_postal = b.code_postal
FROM public.buildings b
WHERE a.ban_id = b.ban_id
  AND a.code_postal IS NULL
  AND b.code_postal IS NOT NULL;

UPDATE public.building_transactions t
SET code_postal = b.code_postal
FROM public.buildings b
WHERE t.ban_id = b.ban_id
  AND t.code_postal IS NULL
  AND b.code_postal IS NOT NULL;

UPDATE public.building_dpe d
SET code_postal = b.code_postal
FROM public.buildings b
WHERE d.ban_id = b.ban_id
  AND d.code_postal IS NULL
  AND b.code_postal IS NOT NULL;

UPDATE public.building_copro c
SET code_postal = b.code_postal
FROM public.buildings b
WHERE c.ban_id = b.ban_id
  AND c.code_postal IS NULL
  AND b.code_postal IS NOT NULL;

UPDATE public.building_activity a
SET code_postal = b.code_postal
FROM public.buildings b
WHERE a.ban_id = b.ban_id
  AND a.code_postal IS NULL
  AND b.code_postal IS NOT NULL;

UPDATE public.building_activity a
SET etiquette_dpe = sub.etiquette
FROM (
  SELECT DISTINCT ON (ban_id)
    ban_id,
    etiquette_dpe AS etiquette
  FROM public.building_dpe
  WHERE date_dpe IS NOT NULL
    AND date_dpe <= (CURRENT_DATE - INTERVAL '12 months')
    AND etiquette_dpe IS NOT NULL
  ORDER BY ban_id, date_dpe DESC
) sub
WHERE a.ban_id = sub.ban_id
  AND a.etiquette_dpe IS NULL;

UPDATE public.building_activity a
SET nb_dpe_total = sub.n,
    nb_passoires = sub.passoires
FROM (
  SELECT
    ban_id,
    count(*)::integer AS n,
    count(*) FILTER (WHERE etiquette_dpe IN ('F', 'G'))::integer AS passoires
  FROM public.building_dpe
  WHERE date_dpe IS NULL
     OR date_dpe <= (CURRENT_DATE - INTERVAL '12 months')
  GROUP BY ban_id
) sub
WHERE a.ban_id = sub.ban_id;

UPDATE public.building_activity a
SET nb_lots = c.nombre_lots,
    procedure_copro = COALESCE(c.procedure_en_cours, false)
FROM public.building_copro c
WHERE a.ban_id = c.ban_id
  AND a.nb_lots IS NULL;

UPDATE public.building_activity a
SET dernier_prix = sub.prix
FROM (
  SELECT DISTINCT ON (ban_id)
    ban_id,
    valeur_fonciere AS prix
  FROM public.building_transactions
  WHERE date_mutation IS NOT NULL
  ORDER BY ban_id, date_mutation DESC
) sub
WHERE a.ban_id = sub.ban_id
  AND a.dernier_prix IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Contraintes d'identifiant + unicité (lots pipeline)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS buildings_ban_id_idx
  ON public.buildings (ban_id);

CREATE UNIQUE INDEX IF NOT EXISTS parcelle_adresses_parcelle_ban_uidx
  ON public.parcelle_adresses (parcelle_id, ban_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'buildings_parcelle_id_fmt'
  ) THEN
    ALTER TABLE public.buildings
      ADD CONSTRAINT buildings_parcelle_id_fmt
      CHECK (parcelle_id IS NULL OR parcelle_id ~ '^[0-9A-Z]{14}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parcelle_adresses_parcelle_id_fmt'
  ) THEN
    ALTER TABLE public.parcelle_adresses
      ADD CONSTRAINT parcelle_adresses_parcelle_id_fmt
      CHECK (parcelle_id ~ '^[0-9A-Z]{14}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'building_transactions_parcelle_id_fmt'
  ) THEN
    ALTER TABLE public.building_transactions
      ADD CONSTRAINT building_transactions_parcelle_id_fmt
      CHECK (parcelle_id IS NULL OR parcelle_id ~ '^[0-9A-Z]{14}$');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Index lecture : parcelle_id, ban_id, code_postal + emprise carte
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS buildings_parcelle_id_idx
  ON public.buildings (parcelle_id)
  WHERE parcelle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS buildings_code_postal_idx
  ON public.buildings (code_postal);

CREATE INDEX IF NOT EXISTS buildings_map_bbox_idx
  ON public.buildings (code_postal, lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS building_transactions_parcelle_id_idx
  ON public.building_transactions (parcelle_id, date_mutation DESC);

CREATE INDEX IF NOT EXISTS building_transactions_ban_id_idx
  ON public.building_transactions (ban_id);

CREATE INDEX IF NOT EXISTS building_transactions_code_postal_idx
  ON public.building_transactions (code_postal);

CREATE INDEX IF NOT EXISTS building_dpe_ban_id_idx
  ON public.building_dpe (ban_id, date_dpe DESC);

CREATE INDEX IF NOT EXISTS building_dpe_code_postal_idx
  ON public.building_dpe (code_postal);

CREATE INDEX IF NOT EXISTS building_copro_ban_id_idx
  ON public.building_copro (ban_id);

CREATE INDEX IF NOT EXISTS building_copro_code_postal_idx
  ON public.building_copro (code_postal);

CREATE INDEX IF NOT EXISTS building_activity_code_postal_idx
  ON public.building_activity (code_postal);

CREATE INDEX IF NOT EXISTS parcelle_adresses_parcelle_id_idx
  ON public.parcelle_adresses (parcelle_id);

CREATE INDEX IF NOT EXISTS parcelle_adresses_ban_id_idx
  ON public.parcelle_adresses (ban_id);

CREATE INDEX IF NOT EXISTS parcelle_adresses_code_postal_idx
  ON public.parcelle_adresses (code_postal);

-- ---------------------------------------------------------------------------
-- 5) Vue carte : agrégat immeuble uniquement (jamais les tables de détail)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.building_map_points AS
SELECT
  b.ban_id,
  b.parcelle_id,
  b.adresse,
  b.code_postal,
  b.lat,
  b.lng,
  a.nb_transactions_total,
  a.derniere_transaction_le,
  a.prix_m2_median,
  a.dernier_prix,
  a.nb_dpe_total,
  a.dernier_dpe_le,
  a.etiquette_dpe,
  a.nb_passoires,
  a.nb_lots,
  a.procedure_copro
FROM public.buildings b
JOIN public.building_activity a ON a.ban_id = b.ban_id
WHERE b.lat IS NOT NULL
  AND b.lng IS NOT NULL;

COMMENT ON VIEW public.building_map_points IS
  'Couche carte : un point par immeuble. Interdit d''y joindre building_dpe / building_transactions / building_copro.';

-- ---------------------------------------------------------------------------
-- 6) RLS lecture publique (donnée qui n'appartient à personne)
-- ---------------------------------------------------------------------------
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_dpe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_copro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelle_adresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS buildings_select ON public.buildings;
CREATE POLICY buildings_select ON public.buildings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS building_transactions_select ON public.building_transactions;
CREATE POLICY building_transactions_select ON public.building_transactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS building_dpe_select ON public.building_dpe;
CREATE POLICY building_dpe_select ON public.building_dpe
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS building_copro_select ON public.building_copro;
CREATE POLICY building_copro_select ON public.building_copro
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS building_activity_select ON public.building_activity;
CREATE POLICY building_activity_select ON public.building_activity
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS parcelle_adresses_select ON public.parcelle_adresses;
CREATE POLICY parcelle_adresses_select ON public.parcelle_adresses
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.buildings TO authenticated;
GRANT SELECT ON public.building_transactions TO authenticated;
GRANT SELECT ON public.building_dpe TO authenticated;
GRANT SELECT ON public.building_copro TO authenticated;
GRANT SELECT ON public.building_activity TO authenticated;
GRANT SELECT ON public.parcelle_adresses TO authenticated;
GRANT SELECT ON public.building_map_points TO authenticated;

COMMENT ON TABLE public.buildings IS
  'Immeuble BAN. Écriture pipeline par lots (INSERT ... SELECT / jsonb_to_recordset). Pas de géométrie cadastrale. ban_id n''est pas unique aujourd''hui : dédupliquer avant un ON CONFLICT.';
COMMENT ON TABLE public.building_transactions IS
  'Mutations DVF. Clé native parcelle_id. INSERT par lots, pas PostgREST unitaire.';
COMMENT ON TABLE public.building_dpe IS
  'Diagnostics ADEME. Clé native ban_id. INSERT par lots.';
COMMENT ON TABLE public.building_copro IS
  'Registre national des copropriétés. Clé native ban_id. INSERT par lots.';
COMMENT ON TABLE public.parcelle_adresses IS
  'Pont N-N parcelle_id ↔ ban_id. Une parcelle peut porter plusieurs immeubles.';
