-- Champs d'annonce sur un bien.
--
-- Ils préparent un export normalisé (XML / CSV). Aucune passerelle n'est
-- branchée : ces colonnes ne déclenchent aucun envoi.

ALTER TABLE public.biens
  ADD COLUMN IF NOT EXISTS listing_title text NULL,
  ADD COLUMN IF NOT EXISTS listing_description text NULL,
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dpe_lettre text NULL
    CHECK (dpe_lettre IS NULL OR dpe_lettre IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  ADD COLUMN IF NOT EXISTS dpe_kwh integer NULL
    CHECK (dpe_kwh IS NULL OR (dpe_kwh >= 0 AND dpe_kwh <= 9999)),
  ADD COLUMN IF NOT EXISTS ges_lettre text NULL
    CHECK (ges_lettre IS NULL OR ges_lettre IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  ADD COLUMN IF NOT EXISTS ges_kg_co2 integer NULL
    CHECK (ges_kg_co2 IS NULL OR (ges_kg_co2 >= 0 AND ges_kg_co2 <= 9999)),
  ADD COLUMN IF NOT EXISTS dpe_vierge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dpe_date date NULL,
  ADD COLUMN IF NOT EXISTS honoraires_montant integer NULL
    CHECK (honoraires_montant IS NULL OR honoraires_montant >= 0),
  ADD COLUMN IF NOT EXISTS honoraires_a_charge text NULL
    CHECK (honoraires_a_charge IS NULL OR honoraires_a_charge IN ('vendeur', 'acquereur', 'partage')),
  ADD COLUMN IF NOT EXISTS honoraires_pourcent numeric(5, 2) NULL
    CHECK (honoraires_pourcent IS NULL OR (honoraires_pourcent >= 0 AND honoraires_pourcent <= 100)),
  ADD COLUMN IF NOT EXISTS mandat_numero text NULL,
  ADD COLUMN IF NOT EXISTS mandat_date date NULL;

COMMENT ON COLUMN public.biens.listing_title IS 'Titre public de l''annonce, distinct de l''adresse interne.';
COMMENT ON COLUMN public.biens.photos IS 'URLs des photos destinées à un export. Aucun hébergement Priimo à ce stade.';
COMMENT ON COLUMN public.biens.dpe_vierge IS 'Exception légale : DPE vierge. Depuis 2021, la plupart des ventes exigent un DPE complet.';
COMMENT ON COLUMN public.biens.honoraires_a_charge IS 'Qui paie les honoraires (arrêté du 10 janvier 2017 / loi Hoguet).';
