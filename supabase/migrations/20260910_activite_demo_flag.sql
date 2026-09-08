-- Drapeau de démonstration sur les deux journaux d'activité.
--
-- `is_demo` existait déjà sur contacts, biens, voice_notes, note_liens… mais pas
-- sur lead_stage_events ni sortie_events. Or l'agence de démonstration et
-- l'agence de test sont la même : sans drapeau, un seed scénarisé et les vraies
-- transitions se mélangent dans le même bilan, et plus personne ne sait quel
-- chiffre croire.
--
-- Les lignes existantes restent à false. C'est délibéré : elles servent de
-- référence au recomptage manuel de l'agence de test, et les requalifier
-- rétroactivement changerait des chiffres déjà vérifiés à la main.

ALTER TABLE public.lead_stage_events
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.lead_stage_events.is_demo IS
  'Transition fictive produite par scripts/seed-demo-agency.ts. Écrite en service_role : le trigger laisse false.';

CREATE INDEX IF NOT EXISTS lead_stage_events_demo_idx
  ON public.lead_stage_events (agency_id)
  WHERE is_demo;

ALTER TABLE public.sortie_events
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sortie_events.is_demo IS
  'Sortie fictive produite par scripts/seed-demo-agency.ts.';

CREATE INDEX IF NOT EXISTS sortie_events_demo_idx
  ON public.sortie_events (agency_id)
  WHERE is_demo;

-- Les lectures de l'écran Accueil filtrent toujours sur is_demo : l'index sert
-- le cas courant (is_demo = false), qui n'est pas couvert par les index partiels
-- ci-dessus.
CREATE INDEX IF NOT EXISTS lead_stage_events_reel_idx
  ON public.lead_stage_events (agency_id, created_at DESC)
  WHERE NOT is_demo;

CREATE INDEX IF NOT EXISTS sortie_events_rencontre_reelle_idx
  ON public.sortie_events (agency_id, profile_id, day)
  WHERE kind = 'rencontre' AND NOT is_demo;

-- Un collaborateur ne doit jamais pouvoir se déclarer « démo » pour sortir des
-- statistiques de son agence. L'écriture reste au trigger et au service_role.
REVOKE UPDATE ON public.sortie_events FROM authenticated, anon;
