'use client';

import Modal from '@/components/ui/Modal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';

export const STAGE_COLOR_OPTIONS = [
  '#64748B',
  '#4A90E2',
  '#1D5FCC',
  '#E8743C',
  '#B45309',
  '#2E8B57',
  '#D16B5B',
] as const;

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
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
            Couleur
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {STAGE_COLOR_OPTIONS.map((color) => {
              const active = accentColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={`Choisir la couleur ${color}`}
                  aria-pressed={active}
                  onClick={() => onAccentColorChange(color)}
                  className={`flex size-10 items-center justify-center rounded-full border transition-transform duration-150 ease-out ${
                    active ? 'scale-110 border-black/20' : 'border-black/10'
                  }`}
                  style={{ backgroundColor: color }}
                >
                  <span
                    className={`size-3 rounded-full bg-white/90 transition-opacity ${
                      active ? 'opacity-100' : 'opacity-0'
                    }`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
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
          <WorkspaceButton type="button" onClick={onConfirm} disabled={saving || libelle.trim().length < 2}>
            {saving ? 'Enregistrement…' : mode === 'create' ? 'Créer la colonne' : 'Enregistrer'}
          </WorkspaceButton>
        </div>
      </div>
    </Modal>
  );
}
