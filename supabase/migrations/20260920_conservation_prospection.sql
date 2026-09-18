-- Durée de conservation en prospection : 3 ans après le dernier contact.
--
-- Doctrine CNIL (référentiel gestion commerciale) : les données d'un prospect
-- non client se conservent trois ans à compter du dernier contact émanant du
-- prospect, ou du dernier contact resté sans réponse. Aujourd'hui rien n'expire
-- dans Priimo : une fiche de 2026 sera encore là en 2036.
--
-- Cette migration ne supprime RIEN et n'arme aucune suppression. Elle calcule
-- la date de dernier contact et ouvre la table où le passage quotidien inscrit
-- les fiches échues. La décision de supprimer reste humaine, fiche par fiche.
--
-- pg_cron n'est pas installé sur ce projet (extensions présentes : plpgsql,
-- pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault). Le passage planifié
-- est donc un cron Vercel — /api/cron/conservation — comme les trois existants.

-- ---------------------------------------------------------------------------
-- 1) Date de dernier contact
-- ---------------------------------------------------------------------------
-- `contacts.last_interaction_at` existe déjà mais ne voit que les interactions :
-- un rendez-vous honoré, une visite, une estimation remise ne la bougent pas.
-- Une fiche vivante serait signalée échue. D'où une date distincte, calculée
-- sur tout ce qui constitue un contact au sens de la CNIL.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS dernier_contact_le date;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS dernier_contact_le date;

COMMENT ON COLUMN public.contacts.dernier_contact_le IS
  'Dernier contact au sens CNIL (interaction, RDV, visite, estimation, note). Point de départ des 3 ans. Recalculée, jamais saisie.';
COMMENT ON COLUMN public.leads.dernier_contact_le IS
  'Dernier geste de prospection sur la fiche. Un lead jamais pris garde sa date de constitution.';

CREATE OR REPLACE FUNCTION public.calculer_dernier_contact_contact(p_contact_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  -- GREATEST ignore les NULL : une fiche sans aucun geste retombe sur sa date
  -- de création, ce qui est exactement la bonne réponse.
  SELECT GREATEST(
    (SELECT c.created_at::date FROM public.contacts c WHERE c.id = p_contact_id),
    (SELECT c.last_interaction_at::date FROM public.contacts c WHERE c.id = p_contact_id),
    (SELECT MAX(i.occurred_at)::date FROM public.contact_interactions i WHERE i.contact_id = p_contact_id),
    (SELECT MAX(r.created_at)::date FROM public.rendez_vous r WHERE r.contact_id = p_contact_id),
    (SELECT MAX(v.created_at)::date FROM public.visites v WHERE v.contact_id = p_contact_id),
    (SELECT MAX(e.created_at)::date FROM public.agency_estimations e WHERE e.contact_id = p_contact_id),
    (SELECT MAX(n.created_at)::date FROM public.voice_notes n WHERE n.contact_id = p_contact_id)
  );
$fn$;

CREATE OR REPLACE FUNCTION public.calculer_dernier_contact_lead(p_lead_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  -- updated_at est volontairement exclu : le rescoring nocturne le déplace sans
  -- qu'aucun humain n'ait touché la fiche. Il ferait vivre éternellement des
  -- leads que personne n'a jamais ouverts — soit l'inverse du but.
  SELECT GREATEST(
    (SELECT l.delivered_at FROM public.leads l WHERE l.id = p_lead_id),
    (SELECT l.created_at::date FROM public.leads l WHERE l.id = p_lead_id),
    (SELECT l.taken_at::date FROM public.leads l WHERE l.id = p_lead_id),
    (SELECT l.stage_changed_at::date FROM public.leads l WHERE l.id = p_lead_id),
    (SELECT l.assigned_at::date FROM public.leads l WHERE l.id = p_lead_id),
    (SELECT l.ml_feedback_at::date FROM public.leads l WHERE l.id = p_lead_id)
  );
$fn$;

-- Tenue à jour au fil de l'eau sur le chemin le plus fréquent (une interaction
-- ajoutée). Les autres chemins — RDV, visite, estimation — sont rattrapés par
-- le passage quotidien : une journée de retard sur un délai de trois ans ne
-- change rien, et cela évite six triggers de plus sur des tables chaudes.
CREATE OR REPLACE FUNCTION public.touch_contact_last_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  UPDATE public.contacts
  SET last_interaction_at = GREATEST(COALESCE(last_interaction_at, NEW.occurred_at), NEW.occurred_at),
      dernier_contact_le  = GREATEST(COALESCE(dernier_contact_le, NEW.occurred_at::date), NEW.occurred_at::date)
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$fn$;

-- Renseigner l'existant.
UPDATE public.contacts
SET dernier_contact_le = public.calculer_dernier_contact_contact(id)
WHERE dernier_contact_le IS NULL;

UPDATE public.leads
SET dernier_contact_le = public.calculer_dernier_contact_lead(id)
WHERE dernier_contact_le IS NULL;

CREATE INDEX IF NOT EXISTS contacts_dernier_contact_idx
  ON public.contacts (agency_id, dernier_contact_le);
CREATE INDEX IF NOT EXISTS leads_dernier_contact_idx
  ON public.leads (agency_id, dernier_contact_le);

-- ---------------------------------------------------------------------------
-- 2) Le délai, en un seul endroit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conservation_prospection_annees()
RETURNS integer LANGUAGE sql IMMUTABLE AS $fn$ SELECT 3 $fn$;

