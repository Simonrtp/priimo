import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleContactsFor } from '@/lib/agency/scope-records';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { fetchContactsSafe } from '@/lib/queries/contacts';
import { fetchBiensSafe } from '@/lib/queries/biens';
import ContactsClient from '@/components/dashboard/contacts/ContactsClient';

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ fiche?: string; filtre?: string }>;
}) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const supabase = await createSupabaseServerClient();
  const [contacts, biens, members] = await Promise.all([
    fetchContactsSafe(supabase),
    fetchBiensSafe(supabase),
    fetchMembersOfMyAgency(agency.id, memberships),
  ]);

  const visible = visibleContactsFor(viewerFromProfile(profile), contacts);
  const { fiche, filtre } = await searchParams;
  const selected = fiche && visible.some((c) => c.id === fiche) ? fiche : null;
  const listFilter =
    filtre === 'sans-position' || filtre === 'vendeurs-inactifs' ? filtre : null;

  return (
    <ContactsClient
      initialContacts={visible}
      biens={biens}
      initialSelectedContactId={selected}
      members={members}
      currentUserId={profile.id}
      isDirector={profile.role === 'directeur'}
      listFilter={listFilter}
    />
  );
}
