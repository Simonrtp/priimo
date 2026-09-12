-- L'estimation devient un objet qui vit : motif, état, référent, grille.
-- On étend agency_estimations. Pas de seconde table.

ALTER TABLE public.agency_estimations
  ALTER COLUMN address DROP NOT NULL,
  ALTER COLUMN property_type DROP NOT NULL,
  ALTER COLUMN surface_m2 DROP NOT NULL,
  ALTER COLUMN rooms DROP NOT NULL;

ALTER TABLE public.agency_estimations
  ADD COLUMN IF NOT EXISTS motif text NOT NULL DEFAULT 'projet_vente',
  ADD COLUMN IF NOT EXISTS etat text NOT NULL DEFAULT 'brouillon',
  ADD COLUMN IF NOT EXISTS referent_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_valeur date,
  ADD COLUMN IF NOT EXISTS occupation text NOT NULL DEFAULT 'libre',
  ADD COLUMN IF NOT EXISTS loyer_annuel integer,
  ADD COLUMN IF NOT EXISTS honoraires_pct numeric(5, 2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS commentaires_confidentiels text,
  ADD COLUMN IF NOT EXISTS commentaires_publics text,
  ADD COLUMN IF NOT EXISTS bien jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS grille jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS annexes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS points_forts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS points_faibles jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.agency_estimations
  DROP CONSTRAINT IF EXISTS agency_estimations_motif_check;
ALTER TABLE public.agency_estimations
  ADD CONSTRAINT agency_estimations_motif_check CHECK (
    motif IN ('projet_vente', 'patrimoniale', 'fiscale', 'succession', 'projet_achat')
  );

ALTER TABLE public.agency_estimations
  DROP CONSTRAINT IF EXISTS agency_estimations_etat_check;
ALTER TABLE public.agency_estimations
  ADD CONSTRAINT agency_estimations_etat_check CHECK (
    etat IN (
      'brouillon',
      'rendez_vous_pris',
      'realisee',
      'envoyee',
      'mandat_signe',
      'sans_suite'
    )
  );

ALTER TABLE public.agency_estimations
  DROP CONSTRAINT IF EXISTS agency_estimations_occupation_check;
ALTER TABLE public.agency_estimations
  ADD CONSTRAINT agency_estimations_occupation_check CHECK (
    occupation IN ('libre', 'occupe')
  );

UPDATE public.agency_estimations
SET referent_id = created_by
WHERE referent_id IS NULL AND created_by IS NOT NULL;

-- Un avis déjà calculé n'est plus un brouillon.
UPDATE public.agency_estimations
SET etat = 'realisee'
WHERE available = true
  AND price_value IS NOT NULL
  AND etat = 'brouillon';

CREATE INDEX IF NOT EXISTS agency_estimations_referent_idx
  ON public.agency_estimations (referent_id)
  WHERE referent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agency_estimations_etat_idx
  ON public.agency_estimations (agency_id, etat, created_at DESC);

COMMENT ON COLUMN public.agency_estimations.motif IS
  'Pourquoi on estime. Change le ton du rapport, pas le moteur.';
COMMENT ON COLUMN public.agency_estimations.etat IS
  'Avancement du cycle. realisee pousse le lead associé à l''étape estimation.';
COMMENT ON COLUMN public.agency_estimations.referent_id IS
  'Négociateur responsable. Pré-rempli, modifiable par le directeur seulement.';
COMMENT ON COLUMN public.agency_estimations.commentaires_confidentiels IS
  'Jamais exposé sur /avis ni dans un document remis au client.';
