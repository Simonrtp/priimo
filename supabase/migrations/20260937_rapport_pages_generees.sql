-- Pages de données de l'avis de valeur : 13 kinds générés, tables publiques
-- (secteur, POI, connectivité, permis, indices), paramètres d'agence,
-- exclusions agent, insertion dans les modèles existants.
-- Aucune géométrie. Pivots : ban_id, parcelle_id. Filtrage : code_postal.

-- ---------------------------------------------------------------------------
-- 1) Titre de couverture et appel à l'action (agence)
-- ---------------------------------------------------------------------------
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS rapport_titre_couverture text;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS rapport_cta_prochaine_etape text;

COMMENT ON COLUMN public.agencies.rapport_titre_couverture IS
  'Titre affiché sur la couverture de l''avis de valeur. NULL = « Avis de valeur ».';

COMMENT ON COLUMN public.agencies.rapport_cta_prochaine_etape IS
  'Texte d''appel à l''action de la page Prochaine étape. NULL = texte par défaut (signature du mandat).';

-- ---------------------------------------------------------------------------
-- 2) Exclusions agent (ventes DVF et annonces) pour le rapport
-- ---------------------------------------------------------------------------
ALTER TABLE public.agency_estimations
  ADD COLUMN IF NOT EXISTS rapport_exclus jsonb NOT NULL DEFAULT '{"comparables":[],"annonces":[]}'::jsonb;

COMMENT ON COLUMN public.agency_estimations.rapport_exclus IS
  'Ventes et annonces retirées du rapport par l''agent. Clés : comparables (id_mutation), annonces (id). L''agent rétablit en ôtant la clé.';

-- ---------------------------------------------------------------------------
-- 3) Kinds générés : 13 pages de données
-- ---------------------------------------------------------------------------
ALTER TABLE public.agency_rapport_modele
  DROP CONSTRAINT IF EXISTS agency_rapport_modele_slot_check;

