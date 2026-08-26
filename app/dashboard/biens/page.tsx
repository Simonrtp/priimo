import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { fetchBiensSafe } from '@/lib/queries/biens';
import { fetchContactsSafe } from '@/lib/queries/contacts';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleContactsFor } from '@/lib/agency/scope-records';
import BiensClient from '@/components/dashboard/biens/BiensClient';
import { fetchVisitCountByBienIdSafe } from '@/lib/queries/metier-today';

export default async function BiensPage({
  searchParams,
}: {
  searchParams: Promise<{ fiche?: string; filtre?: string; membre?: string }>;
}) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const supabase = await createSupabaseServerClient();
  const [biens, contacts] = await Promise.all([
    fetchBiensSafe(supabase),
    fetchContactsSafe(supabase),
  ]);

  const visibleContacts = visibleContactsFor(viewerFromProfile(profile), contacts);
  const { fiche, filtre, membre } = await searchParams;
  const selected = fiche && biens.some((b) => b.id === fiche) ? fiche : null;
  const listFilter =
    filtre === 'sans-position' ||
    filtre === 'mandats-endormis' ||
    filtre === 'mandats-actifs' ||
    filtre === 'mandats-exclusifs' ||
    filtre === 'mandats-60j'
      ? filtre
      : null;

  const visitCountByBienId =
    listFilter === 'mandats-60j' ? await fetchVisitCountByBienIdSafe(supabase) : {};

  return (
    <BiensClient
      initialBiens={biens}
      contacts={visibleContacts}
      initialSelectedBienId={selected}
      listFilter={listFilter}
      memberId={membre ?? null}
      visitCountByBienId={visitCountByBienId}
    />
  );
}
