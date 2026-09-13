import { redirect } from 'next/navigation';
import { agencyNeedsOnboarding } from '@/lib/auth/agency-onboarding';
import { getServerUser } from '@/lib/auth/getServerUser';
import { getDevice } from '@/lib/device-server';
import { beginDashboardTiming, markServerTimingReady, timed } from '@/lib/perf/timing';
import { UserProvider } from '@/components/providers/UserProvider';
import { NotificationsProvider } from '@/components/providers/NotificationsProvider';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchNotificationsSafe } from '@/lib/queries/notifications';
import DeviceProvider from '@/components/dashboard/device/DeviceProvider';
import DeviceSync from '@/components/dashboard/device/DeviceSync';
import Sidebar from '@/components/dashboard/Sidebar';
import TopBar from '@/components/dashboard/TopBar';
import MobileBottomNav from '@/components/dashboard/MobileBottomNav';
import VoiceCaptureProvider from '@/components/dashboard/voice/VoiceCaptureProvider';
import AssistantProvider from '@/components/dashboard/assistant/AssistantProvider';
import AssistantPanelProvider from '@/components/dashboard/assistant/AssistantPanelProvider';
import WorkspacePanel from '@/components/dashboard/workspace/WorkspacePanel';
import OfflineQueueProvider from '@/components/dashboard/field/OfflineQueueProvider';
import TourneeDictationProvider from '@/components/dashboard/field/TourneeDictationProvider';
import MobileChrome, { MobileBackSwipe } from './_mobile/MobileChrome';
import TouchScrollGuard from './_mobile/TouchScrollGuard';
import { SHELL_BG_CLASS } from '@/lib/today/field';
import BandeauAbonnement from '@/components/dashboard/abonnement/BandeauAbonnement';
import { motifRestriction } from '@/lib/billing/acces';

/**
 * Pas de `force-dynamic` : ça cassait le cache de navigation client.
 * La page reste rendue à la demande via cookies() dans getServerUser —
 * le HTML n'entre pas dans le Full Route Cache partagé (pas de fuite
 * inter-agences). Le layout App Router persiste entre les routes sœurs.
 */

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  beginDashboardTiming();
  const { user, profile, agency, memberships } = await getServerUser();
  // Pas de profil chargeable : sortir de la session plutôt que /login (boucle middleware).
  if (!user) redirect('/login');
  if (!profile || !agency) redirect('/api/auth/signout');
  if (profile.role === 'directeur' && agencyNeedsOnboarding(agency)) redirect('/onboarding');

  const device = await timed('getDevice(layout)', () => getDevice());
  const isMobile = device === 'mobile';
  const supabase = await createSupabaseServerClient();
  const notifications = await timed('fetchNotifications', () =>
    fetchNotificationsSafe(supabase, { profileId: profile.id, agencyId: agency.id }),
  );
  const motif = motifRestriction(agency);
  const bandeau =
    motif === 'essai' || motif === 'impaye' || motif === 'resilie' ? (
      <BandeauAbonnement motif={motif} directeur={profile.role === 'directeur'} />
    ) : null;

  const tree = (
    <UserProvider user={user} profile={profile} agency={agency} memberships={memberships}>
      <NotificationsProvider key={agency.id} initial={notifications}>
      <DeviceProvider device={device}>
        <DeviceSync serverDevice={device} />
        <OfflineQueueProvider>
          <TourneeDictationProvider>
            <VoiceCaptureProvider>
              <AssistantProvider>
                <AssistantPanelProvider>
                    {isMobile ? (
                      <div className="dashboard-mobile dashboard-fluid flex h-dvh flex-col overflow-hidden overscroll-none bg-bg-base">
                        <TouchScrollGuard />
                        <MobileChrome />
                        <main
                          className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-none bg-bg-base"
                          style={{ paddingBottom: 'var(--field-nav-height)' }}
                        >
                          {bandeau ? <div className="px-4 pt-3">{bandeau}</div> : null}
                          {children}
                        </main>
                        <MobileBottomNav />
                        <MobileBackSwipe />
                      </div>
                    ) : (
                      <div className="dashboard-fluid flex h-dvh min-h-0 overflow-hidden">
                        <Sidebar />
                        <div className={`${SHELL_BG_CLASS} relative flex min-w-0 flex-1 flex-col`}>
                          <TopBar />
                          <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-[28px] bg-bg-base max-md:px-4 max-md:pb-[calc(7rem+env(safe-area-inset-bottom))] md:rounded-tl-[32px] md:p-3 md:pb-4 lg:p-4 lg:pb-5">
                            {bandeau ? <div className="mb-3 shrink-0">{bandeau}</div> : null}
                            <WorkspacePanel>{children}</WorkspacePanel>
                          </main>
                        </div>
                        <MobileBottomNav />
                      </div>
                    )}
                  </AssistantPanelProvider>
                </AssistantProvider>
              </VoiceCaptureProvider>
            </TourneeDictationProvider>
          </OfflineQueueProvider>
      </DeviceProvider>
      </NotificationsProvider>
    </UserProvider>
  );

  markServerTimingReady();
  return tree;
}
