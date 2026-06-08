import { Inbox, SlidersHorizontal } from 'lucide-react';

interface EmptyStateProps {
  variant?: 'no-leads' | 'no-filtered-results';
  onResetFilters?: () => void;
}

export default function EmptyState({ variant = 'no-leads', onResetFilters }: EmptyStateProps) {
  if (variant === 'no-leads') {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-black/8 bg-white px-4 py-16 text-center sm:px-6 sm:py-20">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-soft-gray">
          <Inbox size={28} className="text-mute" strokeWidth={1.5} aria-hidden />
        </div>
        <p className="font-semibold text-ink" style={{ fontSize: 16 }}>
          Aucun prospect pour le moment
        </p>
        <p className="mt-2 max-w-md text-mute" style={{ fontSize: 13, lineHeight: 1.55 }}>
          Vos premiers prospects scorés arriveront bientôt. Vous serez notifié par email dès qu&apos;ils
          seront disponibles.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-black/8 bg-white px-4 py-16 text-center sm:px-6">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-gray">
        <SlidersHorizontal size={20} className="text-mute" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="font-semibold text-ink" style={{ fontSize: 15 }}>
        Aucun prospect ne correspond
      </p>
      <p className="mt-1 text-mute" style={{ fontSize: 13 }}>
        Essayez d&apos;ajuster vos filtres
      </p>
      {onResetFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-4 rounded-lg border border-black/10 px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-black/[0.04]"
        >
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );
}
