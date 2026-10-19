import AccueilSquelette, { EnteteSquelette } from './AccueilSquelette';

/** Cartes grises, visibles avant les blocs lourds de l’Accueil. */
export default function AccueilAmorce({
  mobile,
}: {
  periodeDemandee: string | null;
  ancreDemandee?: string | null;
  finDemandee?: string | null;
  mobile: boolean;
}) {
  return (
    <div data-accueil className="flex w-full min-w-0 flex-col gap-4 pb-10">
      <EnteteSquelette />
      <AccueilSquelette mobile={mobile} />
    </div>
  );
}
