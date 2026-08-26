import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/getServerUser';
import NotesInboxClient from '@/components/dashboard/notes/NotesInboxClient';

export const metadata = { title: 'Notes' };

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; statut?: string; scope?: string; membre?: string }>;
}) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const { id, statut, scope, membre } = await searchParams;
  return (
    <NotesInboxClient
      initialNoteId={id ?? null}
      initialStatut={statut ?? 'tous'}
      initialScope={scope ?? 'moi'}
      initialMembre={membre ?? null}
    />
  );
}
