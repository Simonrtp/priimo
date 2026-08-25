-- Échéances contractuelles, visites, offres, promesses et rendez-vous.
-- Alimente le moteur de cartes « Aujourd'hui » par enjeu métier.

-- ---------------------------------------------------------------------------
-- 1) biens — champs mandat / prix
-- ---------------------------------------------------------------------------
ALTER TABLE public.biens
  ADD COLUMN IF NOT EXISTS mandat_type text NULL
    CHECK (mandat_type IS NULL OR mandat_type IN ('simple', 'exclusif', 'semi_exclusif')),
  ADD COLUMN IF NOT EXISTS mandat_signe_le date NULL,
  ADD COLUMN IF NOT EXISTS mandat_duree_mois integer NOT NULL DEFAULT 3
    CHECK (mandat_duree_mois > 0 AND mandat_duree_mois <= 36),
  ADD COLUMN IF NOT EXISTS mandat_irrevocable_jusqu_au date NULL,
  ADD COLUMN IF NOT EXISTS prix_initial numeric NULL CHECK (prix_initial IS NULL OR prix_initial >= 0),
  ADD COLUMN IF NOT EXISTS derniere_baisse_le date NULL;

COMMENT ON COLUMN public.biens.mandat_irrevocable_jusqu_au IS
  'Fin de période irrévocable (exclusif / semi-exclusif). Calculé à l''écriture.';

CREATE INDEX IF NOT EXISTS biens_mandat_expiration_idx
  ON public.biens (agency_id, mandat_signe_le)
  WHERE mandat_signe_le IS NOT NULL;

CREATE OR REPLACE FUNCTION public.compute_mandat_irrevocable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.mandat_type IN ('exclusif', 'semi_exclusif') AND NEW.mandat_signe_le IS NOT NULL THEN
    NEW.mandat_irrevocable_jusqu_au := (NEW.mandat_signe_le + interval '3 months')::date;
  ELSE
    NEW.mandat_irrevocable_jusqu_au := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_biens_mandat_irrevocable ON public.biens;
CREATE TRIGGER trg_biens_mandat_irrevocable
  BEFORE INSERT OR UPDATE OF mandat_type, mandat_signe_le ON public.biens
  FOR EACH ROW EXECUTE FUNCTION public.compute_mandat_irrevocable();

-- ---------------------------------------------------------------------------
-- 2) visites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  bien_id uuid NOT NULL REFERENCES public.biens (id) ON DELETE CASCADE,
  contact_id uuid NULL REFERENCES public.contacts (id) ON DELETE SET NULL,
  profile_id uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,

  date_visite timestamptz NOT NULL,
  compte_rendu_acquereur_fait_le timestamptz NULL,
  compte_rendu_vendeur_fait_le timestamptz NULL,
  retour text NULL,
  interet text NULL CHECK (interet IS NULL OR interet IN ('aucun', 'tiede', 'chaud', 'offre')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visites_agency_profile_idx ON public.visites (agency_id, profile_id);
CREATE INDEX IF NOT EXISTS visites_agency_date_idx ON public.visites (agency_id, date_visite DESC);
CREATE INDEX IF NOT EXISTS visites_bien_idx ON public.visites (bien_id, date_visite DESC);

DROP TRIGGER IF EXISTS trg_visites_updated_at ON public.visites;
CREATE TRIGGER trg_visites_updated_at
  BEFORE UPDATE ON public.visites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) offres
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  bien_id uuid NOT NULL REFERENCES public.biens (id) ON DELETE CASCADE,
  contact_id uuid NULL REFERENCES public.contacts (id) ON DELETE SET NULL,

  montant numeric NOT NULL CHECK (montant > 0),
  soumise_le date NOT NULL DEFAULT CURRENT_DATE,
  validite_jusqu_au date NULL,
  statut text NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'acceptee', 'refusee')),
  compromis_signe_le date NULL,
  financement_echeance date NULL,
  preemption_purgee_le date NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offres_agency_validite_idx
  ON public.offres (agency_id, validite_jusqu_au)
  WHERE validite_jusqu_au IS NOT NULL;
CREATE INDEX IF NOT EXISTS offres_agency_financement_idx
  ON public.offres (agency_id, financement_echeance)
  WHERE financement_echeance IS NOT NULL;
CREATE INDEX IF NOT EXISTS offres_bien_idx ON public.offres (bien_id);

