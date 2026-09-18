-- Information de la personne (art. 13 RGPD), et preuve qu'elle a été délivrée.
--
-- L'information ne part plus vers la personne : c'est la personne qui la
-- rencontre, à deux endroits.
--
--   * la page publique permanente de priimo.fr, lisible par n'importe qui,
--     à tout moment, sans avoir été fiché ;
--   * l'écran du propriétaire qui vient de scanner le QR de l'agent, avant
--     qu'il ne coche quoi que ce soit ;
--   * et, pour les fiches nées d'une note de terrain sans consentement, la
--     mention délivrée de vive voix au premier contact réel.
--
-- Trois choses ici, et rien d'autre :
--   * le catalogue des textes, versionné comme estimation_consent_versions ;
--   * le journal de ce qui a été délivré, à qui, quand — la preuve ;
--   * rien sur l'expédition : plus aucun message n'est poussé.
--
-- Ce que cette réécriture supprime par rapport à la version SMS : les colonnes
-- d'expéditeur sur agencies, le jeton de lien, le statut de délivrance
-- opérateur, l'identifiant fournisseur, le destinataire en clair et son
-- empreinte poivrée. Sans envoi, il n'y a plus de destinataire à désigner ni à
-- anonymiser : le lien vers le contact suffit, et il tombe de lui-même à
-- l'effacement. C'est la moitié de la complexité de cette migration qui part.

-- ---------------------------------------------------------------------------
-- 1) Catalogue des textes
-- ---------------------------------------------------------------------------
-- Une version n'est jamais réécrite : on en ajoute une. C'est la règle qui rend
-- la preuve opposable — si le texte change en novembre, la personne qui a lu
-- celui de septembre garde le sien.

