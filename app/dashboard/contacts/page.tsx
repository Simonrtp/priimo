import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleContactsFor } from '@/lib/agency/scope-records';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import {
  fetchContactsSafe,
  fetchLatestInteractionsSafe,
  fetchLeadAddressesSafe,
} from '@/lib/queries/contacts';
import { fetchBiensSafe } from '@/lib/queries/biens';
import ContactsClient from '@/components/dashboard/contacts/ContactsClient';
import {
  fetchPastRendezVousSafe,
  sansSuiteContactIds,
} from '@/lib/queries/rendez-vous-sans-suite';

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
  const [latestInteractions, leadAddresses] = await Promise.all([
    fetchLatestInteractionsSafe(
      supabase,
      visible.map((c) => c.id),
    ),
    fetchLeadAddressesSafe(
      supabase,
      visible.map((c) => c.leadId).filter((id): id is string => Boolean(id)),
    ),
  ]);
  const { fiche, filtre } = await searchParams;
  const selected = fiche && visible.some((c) => c.id === fiche) ? fiche : null;
  const listFilter =
    filtre === 'sans-position' ||
    filtre === 'vendeurs-inactifs' ||
    filtre === 'rdv-sans-suite'
      ? filtre
      : null;

  let rdvSansSuiteIds: string[] = [];
  if (listFilter === 'rdv-sans-suite') {
    const rdv = await fetchPastRendezVousSafe(supabase);
    const last: Record<string, string | null> = {};
    for (const c of visible) last[c.id] = c.lastInteractionAt;
    rdvSansSuiteIds = sansSuiteContactIds(rdv, last);
  }

  return (
    <ContactsClient
      initialContacts={visible}
      biens={biens}
      latestInteractions={latestInteractions}
      leadAddresses={leadAddresses}
      initialSelectedContactId={selected}
      members={members}
      currentUserId={profile.id}
      isDirector={profile.role === 'directeur'}
      listFilter={listFilter}
      listFilterIds={rdvSansSuiteIds}
    />
  );
}
