import AccueilSquelette from '@/components/dashboard/accueil/AccueilSquelette';

/** Chargement de L'agence : les mêmes cartes grises que l'accueil. */
export default function SqueletteAgence() {
  return (
    <div data-accueil-agence className="flex w-full min-w-0 flex-col gap-4 pb-10" aria-busy="true">
      <span className="sr-only">Chargement de l’agence</span>
      <AccueilSquelette mobile={false} />
    </div>
  );
}