DROP TRIGGER IF EXISTS trg_offres_updated_at ON public.offres;
CREATE TRIGGER trg_offres_updated_at
  BEFORE UPDATE ON public.offres
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) promesses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  contact_id uuid NULL REFERENCES public.contacts (id) ON DELETE SET NULL,
  note_id uuid NULL REFERENCES public.voice_notes (id) ON DELETE SET NULL,

  intitule text NOT NULL,
  echeance date NOT NULL,
  statut text NOT NULL DEFAULT 'a_faire'
    CHECK (statut IN ('a_faire', 'faite', 'reportee')),
  cree_par text NOT NULL DEFAULT 'manuel'
    CHECK (cree_par IN ('dictee', 'manuel')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promesses_agency_profile_echeance_idx
  ON public.promesses (agency_id, profile_id, echeance);
CREATE INDEX IF NOT EXISTS promesses_agency_echeance_idx
  ON public.promesses (agency_id, echeance)
  WHERE statut = 'a_faire';

DROP TRIGGER IF EXISTS trg_promesses_updated_at ON public.promesses;
CREATE TRIGGER trg_promesses_updated_at
  BEFORE UPDATE ON public.promesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5) rendez_vous
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rendez_vous (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  contact_id uuid NULL REFERENCES public.contacts (id) ON DELETE SET NULL,
  bien_id uuid NULL REFERENCES public.biens (id) ON DELETE SET NULL,

  debut timestamptz NOT NULL,
  fin timestamptz NOT NULL,
  type text NOT NULL DEFAULT 'autre'
    CHECK (type IN ('visite', 'estimation', 'signature', 'autre')),
  lieu text NULL,
  cree_par text NOT NULL DEFAULT 'manuel'
    CHECK (cree_par IN ('dictee', 'fiche_bien', 'manuel')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rendez_vous_fin_apres_debut CHECK (fin > debut)
);

CREATE INDEX IF NOT EXISTS rendez_vous_agency_profile_debut_idx
  ON public.rendez_vous (agency_id, profile_id, debut);
CREATE INDEX IF NOT EXISTS rendez_vous_agency_debut_idx
  ON public.rendez_vous (agency_id, debut);

DROP TRIGGER IF EXISTS trg_rendez_vous_updated_at ON public.rendez_vous;
CREATE TRIGGER trg_rendez_vous_updated_at
  BEFORE UPDATE ON public.rendez_vous
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6) RLS — isolation par agence active
-- ---------------------------------------------------------------------------
ALTER TABLE public.visites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rendez_vous ENABLE ROW LEVEL SECURITY;

-- visites
DROP POLICY IF EXISTS visites_select_agency ON public.visites;
CREATE POLICY visites_select_agency ON public.visites
  FOR SELECT TO authenticated USING (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS visites_insert_agency ON public.visites;
CREATE POLICY visites_insert_agency ON public.visites
  FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS visites_update_agency ON public.visites;
CREATE POLICY visites_update_agency ON public.visites
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS visites_delete_agency ON public.visites;
CREATE POLICY visites_delete_agency ON public.visites
  FOR DELETE TO authenticated USING (agency_id = public.current_user_agency_id());

-- offres
DROP POLICY IF EXISTS offres_select_agency ON public.offres;
CREATE POLICY offres_select_agency ON public.offres
  FOR SELECT TO authenticated USING (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS offres_insert_agency ON public.offres;
CREATE POLICY offres_insert_agency ON public.offres
  FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS offres_update_agency ON public.offres;
CREATE POLICY offres_update_agency ON public.offres
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS offres_delete_agency ON public.offres;
CREATE POLICY offres_delete_agency ON public.offres
  FOR DELETE TO authenticated USING (agency_id = public.current_user_agency_id());

-- promesses
DROP POLICY IF EXISTS promesses_select_agency ON public.promesses;
CREATE POLICY promesses_select_agency ON public.promesses
  FOR SELECT TO authenticated USING (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS promesses_insert_agency ON public.promesses;
CREATE POLICY promesses_insert_agency ON public.promesses
  FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS promesses_update_agency ON public.promesses;
CREATE POLICY promesses_update_agency ON public.promesses
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS promesses_delete_agency ON public.promesses;
CREATE POLICY promesses_delete_agency ON public.promesses
  FOR DELETE TO authenticated USING (agency_id = public.current_user_agency_id());

-- rendez_vous
DROP POLICY IF EXISTS rendez_vous_select_agency ON public.rendez_vous;
CREATE POLICY rendez_vous_select_agency ON public.rendez_vous
  FOR SELECT TO authenticated USING (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS rendez_vous_insert_agency ON public.rendez_vous;
CREATE POLICY rendez_vous_insert_agency ON public.rendez_vous
  FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS rendez_vous_update_agency ON public.rendez_vous;
CREATE POLICY rendez_vous_update_agency ON public.rendez_vous
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id())
  WITH CHECK (agency_id = public.current_user_agency_id());
DROP POLICY IF EXISTS rendez_vous_delete_agency ON public.rendez_vous;
CREATE POLICY rendez_vous_delete_agency ON public.rendez_vous
  FOR DELETE TO authenticated USING (agency_id = public.current_user_agency_id());
