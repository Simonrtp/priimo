'use client';

import { useEffect, useMemo, useState } from 'react';
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
  peutSupprimer = false,
  cartes = 0,
  vers = null,
  suppression = false,
  onSupprimer,
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
  /** Pris, la colonne d'entrée, ne se supprime pas. */
  peutSupprimer?: boolean;
  cartes?: number;
  vers?: string | null;
  suppression?: boolean;
  onSupprimer?: () => void;
}) {
  const [confirme, setConfirme] = useState(false);
  useEffect(() => {
    if (!open) setConfirme(false);
  }, [open]);
  const couleurs = useMemo(() => {
    const connue = COULEURS_COLONNE.some((c) => memeCouleur(c, accentColor));
    return connue ? [...COULEURS_COLONNE] : [accentColor, ...COULEURS_COLONNE];
  }, [accentColor]);

  return (
    <Modal
      open={open}
      onClose={saving || suppression ? () => undefined : onCancel}
      title={mode === 'create' ? 'Nouvelle colonne' : 'Modifier la colonne'}
      description="Choisissez d'abord une couleur, puis donnez un nom à la colonne."
      maxWidth="sm"
    >
      <div className="space-y-5">
        <div>
          <p className="text-[12px] font-semibold uppercase text-text-subtle">Couleur</p>
          <div className="mt-3 grid grid-cols-8 gap-2">
            {couleurs.map((color, index) => {
              const active = memeCouleur(accentColor, color);
              return (
                <button
                  key={`${color}-${index}`}
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
        {confirme ? (
          <p className="text-[13px] text-text-muted">
            {cartes === 0
              ? 'La colonne disparaît.'
              : cartes === 1
                ? `La carte passe dans « ${vers} ».`
                : `Les ${cartes} cartes passent dans « ${vers} ».`}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {mode === 'edit' && peutSupprimer && onSupprimer ? (
            <button
              type="button"
              disabled={saving || suppression}
              onClick={() => {
                if (!confirme) {
                  setConfirme(true);
                  return;
                }
                onSupprimer();
              }}
              className="text-[13px] font-semibold text-[var(--danger)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)] disabled:opacity-50"
            >
              {suppression ? 'Suppression…' : confirme ? 'Supprimer vraiment' : 'Supprimer'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <WorkspaceButton type="button" variant="secondary" onClick={onCancel} disabled={saving || suppression}>
              Annuler
            </WorkspaceButton>
            <WorkspaceButton
              type="button"
              onClick={onConfirm}
              busy={saving}
              disabled={suppression || libelle.trim().length < 2}
            >
              {mode === 'create' ? 'Créer la colonne' : 'Valider'}
            </WorkspaceButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
