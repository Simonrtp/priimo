-- Jours de tournée multiples.
--
-- Un secteur ne tient pas forcément en une journée : un négociateur peut
-- passer le lundi et le jeudi sur le même quartier, et le découpage n'a
-- aucune raison de l'en empêcher. La colonne unique le lui interdisait.
--
-- Le tableau vide remplace le NULL : « aucun jour » et « pas de calendrier »
-- sont la même chose côté produit, et deux façons de dire la même chose dans
-- une colonne finissent toujours par diverger.

BEGIN;

ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS jours_semaine smallint[] NOT NULL DEFAULT '{}'::smallint[];

-- Reprise de l'existant : un jour devient un tableau d'un jour.
UPDATE public.zones
   SET jours_semaine = ARRAY[jour_semaine]::smallint[]
 WHERE jour_semaine IS NOT NULL
   AND cardinality(jours_semaine) = 0;

-- Lundi à vendredi. Le samedi n'est pas un jour de tournée chez Priimo, et
-- l'écrire ici évite d'avoir à s'en souvenir partout ailleurs.
ALTER TABLE public.zones
  DROP CONSTRAINT IF EXISTS zones_jours_semaine_check;
ALTER TABLE public.zones
  ADD CONSTRAINT zones_jours_semaine_check
  CHECK (jours_semaine <@ ARRAY[1, 2, 3, 4, 5]::smallint[]);

COMMENT ON COLUMN public.zones.jours_semaine IS
  'Jours travaillés sur la zone, 1 = lundi. Tableau vide = pas de calendrier de tournée. Sans doublon : l''API dédoublonne avant écriture.';

-- L'unicité titulaire/jour ne peut plus s'exprimer en index : elle porte
-- désormais sur l'appartenance à un tableau. Le contrôle passe dans l'API,
-- qui sait en plus rendre une erreur lisible plutôt qu'une violation brute.
DROP INDEX IF EXISTS public.zones_titulaire_jour_uidx;

ALTER TABLE public.zones
  DROP CONSTRAINT IF EXISTS zones_jour_semaine_check;
ALTER TABLE public.zones
  DROP COLUMN IF EXISTS jour_semaine;

COMMIT;
