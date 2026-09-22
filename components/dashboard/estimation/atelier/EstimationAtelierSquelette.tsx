/** Fond et cartes de l’atelier, affichés dès le clic — avant les données. */

function Carte({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-clay bg-black/[0.05] ${className}`} aria-hidden />;
}

export default function EstimationAtelierSquelette() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Chargement de l’estimation">
      <Carte className="h-10 w-44" />
      <div className="flex flex-wrap gap-1 border-b border-black/[0.06] pb-2">
        {[72, 56, 88, 80, 70].map((w) => (
          <div
            key={w}
            className="h-11 animate-pulse rounded-full bg-black/[0.05]"
            style={{ width: w }}
            aria-hidden
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div className="flex flex-col gap-3">
          <Carte className="h-16" />
          <Carte className="h-16" />
          <Carte className="h-16" />
          <Carte className="h-40" />
        </div>
        <div className="flex flex-col gap-3">
          <Carte className="h-48" />
          <Carte className="h-32" />
        </div>
      </div>
    </div>
  );
}
