-- Flux QR de consentement terrain.
--
-- L'agent sonne. Il montre un QR sur l'écran de son téléphone. Le propriétaire
-- le scanne avec SON téléphone, arrive sur une page publique, saisit nom,
-- prénom, téléphone, email, coche une case non pré-cochée qui nomme la
-- finalité, valide. Le contact naît dans l'agence avec son consentement
-- horodaté, et l'agent le voit arriver dans la seconde.
--
-- Ce que le QR transporte : un jeton, rien d'autre. Ni l'adresse visée, ni le
-- nom du propriétaire, ni l'identifiant du lead. La page ne pré-remplit rien
-- parce qu'elle ne sait rien — c'est une contrainte de conception, pas une
-- économie. Une page qui afficherait « Bonjour M. Martin, 12 rue des Lilas »
-- révélerait à quiconque scanne ce QR ce que l'agence sait déjà de l'immeuble.
--
-- Pourquoi un jeton plutôt que l'identifiant de l'agent en clair dans l'URL :
-- un QR se photographie. Un uuid d'agent collé dans une URL est une porte
-- ouverte définitive sur la création de contacts dans l'agence, pour qui a
-- pris la photo — ou pour le voisin curieux à qui on l'a montrée. Le jeton
-- expire, se révoque, se compte. Il ne porte toujours que l'agent et l'agence :
-- la contrainte est respectée, la porte se referme.

-- ---------------------------------------------------------------------------
-- 1) Les sessions de porte-à-porte
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_sessions_terrain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,

  -- Seule l'empreinte poivrée est stockée (secret applicatif, jamais en base).
  -- Une fuite de la base ne permet pas de reconstituer un QR valide.
  token_sha256 text NOT NULL UNIQUE,

  ouverte_le timestamptz NOT NULL DEFAULT now(),
  -- Une tournée dure une demi-journée, pas un trimestre. L'expiration est la
  -- principale défense : elle agit même si personne ne pense à révoquer.
  expire_le timestamptz NOT NULL,
  revoquee_le timestamptz,

  -- Garde-fou de volume, même esprit que agency_widgets.daily_cap : un jeton
  -- qui produit quarante contacts dans l'après-midi n'est plus un agent qui
  -- fait du porte-à-porte.
  plafond integer NOT NULL DEFAULT 30 CHECK (plafond BETWEEN 1 AND 200),
  contacts_crees integer NOT NULL DEFAULT 0,
  dernier_usage_le timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT qr_sessions_terrain_duree CHECK (expire_le > ouverte_le)
);

COMMENT ON TABLE public.qr_sessions_terrain IS
  'Jeton derrière le QR affiché en porte-à-porte. Ne porte que l''agent et l''agence : jamais d''adresse ni de nom.';
COMMENT ON COLUMN public.qr_sessions_terrain.token_sha256 IS
  'Empreinte poivrée du jeton présent dans l''URL du QR. Le jeton en clair ne vit que dans le QR.';

-- Résolution du jeton à chaque scan : c'est la requête du chemin critique, sur
-- un réseau de cage d'escalier. Index partiel pour qu'elle ne touche que les
-- sessions encore ouvertes.
CREATE INDEX IF NOT EXISTS qr_sessions_terrain_vivantes_idx
  ON public.qr_sessions_terrain (token_sha256)
  WHERE revoquee_le IS NULL;

CREATE INDEX IF NOT EXISTS qr_sessions_terrain_agent_idx
  ON public.qr_sessions_terrain (agent_id, ouverte_le DESC);

DROP TRIGGER IF EXISTS trg_qr_sessions_terrain_updated ON public.qr_sessions_terrain;
CREATE TRIGGER trg_qr_sessions_terrain_updated
  BEFORE UPDATE ON public.qr_sessions_terrain
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.qr_sessions_terrain ENABLE ROW LEVEL SECURITY;

-- L'agent voit et ouvre ses propres sessions. Le directeur voit celles de son
-- agence — c'est lui qui devra répondre si un jeton part à la dérive.
DROP POLICY IF EXISTS qr_sessions_terrain_select ON public.qr_sessions_terrain;
CREATE POLICY qr_sessions_terrain_select ON public.qr_sessions_terrain
  FOR SELECT TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (
      agent_id = (SELECT auth.uid())
      OR (SELECT public.current_user_role()) = 'directeur'
    )
  );

-- Révoquer : le titulaire, ou la direction.
DROP POLICY IF EXISTS qr_sessions_terrain_update ON public.qr_sessions_terrain;
CREATE POLICY qr_sessions_terrain_update ON public.qr_sessions_terrain
  FOR UPDATE TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    AND (
      agent_id = (SELECT auth.uid())
      OR (SELECT public.current_user_role()) = 'directeur'
    )
  )
  WITH CHECK (agency_id = (SELECT public.current_user_agency_id()));

-- Pas de policy INSERT : le jeton est fabriqué côté serveur, avec son poivre.
-- Un client qui pourrait insérer une ligne pourrait choisir son empreinte.
GRANT SELECT ON public.qr_sessions_terrain TO authenticated;
GRANT UPDATE (revoquee_le) ON public.qr_sessions_terrain TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) La provenance du contact
-- ---------------------------------------------------------------------------
-- Un contact né d'un QR n'est ni « manuel » ni « prospection » : il a été saisi
-- par la personne elle-même, avec son accord. Cette distinction porte la base
-- légale — c'est le seul cas où un contact de terrain repose sur le
-- consentement et non sur l'intérêt légitime.

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_source_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_source_check
  CHECK (source = ANY (ARRAY[
    'manuel', 'vocal', 'prospection', 'portail', 'site_agence',
    'seloger', 'bienici', 'logicimmo', 'leboncoin', 'autre_portail',
    'qr_terrain'
  ]));

COMMENT ON COLUMN public.contacts.source IS
  'Par quel geste la fiche est entrée. qr_terrain = saisie par la personne elle-même après scan du QR d''un agent.';

-- Retrouver ce qu'une tournée a produit, et repérer une fiche QR sans son
-- consentement — qui serait un bug, jamais un cas de figure normal.
CREATE INDEX IF NOT EXISTS contacts_qr_terrain_idx
  ON public.contacts (agency_id, created_at DESC)
  WHERE source = 'qr_terrain';