ALTER TABLE public.agency_rapport_modele
  ADD CONSTRAINT agency_rapport_modele_slot_check CHECK (
    (source = 'bibliotheque' AND bibliotheque_id IS NOT NULL AND kind_generee IS NULL)
    OR (
      source = 'generee'
      AND bibliotheque_id IS NULL
      AND kind_generee IN (
        'couverture',
        'votre_bien',
        'description',
        'immeuble_appartement',
        'secteur',
        'points_interet',
        'connectivite',
        'permis',
        'comparables',
        'concurrentiel',
        'indices',
        'prix',
        'prochaine_etape'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Tables publiques — pages 6 à 11 (remplies par le moteur)
-- ---------------------------------------------------------------------------

-- 4.a) Annonces de marché (étude concurrentielle)
CREATE TABLE IF NOT EXISTS public.annonces_marche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_id text NOT NULL,
  ban_id text,
  parcelle_id text,
  code_postal text NOT NULL,
  type_local text,
  surface_m2 numeric,
  pieces integer,
  prix numeric,
  prix_m2 numeric,
  prix_initial numeric,
  date_releve date NOT NULL,
  date_premiere_vue date,
  date_derniere_vue date,
  statut text NOT NULL DEFAULT 'active',
  collected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT annonces_marche_source_uniq UNIQUE (source, source_id),
  CONSTRAINT annonces_marche_statut_check CHECK (statut IN ('active', 'vendue', 'retiree'))
);

COMMENT ON TABLE public.annonces_marche IS
  'Annonces de vente relevées par le moteur (portails). Aucun appel portail depuis le serveur de l''avis. Filtrer par code_postal. Pas de photo, pas de géométrie.';
COMMENT ON COLUMN public.annonces_marche.id IS
  'Identifiant interne. C''est la clé que l''agent exclut dans rapport_exclus.annonces.';
COMMENT ON COLUMN public.annonces_marche.source IS
  'Portail d''origine (ex. leboncoin, seloger). Jamais une URL d''annonce.';
COMMENT ON COLUMN public.annonces_marche.source_id IS
  'Identifiant stable côté portail, pour dédoublonner les relevés.';
COMMENT ON COLUMN public.annonces_marche.ban_id IS
  'Pivot BAN de l''annonce si le moteur l''a rapprochée. NULL sinon.';
COMMENT ON COLUMN public.annonces_marche.parcelle_id IS
  'Pivot parcelle si le moteur l''a rapprochée. NULL sinon.';
COMMENT ON COLUMN public.annonces_marche.code_postal IS
  'Code postal de l''annonce. Filtre de zone obligatoire.';
COMMENT ON COLUMN public.annonces_marche.type_local IS
  'Type de bien tel que relevé (appartement, maison). NULL si le portail ne le donne pas.';
COMMENT ON COLUMN public.annonces_marche.surface_m2 IS
  'Surface publiée, en m². NULL si absente — ne pas inventer.';
COMMENT ON COLUMN public.annonces_marche.pieces IS
  'Nombre de pièces publié. NULL si absent.';
COMMENT ON COLUMN public.annonces_marche.prix IS
  'Prix affiché au dernier relevé, en euros.';
COMMENT ON COLUMN public.annonces_marche.prix_m2 IS
  'Prix au m² si surface et prix sont tous deux connus. NULL sinon — ne pas recalculer à la volée si l''un manque.';
COMMENT ON COLUMN public.annonces_marche.prix_initial IS
  'Premier prix relevé. Renseigné seulement si le moteur a un historique. Sert à la négociation.';
COMMENT ON COLUMN public.annonces_marche.date_releve IS
  'Date du dernier passage du moteur sur cette annonce.';
COMMENT ON COLUMN public.annonces_marche.date_premiere_vue IS
  'Première fois où le moteur a vu l''annonce. NULL = pas d''historique, pas de graphique de délai.';
COMMENT ON COLUMN public.annonces_marche.date_derniere_vue IS
  'Dernière fois où l''annonce était encore en ligne. NULL si encore active.';
COMMENT ON COLUMN public.annonces_marche.statut IS
  'active = encore en ligne ; vendue / retiree = sortie constatée par l''historique.';
COMMENT ON COLUMN public.annonces_marche.collected_at IS
  'Horodatage d''écriture en base.';

CREATE INDEX IF NOT EXISTS annonces_marche_cp_statut_idx
  ON public.annonces_marche (code_postal, statut, date_releve DESC);
CREATE INDEX IF NOT EXISTS annonces_marche_ban_idx
  ON public.annonces_marche (ban_id)
  WHERE ban_id IS NOT NULL;

-- 4.b) Lien adresse → IRIS (secteur)
CREATE TABLE IF NOT EXISTS public.iris_adresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_id text,
  parcelle_id text,
  code_postal text NOT NULL,
  iris_code text NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.iris_adresses IS
  'Rattachement d''une adresse (ban_id / parcelle_id) à un IRIS. Aucune géométrie. Une ligne par pivot connu.';
COMMENT ON COLUMN public.iris_adresses.id IS
  'Identifiant interne.';
COMMENT ON COLUMN public.iris_adresses.ban_id IS
  'Pivot BAN. Recherche prioritaire pour le bien estimé.';
COMMENT ON COLUMN public.iris_adresses.parcelle_id IS
  'Pivot parcelle. Repli si ban_id absent.';
COMMENT ON COLUMN public.iris_adresses.code_postal IS
  'Code postal de l''adresse rattachée. Filtre de zone.';
COMMENT ON COLUMN public.iris_adresses.iris_code IS
  'Code IRIS Insee (9 caractères). Jointure vers iris_logement.';
COMMENT ON COLUMN public.iris_adresses.collected_at IS
  'Horodatage d''écriture en base.';

CREATE INDEX IF NOT EXISTS iris_adresses_ban_idx
  ON public.iris_adresses (ban_id)
  WHERE ban_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS iris_adresses_parcelle_idx
  ON public.iris_adresses (parcelle_id)
  WHERE parcelle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS iris_adresses_cp_idx
  ON public.iris_adresses (code_postal);

