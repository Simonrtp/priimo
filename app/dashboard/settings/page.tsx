import { notFound } from 'next/navigation';
import { getServerUser } from '@/lib/auth/getServerUser';
import SettingsDashboard from '@/components/dashboard/settings/SettingsDashboard';

type SettingsTabId = 'agency' | 'team' | 'billing' | 'notifications' | 'profile' | 'security';
const DIRECTOR_ONLY: ReadonlySet<SettingsTabId> = new Set(['agency', 'team', 'billing']);
const VALID_TABS: ReadonlySet<SettingsTabId> = new Set([
  'agency',
  'team',
  'billing',
  'notifications',
  'profile',
  'security',
]);

function parseTab(raw: string | string[] | undefined): SettingsTabId | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_TABS.has(raw as SettingsTabId) ? (raw as SettingsTabId) : undefined;
}

interface PageProps {
  searchParams: Promise<{ tab?: string | string[] }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const { profile } = await getServerUser();
  if (!profile) notFound();

  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  if (tab && DIRECTOR_ONLY.has(tab) && profile.role !== 'directeur') {
    notFound();
  }

  return <SettingsDashboard initialTab={tab} />;
}