CREATE TABLE IF NOT EXISTS public.informations_legales_versions (
  version text PRIMARY KEY,

  -- Où ce texte s'affiche. Pas un canal d'envoi : une surface de lecture.
  support text NOT NULL CHECK (support IN (
    'page_qr',            -- au-dessus de la case, sur la page scannée
    'page_information',   -- la page publique permanente de priimo.fr
    'premier_contact'     -- ce que l'agent dit ou écrit au premier échange réel
  )),

  -- Gabarit à trous : {agence}, {agent}, {lien_information}.
  corps text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.informations_legales_versions IS
  'Textes d''information affichés à la personne. Strictement informatifs : aucune offre, aucun appel à l''action commercial.';
COMMENT ON COLUMN public.informations_legales_versions.support IS
  'Surface de lecture, pas canal d''envoi. Rien n''est expédié.';

ALTER TABLE public.informations_legales_versions ENABLE ROW LEVEL SECURITY;

-- Lecture ouverte à anon : la page QR et la page d'information sont publiques,
-- et doivent pouvoir rendre côté serveur sans détour par le service_role.
DROP POLICY IF EXISTS informations_legales_versions_select ON public.informations_legales_versions;
CREATE POLICY informations_legales_versions_select ON public.informations_legales_versions
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.informations_legales_versions TO anon, authenticated;

-- Le texte lu par le propriétaire AVANT de cocher. Court : il est lu debout,
-- sur un palier, sur le téléphone de quelqu'un qui n'a rien demandé. Ce qui ne
-- tient pas ici tient derrière le lien.
INSERT INTO public.informations_legales_versions (version, support, corps)
VALUES (
  'qr-terrain-2026-09-v1',
  'page_qr',
  E'{agence} enregistre les coordonnées que vous saisissez ici pour vous recontacter au sujet de votre bien.\n\nElles sont conservées trois ans à compter de notre dernier échange, et ne sont transmises à personne d''autre.\n\nVous pouvez à tout moment y accéder, les corriger, les faire supprimer ou vous opposer à leur usage : {lien_information}'
)
ON CONFLICT (version) DO NOTHING;

-- Ce que l'agent dit au téléphone, ou colle dans son premier email, quand la
-- fiche est née d'une note de terrain sans que la personne ait rien signé.
-- C'est le seul moment où l'information peut encore être délivrée : il est
-- aussi le premier moment où la personne est réellement en mesure de l'entendre.
INSERT INTO public.informations_legales_versions (version, support, corps)
VALUES (
  'premier-contact-2026-09-v1',
  'premier_contact',
  E'Avant d''aller plus loin : vos coordonnées figurent dans le fichier de {agence} depuis notre échange. Elles servent uniquement à vous recontacter au sujet de votre bien, sont conservées trois ans, et ne sont transmises à personne. Vous pouvez demander à les consulter, les corriger ou les supprimer à tout moment — le détail est sur {lien_information}.'
)
ON CONFLICT (version) DO NOTHING;

-- La page publique permanente. Versionnée comme les autres : le jour où une
-- personne conteste ce qu'elle a pu lire en septembre 2026, la réponse est ici
-- et non dans l'historique Git d'un composant React.
INSERT INTO public.informations_legales_versions (version, support, corps)
VALUES (
  'page-information-2026-09-v1',
  'page_information',
  E'## Vos données chez une agence utilisant Priimo\n\n' ||
  E'Priimo est l''outil de prospection utilisé par des agences immobilières indépendantes. ' ||
  E'Lorsque vos coordonnées figurent dans l''une d''elles, **c''est cette agence qui en est responsable**, pas Priimo, ' ||
  E'qui n''agit que comme sous-traitant technique.\n\n' ||
  E'### D''où viennent les informations vous concernant\n\n' ||
  E'Soit vous les avez saisies vous-même — formulaire d''estimation, ou page de contact présentée par un agent sur le terrain. ' ||
  E'Soit elles proviennent de jeux de données publics : diagnostics de performance énergétique (ADEME), ' ||
  E'transactions immobilières (DVF), registre national des copropriétés, cadastre.\n\n' ||
  E'### Combien de temps elles sont conservées\n\n' ||
  E'Trois ans à compter du dernier échange avec vous.\n\n' ||
  E'### Vos droits\n\n' ||
  E'Accès, rectification, effacement, opposition, limitation, portabilité. ' ||
  E'Ils s''exercent depuis {lien_portail}, et l''agence doit vous répondre sous un mois.'
)
ON CONFLICT (version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) Journal des délivrances — la preuve
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.informations_legales_delivrances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,

  -- SET NULL et non CASCADE : « une information a été délivrée le 15 septembre »
  -- reste vrai après l'effacement de la fiche. Le lien tombe, la ligne demeure,
  -- et comme elle ne contient aucune coordonnée, il n'y a plus rien à anonymiser
  -- — contrairement à la version SMS, qui portait le numéro du destinataire.
  contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,

  -- Recopiés, jamais joints : l'agent peut quitter l'agence, l'agence peut
  -- changer de nom. La preuve doit rester lisible telle qu'elle a été produite.
  agent_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  agent_prenom text NOT NULL,
  agence_nom text NOT NULL,

  support text NOT NULL CHECK (support IN ('page_qr', 'premier_contact')),

  -- Comment la mention a été portée à la connaissance de la personne. NULL pour
  -- page_qr : elle l'a lue à l'écran, il n'y a pas de moyen à préciser.
  moyen text CHECK (moyen IS NULL OR moyen IN ('appel', 'email', 'rencontre')),

  -- Le texte EXACT porté à sa connaissance, trous remplis. Pas l'identifiant de
  -- version seul : c'est ce texte-là qui prouve ce qu'elle a lu ou entendu.
  contenu_delivre text NOT NULL,
  version text NOT NULL REFERENCES public.informations_legales_versions (version),

  delivre_le timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT informations_legales_delivrances_moyen_coherent
    CHECK (support <> 'premier_contact' OR moyen IS NOT NULL)
);

COMMENT ON TABLE public.informations_legales_delivrances IS
  'Preuve que l''information a été portée à la connaissance de la personne. En écriture seule.';