-- 4.c) Indicateurs logement IRIS (secteur)
CREATE TABLE IF NOT EXISTS public.iris_logement (
  iris_code text PRIMARY KEY,
  code_postal text NOT NULL,
  commune text,
  part_appartements numeric,
  pieces_dominant integer,
  epoque_construction_dominante text,
  part_proprietaires numeric,
  part_locataires numeric,
  collected_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.iris_logement IS
  'Indicateurs logement Insee de l''IRIS. Une ligne par IRIS. Parts en pourcentage 0–100. Vide = page Secteur non générée.';
COMMENT ON COLUMN public.iris_logement.iris_code IS
  'Code IRIS Insee (clé).';
COMMENT ON COLUMN public.iris_logement.code_postal IS
  'Code postal principal de l''IRIS. Filtre de zone.';
COMMENT ON COLUMN public.iris_logement.commune IS
  'Nom de commune Insee. NULL si non fourni.';
COMMENT ON COLUMN public.iris_logement.part_appartements IS
  'Part des logements qui sont des appartements, en %. NULL si non publié.';
COMMENT ON COLUMN public.iris_logement.pieces_dominant IS
  'Nombre de pièces le plus fréquent dans l''IRIS. NULL si non publié.';
COMMENT ON COLUMN public.iris_logement.epoque_construction_dominante IS
  'Époque de construction dominante (libellé Insee, ex. « 1946–1970 »). NULL si non publiée. Ne jamais inventer une année.';
COMMENT ON COLUMN public.iris_logement.part_proprietaires IS
  'Part de propriétaires occupants, en %. NULL si non publiée.';
COMMENT ON COLUMN public.iris_logement.part_locataires IS
  'Part de locataires, en %. NULL si non publiée.';
COMMENT ON COLUMN public.iris_logement.collected_at IS
  'Horodatage d''écriture en base.';

CREATE INDEX IF NOT EXISTS iris_logement_cp_idx
  ON public.iris_logement (code_postal);

-- 4.d) Équipements proches (points d'intérêt)
CREATE TABLE IF NOT EXISTS public.equipements_proximite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_id text,
  parcelle_id text,
  code_postal text NOT NULL,
  categorie text NOT NULL,
  nom text NOT NULL,
  distance_m integer NOT NULL,
  latitude double precision,
  longitude double precision,
  collected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipements_proximite_categorie_check CHECK (
    categorie IN ('administration', 'enseignement', 'transports', 'sante')
  )
);

COMMENT ON TABLE public.equipements_proximite IS
  'Équipements proches d''une adresse, calculés par le moteur (BPE / transports). Distance précalculée. Pas de géométrie stockée : latitude/longitude WGS84 facultatives pour la carte.';
COMMENT ON COLUMN public.equipements_proximite.id IS
  'Identifiant interne.';
COMMENT ON COLUMN public.equipements_proximite.ban_id IS
  'Pivot BAN du bien de référence (celui de l''estimation).';
COMMENT ON COLUMN public.equipements_proximite.parcelle_id IS
  'Pivot parcelle du bien de référence.';
COMMENT ON COLUMN public.equipements_proximite.code_postal IS
  'Code postal du bien de référence. Filtre de zone.';
COMMENT ON COLUMN public.equipements_proximite.categorie IS
  'Famille affichée : administration, enseignement, transports, sante.';
COMMENT ON COLUMN public.equipements_proximite.nom IS
  'Nom officiel de l''équipement. Tel que publié, sans reformulation.';
COMMENT ON COLUMN public.equipements_proximite.distance_m IS
  'Distance à vol d''oiseau en mètres, calculée par le moteur.';
COMMENT ON COLUMN public.equipements_proximite.latitude IS
  'Latitude WGS84 de l''équipement, pour superposer un point sur la carte IGN. NULL = liste seule, pas de pastille.';
