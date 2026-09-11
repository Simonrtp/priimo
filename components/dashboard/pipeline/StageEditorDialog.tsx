'use client';

import { useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { COULEURS_COLONNE } from '@/lib/pipeline/stage-theme';

export const STAGE_COLOR_OPTIONS = COULEURS_COLONNE;

function memeCouleur(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export default function StageEditorDialog({
  open,
  mode,
  libelle,
  accentColor,
  saving,
  error,
  onLibelleChange,
  onAccentColorChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  libelle: string;
  accentColor: string;
  saving: boolean;
  error: string | null;
  onLibelleChange: (value: string) => void;
  onAccentColorChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const couleurs = useMemo(() => {
    const connue = COULEURS_COLONNE.some((c) => memeCouleur(c, accentColor));
    return connue ? [...COULEURS_COLONNE] : [accentColor, ...COULEURS_COLONNE];
  }, [accentColor]);

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onCancel}
      title={mode === 'create' ? 'Nouvelle colonne' : 'Modifier la colonne'}
      description="Choisissez d'abord une couleur, puis donnez un nom à la colonne."
      maxWidth="sm"
    >
      <div className="space-y-5">
        <div>
          <p className="text-[12px] font-semibold uppercase text-text-subtle">Couleur</p>
          <div className="mt-3 grid grid-cols-8 gap-2">
            {couleurs.map((color) => {
              const active = memeCouleur(accentColor, color);
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={`Choisir la couleur ${color}`}
                  aria-pressed={active}
                  onClick={() => onAccentColorChange(color)}
                  className={`size-8 rounded-[10px] transition-transform duration-150 ease-out ${
                    active ? 'scale-105 ring-2 ring-black/30 ring-offset-2' : 'ring-1 ring-black/10'
                  }`}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="text-[12px] font-semibold uppercase text-text-subtle">
            Nom de la colonne
          </span>
          <input
            value={libelle}
            onChange={(e) => onLibelleChange(e.target.value)}
            placeholder="Ex. Qualifié, Visite, Offre"
            className="mt-2 min-h-[44px] w-full rounded-xl border border-black/[0.10] bg-white px-3 py-2.5 text-[14px] text-text outline-none transition-colors duration-fluid-subtle ease-in-out placeholder:text-text-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
          />
        </label>

        {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <WorkspaceButton type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Annuler
          </WorkspaceButton>
          <WorkspaceButton type="button" onClick={onConfirm} disabled={libelle.trim().length < 2}>
            {mode === 'create' ? 'Créer la colonne' : 'Valider'}
          </WorkspaceButton>
        </div>
      </div>
    </Modal>
  );
}
