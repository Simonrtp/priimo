import { notFound, redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/getServerUser';
import { fetchTeamSettingsData } from '@/lib/queries/team-settings';
import SettingsDashboard, { type SettingsTabId } from '@/components/dashboard/settings/SettingsDashboard';

const DIRECTOR_ONLY: ReadonlySet<SettingsTabId> = new Set(['agency', 'billing', 'team']);
const VALID_TABS: ReadonlySet<SettingsTabId> = new Set(['agency', 'billing', 'profile', 'team']);

function parseTab(raw: string | string[] | undefined): SettingsTabId | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_TABS.has(raw as SettingsTabId) ? (raw as SettingsTabId) : undefined;
}

interface PageProps {
  searchParams: Promise<{ tab?: string | string[] }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  if (tab && DIRECTOR_ONLY.has(tab) && profile.role !== 'directeur') {
    notFound();
  }

  const team =
    profile.role === 'directeur'
      ? await fetchTeamSettingsData(agency.id, memberships, user.id)
      : null;

  return <SettingsDashboard initialTab={tab} team={team} />;
}
