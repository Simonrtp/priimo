-- Portail public d'exercice des droits.
--
-- Une personne saisit son téléphone ou son email. Priimo cherche dans les
-- leads, contacts, notes, interactions et estimations — mais ne dit RIEN au
-- navigateur. La réponse est identique qu'il y ait une fiche ou non, sans quoi
-- le portail deviendrait un testeur de numéros : « tapez un 06, apprenez qui
-- est fiché chez son agent immobilier ».
--
-- Ce que la personne reçoit à l'écran : « Si des données vous concernant
-- existent, l'agence concernée vous répondra sous un mois. » Toujours la même
-- phrase. Ce sont les agences correspondantes, et elles seules, qui voient
-- arriver une demande.

CREATE TABLE IF NOT EXISTS public.demandes_droits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,

  type_demande text NOT NULL CHECK (type_demande IN (
    'acces', 'rectification', 'effacement', 'opposition', 'limitation', 'portabilite'
  )),

  -- Coordonnées du demandeur, en clair : l'agence doit pouvoir le rappeler pour
  -- vérifier son identité, puis lui répondre. C'est la finalité même de la
  -- demande — les masquer la rendrait intraitable.
  demandeur_telephone text,
  demandeur_email text,
  -- Empreintes poivrées : c'est par elles que la demande a été rattachée à
  -- cette agence, et par elles qu'on retrouve les fiches au moment de répondre.
  demandeur_telephone_sha256 text,
  demandeur_email_sha256 text,
  demandeur_message text,

  recue_le timestamptz NOT NULL DEFAULT now(),
  -- Délai légal : un mois. Posé à l'insertion plutôt que calculé à la lecture,
  -- pour qu'un changement de règle ne réécrive pas l'échéance des demandes
  -- déjà en cours.
  echeance_le timestamptz NOT NULL DEFAULT (now() + interval '1 month'),

  statut text NOT NULL DEFAULT 'recue' CHECK (statut IN (
    'recue',            -- arrivée, personne ne l'a ouverte
    'identite_a_verifier',
    'en_cours',         -- identité vérifiée, réponse en préparation
    'repondue',
    'refusee'           -- identité non établie, ou demande manifestement infondée
  )),

  -- L'agence répond sous sa responsabilité : elle atteste avoir vérifié à qui
  -- elle parlait. Sans cette trace, communiquer un dossier est en soi une fuite.
  identite_verifiee_le timestamptz,
  identite_verifiee_par uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  identite_moyen text,

  repondue_le timestamptz,
  repondue_par uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reponse_resume text,
  refus_motif text,

  -- Provenance de la soumission, pour instruire un abus.
  ip_address text,
  user_agent text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT demandes_droits_une_coordonnee
    CHECK (demandeur_telephone_sha256 IS NOT NULL OR demandeur_email_sha256 IS NOT NULL),
  CONSTRAINT demandes_droits_refus_motive
    CHECK (statut <> 'refusee' OR COALESCE(refus_motif, '') <> ''),
  CONSTRAINT demandes_droits_reponse_apres_verification
    CHECK (statut <> 'repondue' OR identite_verifiee_le IS NOT NULL)
);

COMMENT ON TABLE public.demandes_droits IS
  'Demandes d''exercice des droits reçues par le portail public. Une ligne par agence concernée.';
COMMENT ON CONSTRAINT demandes_droits_reponse_apres_verification ON public.demandes_droits IS
  'Impossible de clore une demande sans avoir attesté la vérification d''identité.';

CREATE INDEX IF NOT EXISTS demandes_droits_agency_idx
  ON public.demandes_droits (agency_id, statut, recue_le DESC);
-- Ce qui remonte dans l'Accueil du directeur : ouvert depuis plus de 20 jours.
CREATE INDEX IF NOT EXISTS demandes_droits_ouvertes_idx
  ON public.demandes_droits (agency_id, recue_le)
  WHERE statut IN ('recue', 'identite_a_verifier', 'en_cours');

