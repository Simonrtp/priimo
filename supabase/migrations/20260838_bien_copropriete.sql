-- Obligations FR annonces : copropriété sur le bien (source de vérité).

ALTER TABLE public.biens
  ADD COLUMN IF NOT EXISTS est_copropriete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nombre_lots integer NULL,
  ADD COLUMN IF NOT EXISTS charges_annuelles integer NULL,
  ADD COLUMN IF NOT EXISTS procedure_en_cours boolean NULL;

COMMENT ON COLUMN public.biens.est_copropriete IS
  'Bien en copropriété — déclenche lots / charges / procédure pour la diffusion.';
COMMENT ON COLUMN public.biens.nombre_lots IS
  'Nombre de lots de la copropriété (obligation d''annonce FR).';
COMMENT ON COLUMN public.biens.charges_annuelles IS
  'Charges annuelles de copropriété en euros.';
COMMENT ON COLUMN public.biens.procedure_en_cours IS
  'Procédure en cours affectant la copropriété (à mentionner dans la description).';
