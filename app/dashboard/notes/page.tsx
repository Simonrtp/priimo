import { redirect } from 'next/navigation';
import { lienLectureNote } from '@/lib/notes/lecture';

export const metadata = { title: 'Notes' };

/**
 * La page Notes n'existe plus : la lecture vit sur l'accueil.
 * On conserve l'URL le temps que les anciens liens (mails, cartes du jour)
 * aboutissent encore quelque part.
 */
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; membre?: string }>;
}) {
  const { id, membre } = await searchParams;
  const cible = new URL(lienLectureNote(id ?? null), 'http://priimo.local');
  if (membre) cible.searchParams.set('membre', membre);
  redirect(`${cible.pathname}${cible.search}`);
}