COMMENT ON COLUMN public.equipements_proximite.longitude IS
  'Longitude WGS84 de l''équipement. NULL = pas de pastille.';
COMMENT ON COLUMN public.equipements_proximite.collected_at IS
  'Horodatage d''écriture en base.';

CREATE INDEX IF NOT EXISTS equipements_proximite_ban_idx
  ON public.equipements_proximite (ban_id, categorie, distance_m)
  WHERE ban_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS equipements_proximite_parcelle_idx
  ON public.equipements_proximite (parcelle_id, categorie, distance_m)
  WHERE parcelle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS equipements_proximite_cp_idx
  ON public.equipements_proximite (code_postal, categorie, distance_m);

-- 4.e) Internet fixe
CREATE TABLE IF NOT EXISTS public.connectivite_fixe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_id text,
  parcelle_id text,
  code_postal text NOT NULL,
  technologie text NOT NULL,
  operateur text NOT NULL,
  eligible boolean NOT NULL,
  debit_max_mbps integer,
  collected_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.connectivite_fixe IS
  'Éligibilité internet fixe par technologie et opérateur (ARCEP / IMB). Une ligne = un couple technologie × opérateur pour une adresse.';
COMMENT ON COLUMN public.connectivite_fixe.id IS
  'Identifiant interne.';
COMMENT ON COLUMN public.connectivite_fixe.ban_id IS
  'Pivot BAN de l''adresse éligible.';
COMMENT ON COLUMN public.connectivite_fixe.parcelle_id IS
  'Pivot parcelle de l''adresse éligible.';
COMMENT ON COLUMN public.connectivite_fixe.code_postal IS
  'Code postal. Filtre de zone.';
COMMENT ON COLUMN public.connectivite_fixe.technologie IS
  'Technologie (ftth, fttb, vdsl, adsl, cable). Libellé technique du moteur, pas un slogan.';
COMMENT ON COLUMN public.connectivite_fixe.operateur IS
  'Nom de l''opérateur tel que publié (Orange, Free, SFR, Bouygues…).';
COMMENT ON COLUMN public.connectivite_fixe.eligible IS
  'true = éligible à cette technologie chez cet opérateur. false = explicitement inéligible. Ne pas omettre la ligne pour dire non.';
COMMENT ON COLUMN public.connectivite_fixe.debit_max_mbps IS
  'Débit descendant maximal annoncé, en Mbit/s. NULL si non publié.';
COMMENT ON COLUMN public.connectivite_fixe.collected_at IS
  'Horodatage d''écriture en base.';

CREATE INDEX IF NOT EXISTS connectivite_fixe_ban_idx
  ON public.connectivite_fixe (ban_id)
  WHERE ban_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS connectivite_fixe_parcelle_idx
  ON public.connectivite_fixe (parcelle_id)
  WHERE parcelle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS connectivite_fixe_cp_idx
  ON public.connectivite_fixe (code_postal);

-- 4.f) Couverture mobile
CREATE TABLE IF NOT EXISTS public.connectivite_mobile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_id text,
  parcelle_id text,
  code_postal text NOT NULL,
  operateur text NOT NULL,
  generation text NOT NULL,
  niveau text NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connectivite_mobile_generation_check CHECK (
    generation IN ('2g', '3g', '4g', '5g')
  ),
  CONSTRAINT connectivite_mobile_niveau_check CHECK (
    niveau IN ('tres_bonne', 'bonne', 'moyenne', 'limitee', 'nulle')
  )
);

COMMENT ON TABLE public.connectivite_mobile IS
  'Couverture mobile par opérateur et génération (ARCEP). Une ligne = un couple opérateur × génération pour une adresse.';
COMMENT ON COLUMN public.connectivite_mobile.id IS
  'Identifiant interne.';
COMMENT ON COLUMN public.connectivite_mobile.ban_id IS
  'Pivot BAN de l''adresse.';
COMMENT ON COLUMN public.connectivite_mobile.parcelle_id IS
  'Pivot parcelle de l''adresse.';