COMMENT ON FUNCTION public.conservation_prospection_annees() IS
  'Durée de conservation en prospection, en années. Se change ici, et nulle part ailleurs.';

-- ---------------------------------------------------------------------------
-- 3) Les fiches échues, signalées et non supprimées
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conservation_revues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,

  cible_type text NOT NULL CHECK (cible_type IN ('contact', 'lead')),
  cible_id uuid NOT NULL,

  -- Recopiées au signalement : la revue doit rester lisible même si la fiche
  -- bouge entre le signalement et la décision.
  dernier_contact_le date NOT NULL,
  echue_le date NOT NULL,

  signale_le timestamptz NOT NULL DEFAULT now(),

  -- 'a_revoir' tant que personne n'a tranché. Aucune bascule automatique.
  statut text NOT NULL DEFAULT 'a_revoir'
    CHECK (statut IN ('a_revoir', 'conservee', 'supprimee')),

  -- Conserver au-delà du délai peut se justifier (contentieux, mandat en
  -- cours). Cette justification est elle-même une pièce du dossier de
  -- conformité : sans motif écrit, pas de prolongation.
  motif_conservation text,
  tranche_le timestamptz,
  tranche_par uuid REFERENCES public.profiles (id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT conservation_revues_motif_si_conservee
    CHECK (statut <> 'conservee' OR COALESCE(motif_conservation, '') <> '')
);

COMMENT ON TABLE public.conservation_revues IS
  'Fiches ayant dépassé la durée de conservation en prospection. Signalement seul : aucune suppression automatique.';

-- Une fiche n'est signalée qu'une fois tant qu'elle n'a pas été tranchée.
CREATE UNIQUE INDEX IF NOT EXISTS conservation_revues_cible_ouverte_uidx
  ON public.conservation_revues (cible_type, cible_id)
  WHERE statut = 'a_revoir';

CREATE INDEX IF NOT EXISTS conservation_revues_agency_idx
  ON public.conservation_revues (agency_id, statut, echue_le);

DROP TRIGGER IF EXISTS trg_conservation_revues_updated ON public.conservation_revues;
CREATE TRIGGER trg_conservation_revues_updated
  BEFORE UPDATE ON public.conservation_revues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.conservation_revues ENABLE ROW LEVEL SECURITY;

-- Lecture réservée au directeur : c'est une revue de conformité qui engage
-- l'agence, pas une corvée à répartir dans l'équipe.
DROP POLICY IF EXISTS conservation_revues_select ON public.conservation_revues;
CREATE POLICY conservation_revues_select ON public.conservation_revues
  FOR SELECT TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

DROP POLICY IF EXISTS conservation_revues_update ON public.conservation_revues;
CREATE POLICY conservation_revues_update ON public.conservation_revues
  FOR UPDATE TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  )
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

-- Pas de policy INSERT : seul le cron (service_role) inscrit des lignes.
GRANT SELECT ON public.conservation_revues TO authenticated;
GRANT UPDATE (statut, motif_conservation, tranche_le, tranche_par)
  ON public.conservation_revues TO authenticated;
