-- Droit à l'effacement : les copies qui survivaient à la suppression du contact.
--
-- Supprimer un contact déclenche aujourd'hui les CASCADE attendues
-- (contact_interactions) et des SET NULL sur douze tables. Mais deux colonnes
-- jsonb recopient des lignes de contact sans lien de clé étrangère : la base ne
-- sait pas qu'elles les contiennent, donc rien ne les touche. Un effacement
-- exercé aujourd'hui les laisserait en place.
--
-- Ce qui a été vérifié ligne par ligne avant d'écrire cette migration :
--
--   * assistant_messages.lignes_sources — PROBLÈME RÉEL. Le tableau contient
--     {kind, id, typeLabel, titre, date, auteur, href}. Pour une source de type
--     contact, `titre` est le nom de la personne et `id` son identifiant. Aucune
--     FK. Confirmé sur les 6 messages en base.
--
--   * demo_lead_snapshots.snapshot — PAS DE DONNÉE PERSONNELLE. Contrairement à
--     ce que le nom laisse craindre, scripts/seed-demo-agency.ts n'y écrit que
--     {status, delivered_at, assigned_to} : trois champs de suivi, zéro
--     coordonnée, zéro nom. La table est vide (0 ligne) et ne concerne que les
--     leads, jamais les contacts. Il n'y a donc rien à purger — mais rien
--     n'empêchait d'y verser demain le lead entier, owner_name et owner_phone
--     compris. On ferme cette porte plutôt que d'écrire une purge inutile.
--
--   * voice_notes.transcript / .structured — PROBLÈME RÉEL, non signalé par
--     l'audit. contact_id est en ON DELETE SET NULL : la transcription, où la
--     personne est nommée à voix haute, reste intacte et devient orpheline.
--
--   * agency_estimations.commentaires_confidentiels — PROBLÈME RÉEL, même
--     mécanisme, même angle mort.

-- ---------------------------------------------------------------------------
-- 1) assistant_messages.lignes_sources
-- ---------------------------------------------------------------------------
-- Purge chirurgicale : on retire l'élément qui cite le contact supprimé, on ne
-- touche pas au reste de la conversation. Un message peut citer dix fiches ;
-- une seule disparaît.

CREATE INDEX IF NOT EXISTS assistant_messages_lignes_sources_gin
  ON public.assistant_messages USING gin (lignes_sources);

-- Marqueur : sans lui, l'agent rouvre une note vide et croit à un bug.
ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS texte_efface_le timestamptz;
ALTER TABLE public.agency_estimations
  ADD COLUMN IF NOT EXISTS commentaires_effaces_le timestamptz;

COMMENT ON COLUMN public.voice_notes.texte_efface_le IS
  'Transcription retirée au titre du droit à l''effacement. La note et son rattachement au bien demeurent.';

CREATE OR REPLACE FUNCTION public.purger_copies_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- 1. Sources de l'assistant citant ce contact.
  UPDATE public.assistant_messages m
  SET lignes_sources = COALESCE((
        SELECT jsonb_agg(e)
        FROM jsonb_array_elements(m.lignes_sources) AS e
        WHERE e->>'id' IS DISTINCT FROM OLD.id::text
      ), '[]'::jsonb)
  WHERE m.lignes_sources @> jsonb_build_array(jsonb_build_object('id', OLD.id::text));

  -- 2. Transcriptions des notes vocales rattachées à ce contact.
  --
  -- Le texte part, la note reste. L'adresse, la parcelle, le bien, l'auteur et
  -- la date sont le travail de l'agent sur un IMMEUBLE — ils ne portent pas sur
  -- la personne et n'ont pas à disparaître avec elle. Ce qui part, c'est ce qui
  -- la nomme : la transcription et les champs extraits.
  UPDATE public.voice_notes
  SET transcript = NULL,
      structured = '{}'::jsonb,
      source_info = NULL,
      texte_efface_le = now()
  WHERE contact_id = OLD.id
    AND texte_efface_le IS NULL;

  -- 3. Commentaires confidentiels des estimations.
  --
  -- `commentaires_publics` reste : il fait partie du rapport remis, pièce d'un
  -- dossier professionnel, et porte sur le bien. Le confidentiel, lui, porte
  -- sur la personne — c'est précisément pour cela qu'il est confidentiel.
  UPDATE public.agency_estimations
  SET commentaires_confidentiels = NULL,
      commentaires_effaces_le = now()
  WHERE contact_id = OLD.id
    AND commentaires_confidentiels IS NOT NULL;

  RETURN OLD;
END;
$fn$;

COMMENT ON FUNCTION public.purger_copies_contact() IS
  'Efface les copies de données personnelles sans clé étrangère vers contacts : '
  'sources de l''assistant, transcriptions de notes vocales, commentaires confidentiels. '
  'NE COUVRE PAS le fichier audio dans Supabase Storage (voice_notes.storage_path) : '
  'un trigger ne peut pas atteindre le stockage. C''est lib/rgpd/effacement.ts qui s''en charge.';

DROP TRIGGER IF EXISTS trg_contacts_purger_copies ON public.contacts;
CREATE TRIGGER trg_contacts_purger_copies
  BEFORE DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.purger_copies_contact();

-- Rattrapage de l'existant : sources orphelines déjà présentes, citant un
-- contact qui n'existe plus. Aucune sur cette base aujourd'hui — la requête
-- sert de filet et de vérification.
UPDATE public.assistant_messages m
SET lignes_sources = COALESCE((
      SELECT jsonb_agg(e)
      FROM jsonb_array_elements(m.lignes_sources) AS e
      WHERE e->>'kind' IS DISTINCT FROM 'contact'
         OR EXISTS (SELECT 1 FROM public.contacts c WHERE c.id::text = e->>'id')
    ), '[]'::jsonb)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(m.lignes_sources) AS e
  WHERE e->>'kind' = 'contact'
    AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id::text = e->>'id')
);

-- ---------------------------------------------------------------------------
-- 2) demo_lead_snapshots : cesser de pouvoir y stocker autre chose
-- ---------------------------------------------------------------------------
-- La table n'a pas vocation à porter des données personnelles. On l'inscrit
-- dans le schéma au lieu de le laisser à la discipline du prochain script.

ALTER TABLE public.demo_lead_snapshots
  DROP CONSTRAINT IF EXISTS demo_lead_snapshots_champs_de_suivi;
ALTER TABLE public.demo_lead_snapshots
  ADD CONSTRAINT demo_lead_snapshots_champs_de_suivi
  -- `jsonb - text[]` retire les clés autorisées. S'il reste quoi que ce soit,
  -- c'est une clé non prévue. Écrit comme un opérateur et non comme une
  -- sous-requête : Postgres refuse les SELECT dans une contrainte CHECK.
  CHECK (
    snapshot - ARRAY['status', 'delivered_at', 'assigned_to', 'stage_id', 'stage_position']::text[]
      = '{}'::jsonb
  );

COMMENT ON TABLE public.demo_lead_snapshots IS
  'Champs de SUIVI des leads écrasés par le seed démo, pour pouvoir le défaire. '
  'Aucune donnée personnelle : la contrainte demo_lead_snapshots_champs_de_suivi '
  'rejette toute autre clé, y compris owner_name ou owner_phone.';
