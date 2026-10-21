import { CalendarDays } from 'lucide-react';

const PILULE_A_VENIR =
  'inline-flex cursor-default items-center rounded-full bg-black/[0.08] px-3 py-1.5 text-[12.5px] font-semibold text-text-muted';

/** Carte grise, le temps que l'agenda arrive. */
export function EmploiDuTempsSquelette() {
  return <div className="squelette h-full min-h-64 rounded-clay-lg" aria-hidden />;
}

/**
 * L’agenda n’est pas encore disponible : même place sur l’Accueil,
 * sans connexion Google, sans configuration.
 */
export function AgendaAVenir() {
  return (
    <section
      aria-disabled="true"
      aria-labelledby="accueil-agenda"
      className="relative flex h-full min-h-64 min-w-0 flex-col rounded-clay-lg bg-black/[0.03] p-5 shadow-clay"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-text-muted"
          aria-hidden
        >
          <CalendarDays size={18} strokeWidth={2.1} />
        </span>
        <div className="min-w-0">
          <h2 id="accueil-agenda" className="text-[15px] font-medium text-text-muted">
            Agenda
          </h2>
          <p className="mt-0.5 text-[12.5px] text-text-muted">Pas encore disponible</p>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none mt-6 hidden min-h-0 flex-1 select-none grid-cols-7 gap-2 sm:grid"
      >
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="rounded-xl bg-black/[0.04]">
            <div className="mx-auto mt-3 h-2.5 w-7 rounded bg-black/[0.06]" />
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-start gap-2.5">
        <p className="text-balance text-[15px] font-semibold text-text-muted">
          Mes rendez-vous de la semaine, à côté de mes adresses
        </p>
        <p className="max-w-[30rem] text-pretty text-[13px] leading-relaxed text-text-muted">
          L’agenda arrivera ici. Il n’est pas encore configurable.
        </p>
        <span className={PILULE_A_VENIR}>À venir</span>
      </div>
    </section>
  );
}

export default function EmploiDuTemps() {
  return <AgendaAVenir />;
}
