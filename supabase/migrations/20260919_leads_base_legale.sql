-- Base légale et provenance des leads.
--
-- `contacts` porte depuis toujours collecte_provenance / collecte_base_legale /
-- collecte_at. `leads` ne porte rien : impossible aujourd'hui de répondre à
-- « à quel titre détenez-vous cette ligne ? » pour les 149 leads en base, alors
-- que ce sont précisément les fiches construites sans que la personne le sache.
--
-- Note sur la dissymétrie assumée : un contact a UNE provenance (l'agent l'a
-- rencontré, ou il a rempli le formulaire). Un lead est assemblé à partir de
-- PLUSIEURS jeux publics à la fois. D'où `collecte_provenance` identique à
-- contacts (le canal) et `collecte_jeux_donnees` en plus (le détail opposable).

-- ---------------------------------------------------------------------------
-- 1) Vocabulaire — les deux tables partagent les mêmes valeurs admises
-- ---------------------------------------------------------------------------
-- Les colonnes de `contacts` existent depuis 20260837 mais sans contrainte :
-- rien n'empêche aujourd'hui d'y écrire n'importe quoi. Trois lignes en base,
-- toutes à NULL : la contrainte peut être posée validée, sans risque.

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_collecte_base_legale_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_collecte_base_legale_check
  CHECK (collecte_base_legale IS NULL OR collecte_base_legale IN (
    'interet_legitime', 'consentement', 'contrat', 'obligation_legale'
  ));

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_collecte_provenance_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_collecte_provenance_check
  CHECK (collecte_provenance IS NULL OR collecte_provenance IN (
    'terrain',              -- note dictée, rencontre, porte-à-porte
    'donnees_publiques',    -- ADEME / DVF / RNC / cadastre
    'formulaire_estimation',
    'portail',              -- SeLoger, Bien'ici, Leboncoin…
    'import',               -- fichier fourni par l'agence
    'reseau'                -- recommandation, apporteur d'affaires
  ));

-- ---------------------------------------------------------------------------
-- 2) Les colonnes sur leads
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS collecte_base_legale text,
  ADD COLUMN IF NOT EXISTS collecte_provenance text,
  ADD COLUMN IF NOT EXISTS collecte_jeux_donnees text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS collecte_at timestamptz;

COMMENT ON COLUMN public.leads.collecte_base_legale IS
  'À quel titre la ligne est détenue. Opposable : c''est la réponse à donner à la personne qui demande.';
COMMENT ON COLUMN public.leads.collecte_provenance IS
  'Canal de collecte, même vocabulaire que contacts.collecte_provenance.';
COMMENT ON COLUMN public.leads.collecte_jeux_donnees IS
  'Jeux de données publics ayant servi à construire la fiche : ademe, dvf, rnc, cadastre, ban, sirene.';
COMMENT ON COLUMN public.leads.collecte_at IS
  'Date de constitution de la fiche. Point de départ du délai d''information de l''article 14 RGPD.';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_collecte_base_legale_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_collecte_base_legale_check
  CHECK (collecte_base_legale IS NULL OR collecte_base_legale IN (
    'interet_legitime', 'consentement', 'contrat', 'obligation_legale'
  ));

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_collecte_provenance_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_collecte_provenance_check
  CHECK (collecte_provenance IS NULL OR collecte_provenance IN (
    'terrain', 'donnees_publiques', 'formulaire_estimation', 'portail', 'import', 'reseau'
  ));

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_collecte_jeux_donnees_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_collecte_jeux_donnees_check
  CHECK (collecte_jeux_donnees <@ ARRAY['ademe','dvf','rnc','cadastre','ban','sirene']::text[]);

-- ---------------------------------------------------------------------------
-- 3) Renseigner l'existant
-- ---------------------------------------------------------------------------
-- 149 leads, répartis sur 5 agences, tous produits par le pipeline de données
-- publiques (aucun n'a d'origine déclarative). `collecte_at` prend delivered_at
-- quand il existe — c'est la date à laquelle la fiche a été constituée pour
-- l'agence — sinon created_at.

UPDATE public.leads
SET
  collecte_base_legale  = 'interet_legitime',
  collecte_provenance   = 'donnees_publiques',
  collecte_jeux_donnees = ARRAY['ademe','dvf','rnc']::text[],
  collecte_at           = COALESCE(delivered_at::timestamptz, created_at)
WHERE collecte_base_legale IS NULL;

-- Les leads dont le téléphone vient d'une recherche nominative ciblée gardent
-- l'intérêt légitime, mais la provenance mérite d'être tracée à part : ce n'est
-- plus un jeu public, c'est un enrichissement.
UPDATE public.leads
SET collecte_jeux_donnees = collecte_jeux_donnees || ARRAY['sirene']::text[]
WHERE owner_phone_source = 'cible'
  AND NOT (collecte_jeux_donnees @> ARRAY['sirene']::text[]);

-- ---------------------------------------------------------------------------
-- 4) À partir d'ici, plus aucun lead sans base légale
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ALTER COLUMN collecte_base_legale SET DEFAULT 'interet_legitime',
  ALTER COLUMN collecte_provenance  SET DEFAULT 'donnees_publiques';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_collecte_base_legale_presente;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_collecte_base_legale_presente
  CHECK (collecte_base_legale IS NOT NULL);

CREATE INDEX IF NOT EXISTS leads_collecte_base_legale_idx
  ON public.leads (agency_id, collecte_base_legale);