COMMENT ON COLUMN public.informations_legales_delivrances.contenu_delivre IS
  'Texte exact délivré. Ne contient aucune coordonnée — d''où sa conservation intégrale après effacement.';

CREATE INDEX IF NOT EXISTS informations_legales_delivrances_contact_idx
  ON public.informations_legales_delivrances (contact_id, delivre_le DESC);
CREATE INDEX IF NOT EXISTS informations_legales_delivrances_agency_idx
  ON public.informations_legales_delivrances (agency_id, delivre_le DESC);

-- Pas d'index unique sur contact_id : une personne peut légitimement être
-- informée deux fois — à l'écran lors du scan, puis de vive voix des mois plus
-- tard. Ce qu'il faut savoir, c'est s'il existe AU MOINS une délivrance ; c'est
-- une question d'existence, pas d'unicité.

-- ---------------------------------------------------------------------------
-- 3) Immuabilité de la preuve
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.informations_legales_delivrances_garde()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Une agence supprimée emporte ses preuves : il n'y a plus de responsable
    -- de traitement à qui les opposer. Pendant la cascade, la ligne parente est
    -- déjà partie — c'est ce qui distingue ce cas d'une suppression directe,
    -- qui, elle, reste interdite. Sans cette échappatoire, le trigger rendrait
    -- toute suppression d'agence impossible, sans dire pourquoi.
    IF NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = OLD.agency_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'informations_legales_delivrances : suppression interdite, c''est la preuve de conformité';
  END IF;

  -- Seul contact_id peut bouger, et seulement vers NULL (effacement).
  IF NEW.agency_id       IS DISTINCT FROM OLD.agency_id
     OR NEW.support         IS DISTINCT FROM OLD.support
     OR NEW.moyen           IS DISTINCT FROM OLD.moyen
     OR NEW.contenu_delivre IS DISTINCT FROM OLD.contenu_delivre
     OR NEW.version         IS DISTINCT FROM OLD.version
     OR NEW.agent_prenom    IS DISTINCT FROM OLD.agent_prenom
     OR NEW.agence_nom      IS DISTINCT FROM OLD.agence_nom
     OR NEW.delivre_le      IS DISTINCT FROM OLD.delivre_le
     OR NEW.created_at      IS DISTINCT FROM OLD.created_at
     OR (OLD.contact_id IS NULL AND NEW.contact_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'informations_legales_delivrances : la preuve n''est pas modifiable';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_informations_legales_delivrances_garde ON public.informations_legales_delivrances;
CREATE TRIGGER trg_informations_legales_delivrances_garde
  BEFORE UPDATE OR DELETE ON public.informations_legales_delivrances
  FOR EACH ROW EXECUTE FUNCTION public.informations_legales_delivrances_garde();

-- ---------------------------------------------------------------------------
-- 4) Lecture
-- ---------------------------------------------------------------------------
ALTER TABLE public.informations_legales_delivrances ENABLE ROW LEVEL SECURITY;

-- L'agence lit ses propres délivrances : c'est ce qui alimente la ligne
-- discrète « Informée le 15 septembre » sur la fiche contact. Le filtrage par
-- collaborateur se fait à la lecture, via lib/agency/visibility.ts, comme pour
-- la fiche elle-même.
DROP POLICY IF EXISTS informations_legales_delivrances_select ON public.informations_legales_delivrances;
CREATE POLICY informations_legales_delivrances_select ON public.informations_legales_delivrances
  FOR SELECT TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

-- Ni INSERT ni UPDATE pour authenticated : seul le service_role écrit. Un agent
-- ne doit pas pouvoir fabriquer une preuve d'information après coup — y compris
-- quand c'est lui qui déclare l'avoir délivrée au téléphone : la déclaration
-- passe par une route serveur qui horodate, pas par un INSERT depuis le client.
GRANT SELECT ON public.informations_legales_delivrances TO authenticated;