COMMENT ON COLUMN public.connectivite_mobile.code_postal IS
  'Code postal. Filtre de zone.';
COMMENT ON COLUMN public.connectivite_mobile.operateur IS
  'Opérateur mobile (Orange, Free, SFR, Bouygues…).';
COMMENT ON COLUMN public.connectivite_mobile.generation IS
  'Génération réseau : 2g, 3g, 4g, 5g.';
COMMENT ON COLUMN public.connectivite_mobile.niveau IS
  'Qualité de couverture publiée : tres_bonne, bonne, moyenne, limitee, nulle.';
COMMENT ON COLUMN public.connectivite_mobile.collected_at IS
  'Horodatage d''écriture en base.';

CREATE INDEX IF NOT EXISTS connectivite_mobile_ban_idx
  ON public.connectivite_mobile (ban_id)
  WHERE ban_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS connectivite_mobile_parcelle_idx
  ON public.connectivite_mobile (parcelle_id)
  WHERE parcelle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS connectivite_mobile_cp_idx
  ON public.connectivite_mobile (code_postal);

-- 4.g) Autorisations d'urbanisme
CREATE TABLE IF NOT EXISTS public.permis_urbanisme (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_postal text NOT NULL,
  commune text,
  numero text NOT NULL,
  type_autorisation text,
  date_decision date,
  adresse text,
  distance_m integer,
  latitude double precision,
  longitude double precision,
  collected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permis_urbanisme_numero_cp_uniq UNIQUE (numero, code_postal)
);

COMMENT ON TABLE public.permis_urbanisme IS
  'Autorisations d''urbanisme (Sitadel / autorisations d''urbanisme ouvertes). Filtrer par code_postal. Distance et coordonnées calculées par le moteur. Pas de géométrie.';
COMMENT ON COLUMN public.permis_urbanisme.id IS
  'Identifiant interne.';
COMMENT ON COLUMN public.permis_urbanisme.code_postal IS
  'Code postal du projet. Filtre de zone.';
COMMENT ON COLUMN public.permis_urbanisme.commune IS
  'Commune de la décision. NULL si non publiée.';
COMMENT ON COLUMN public.permis_urbanisme.numero IS
  'Numéro officiel de l''autorisation (ex. PC 075 056 24 0001).';
COMMENT ON COLUMN public.permis_urbanisme.type_autorisation IS
  'Type publié (permis de construire, déclaration préalable, permis d''aménager…). NULL si non publié.';
COMMENT ON COLUMN public.permis_urbanisme.date_decision IS
  'Date de la décision. NULL si seule la date de dépôt est connue — ne pas substituer.';
COMMENT ON COLUMN public.permis_urbanisme.adresse IS
  'Adresse du projet telle que publiée. NULL si absente.';
COMMENT ON COLUMN public.permis_urbanisme.distance_m IS
  'Distance au bien estimé, en mètres, si le moteur a pu la calculer. NULL sinon : la carte numérotée omet ce permis.';
COMMENT ON COLUMN public.permis_urbanisme.latitude IS
  'Latitude WGS84 du projet, pour la carte numérotée. NULL = pas de pastille.';
COMMENT ON COLUMN public.permis_urbanisme.longitude IS
  'Longitude WGS84 du projet. NULL = pas de pastille.';
COMMENT ON COLUMN public.permis_urbanisme.collected_at IS
  'Horodatage d''écriture en base.';

CREATE INDEX IF NOT EXISTS permis_urbanisme_cp_date_idx
  ON public.permis_urbanisme (code_postal, date_decision DESC NULLS LAST);

