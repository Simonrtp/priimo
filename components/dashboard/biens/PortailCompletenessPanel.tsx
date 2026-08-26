import type { Annonce, PortailId } from '@/lib/diffusion/types';
import { assessAnnonceForPortail, PORTAIL_LABELS } from '@/lib/diffusion';

/**
 * Affiche ce qui manque portail par portail avant toute tentative d'envoi.
 * Design clay — aucun emoji.
 */
export default function PortailCompletenessPanel({
  annonce,
  portails,
}: {
  annonce: Annonce;
  portails: PortailId[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] leading-relaxed text-text-muted">
        Les abonnements SeLoger Pro, Bien&apos;ici Pro et Logic-Immo restent facturés directement
        à l&apos;agence — ils ne sont pas inclus dans l&apos;abonnement Priimo.
      </p>
      {portails.map((portail) => {
        const { blockers, warnings } = assessAnnonceForPortail(annonce, portail);
        const ready = blockers.length === 0;
        return (
          <div
            key={portail}
            className="rounded-clay border border-black/[0.06] bg-surface px-4 py-3 shadow-clay-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-text-strong" style={{ fontSize: 14 }}>
                {PORTAIL_LABELS[portail]}
              </h3>
              <span
                className={
                  ready
                    ? 'text-[11px] font-medium uppercase tracking-wide text-emerald-700'
                    : 'text-[11px] font-medium uppercase tracking-wide text-amber-700'
                }
              >
                {ready ? 'Prêt' : 'Incomplet'}
              </span>
            </div>
            {blockers.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-text">
                {blockers.map((b) => (
                  <li key={b.field}>{b.label}</li>
                ))}
              </ul>
            ) : null}
            {warnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12.5px] text-text-muted">
                {warnings.map((w) => (
                  <li key={w.field}>{w.label}</li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
