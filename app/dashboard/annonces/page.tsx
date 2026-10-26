import { redirect } from 'next/navigation';

/**
 * Les annonces se lisent dans la Liste de Prospection (et sur sa carte, « Voir
 * mes annonces ») : les anciens liens (notifications, brief du matin) y mènent.
 */
export default async function AnnoncesPage({
  searchParams,
}: {
  searchParams: Promise<{ annonce?: string }>;
}) {
  const { annonce } = await searchParams;
  redirect(
    annonce
      ? `/dashboard/prospection?vue=liste&annonce=${encodeURIComponent(annonce)}`
      : '/dashboard/prospection?vue=liste',
  );
}