-- 4.h) Taux OAT
CREATE TABLE IF NOT EXISTS public.taux_oat (
  date date PRIMARY KEY,
  taux numeric NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.taux_oat IS
  'Taux de l''OAT de référence (10 ans), une valeur par date de publication. Série utilisée par la page Indices du marché.';
COMMENT ON COLUMN public.taux_oat.date IS
  'Date de la cotation (jour ouvré).';
COMMENT ON COLUMN public.taux_oat.taux IS
  'Taux en pourcentage (ex. 3.12). Tel que publié, sans interpolation.';
COMMENT ON COLUMN public.taux_oat.collected_at IS
  'Horodatage d''écriture en base.';

-- 4.i) Effort d'achat
CREATE TABLE IF NOT EXISTS public.effort_achat (
  code_postal text PRIMARY KEY,
  commune text,
  code_departement text,
  annees_revenu_median_secteur numeric,
  annees_revenu_median_departement numeric,
  annees_revenu_median_france numeric,
  collected_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.effort_achat IS
  'Nombre d''années de revenu médian pour acheter un bien médian. Trois échelles : secteur (code postal), département, France. Calculé par le moteur.';
COMMENT ON COLUMN public.effort_achat.code_postal IS
  'Code postal du secteur. Clé et filtre.';
COMMENT ON COLUMN public.effort_achat.commune IS
  'Libellé de commune associé au code postal. NULL si non fourni.';
COMMENT ON COLUMN public.effort_achat.code_departement IS
  'Code département (2 ou 3 caractères). Sert à tracer la comparaison départementale.';
COMMENT ON COLUMN public.effort_achat.annees_revenu_median_secteur IS
  'Années de revenu médian local pour le bien médian local. NULL si l''un des deux médianes manque.';
COMMENT ON COLUMN public.effort_achat.annees_revenu_median_departement IS
  'Même indicateur à l''échelle du département. NULL si non calculable.';
COMMENT ON COLUMN public.effort_achat.annees_revenu_median_france IS
  'Même indicateur à l''échelle nationale. NULL si non calculable.';
COMMENT ON COLUMN public.effort_achat.collected_at IS
  'Horodatage d''écriture en base.';

-- ---------------------------------------------------------------------------
-- 5) Lecture authentifiée, écriture moteur (service_role)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'annonces_marche',
    'iris_adresses',
    'iris_logement',
    'equipements_proximite',
    'connectivite_fixe',
    'connectivite_mobile',
    'permis_urbanisme',
    'taux_oat',
    'effort_achat'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (true)',
      t,
      t
    );
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6) Modèles existants : pages générées autour des pages de bibliothèque
--    Ordre : couverture … notre estimation, bibliothèque, prochaine étape.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  ag uuid;
  biblio uuid[];
  pos integer;
  k text;
  bid uuid;
  kinds text[] := ARRAY[
    'couverture',
    'votre_bien',
    'description',
    'immeuble_appartement',
    'secteur',
    'points_interet',
    'connectivite',
    'permis',
    'comparables',
    'concurrentiel',
    'indices',
    'prix'
  ];
BEGIN
  FOR ag IN SELECT id FROM public.agencies
  LOOP
    SELECT coalesce(array_agg(bibliotheque_id ORDER BY position, created_at), ARRAY[]::uuid[])
      INTO biblio
    FROM public.agency_rapport_modele
    WHERE agency_id = ag
      AND source = 'bibliotheque'
      AND bibliotheque_id IS NOT NULL;

    DELETE FROM public.agency_rapport_modele WHERE agency_id = ag;

    pos := 0;
    FOREACH k IN ARRAY kinds
    LOOP
      INSERT INTO public.agency_rapport_modele (agency_id, position, source, kind_generee)
      VALUES (ag, pos, 'generee', k);
      pos := pos + 1;
    END LOOP;

    IF biblio IS NOT NULL THEN
      FOREACH bid IN ARRAY biblio
      LOOP
        INSERT INTO public.agency_rapport_modele (agency_id, position, source, bibliotheque_id)
        VALUES (ag, pos, 'bibliotheque', bid);
        pos := pos + 1;
      END LOOP;
    END IF;

    INSERT INTO public.agency_rapport_modele (agency_id, position, source, kind_generee)
    VALUES (ag, pos, 'generee', 'prochaine_etape');
  END LOOP;
END $$;