DROP TRIGGER IF EXISTS trg_demandes_droits_updated ON public.demandes_droits;
CREATE TRIGGER trg_demandes_droits_updated
  BEFORE UPDATE ON public.demandes_droits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.demandes_droits ENABLE ROW LEVEL SECURITY;

-- Répondre engage l'agence : c'est une tâche de direction, pas une tâche
-- répartie. Même raisonnement que conservation_revues.
DROP POLICY IF EXISTS demandes_droits_select ON public.demandes_droits;
CREATE POLICY demandes_droits_select ON public.demandes_droits
  FOR SELECT TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

DROP POLICY IF EXISTS demandes_droits_update ON public.demandes_droits;
CREATE POLICY demandes_droits_update ON public.demandes_droits
  FOR UPDATE TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  )
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

-- Aucune policy INSERT : le portail public écrit via le service_role. Sans
-- cela, anon pourrait déposer des demandes en masse au nom de n'importe qui.
GRANT SELECT ON public.demandes_droits TO authenticated;
GRANT UPDATE (
  statut, identite_verifiee_le, identite_verifiee_par, identite_moyen,
  repondue_le, repondue_par, reponse_resume, refus_motif
) ON public.demandes_droits TO authenticated;

-- ---------------------------------------------------------------------------
-- Ce qui a été fait de la demande
-- ---------------------------------------------------------------------------
-- Un export ou une suppression exercés au titre d'un droit doivent laisser une
-- trace : c'est la réponse à « qu'avez-vous communiqué, et qu'avez-vous
-- effacé ? » un an plus tard, quand plus personne ne s'en souvient.

CREATE TABLE IF NOT EXISTS public.demandes_droits_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id uuid NOT NULL REFERENCES public.demandes_droits (id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,

  action text NOT NULL CHECK (action IN ('export', 'suppression', 'rectification', 'opposition')),

  -- Ce qui a été touché, par table et par nombre. Pas le contenu : rejournaliser
  -- les données d'une personne qui demande leur effacement serait absurde.
  -- Forme : {"contacts": 1, "contact_interactions": 12, "voice_notes": 3}
  perimetre jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Empreinte du fichier remis, pour prouver ce qui a été communiqué sans en
  -- garder une copie.
  export_sha256 text,

  effectue_le timestamptz NOT NULL DEFAULT now(),
  effectue_par uuid REFERENCES public.profiles (id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.demandes_droits_actions IS
  'Journal de ce qui a été exporté ou supprimé au titre d''une demande. Écriture seule.';

CREATE INDEX IF NOT EXISTS demandes_droits_actions_demande_idx
  ON public.demandes_droits_actions (demande_id, effectue_le);

CREATE OR REPLACE FUNCTION public.demandes_droits_actions_immuable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Cascade légitime : l'agence ou la demande parente a déjà disparu. Toute
  -- autre suppression reste interdite.
  IF TG_OP = 'DELETE'
     AND (NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = OLD.agency_id)
          OR NOT EXISTS (SELECT 1 FROM public.demandes_droits d WHERE d.id = OLD.demande_id))
  THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'demandes_droits_actions est en écriture seule : % interdit', TG_OP;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_demandes_droits_actions_immuable ON public.demandes_droits_actions;
CREATE TRIGGER trg_demandes_droits_actions_immuable
  BEFORE UPDATE OR DELETE ON public.demandes_droits_actions
  FOR EACH ROW EXECUTE FUNCTION public.demandes_droits_actions_immuable();

ALTER TABLE public.demandes_droits_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS demandes_droits_actions_select ON public.demandes_droits_actions;
CREATE POLICY demandes_droits_actions_select ON public.demandes_droits_actions
  FOR SELECT TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (SELECT public.current_user_role()) = 'directeur'
  );

GRANT SELECT ON public.demandes_droits_actions TO authenticated;
