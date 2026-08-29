import { redirect } from 'next/navigation';
import { carteVersProspectionHref } from '@/lib/prospection/vue';

export const metadata = {
  title: 'Carte',
};

/** Ancienne entrée « Carte » : la carte vit dans Prospection. */
export default async function CartePage({
  searchParams,
}: {
  searchParams: Promise<{ immeuble?: string; itineraire?: string; tournee?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.immeuble) qs.set('immeuble', params.immeuble);
  if (params.itineraire) qs.set('itineraire', params.itineraire);
  if (params.tournee) qs.set('tournee', params.tournee);
  redirect(carteVersProspectionHref(qs));
}
