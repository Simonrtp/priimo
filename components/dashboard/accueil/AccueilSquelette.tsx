/**
 * Chargement : quelques cartes grises. Le voile les traverse, elles ne clignotent pas.
 */
export default function AccueilSquelette({ mobile }: { mobile: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement de l’accueil</span>
      <div className="squelette h-28 rounded-clay-lg" />
      <div className={`grid gap-4 ${mobile ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="squelette h-32 rounded-clay-lg" />
        ))}
      </div>
      <div className={`grid gap-4 ${mobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <div className="squelette h-56 rounded-clay-lg" />
        <div className="squelette h-56 rounded-clay-lg" />
      </div>
    </div>
  );
}

/** La rangée du haut, le temps que le titre et la période arrivent. */
export function EnteteSquelette() {
  return (
    <header className="flex items-center justify-between gap-4" aria-hidden>
      <div className="squelette h-7 w-40 rounded-xl" />
      <div className="squelette h-9 w-52 rounded-full" />
    </header>
  );
}
