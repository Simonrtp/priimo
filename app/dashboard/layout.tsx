import { redirect } from 'next/navigation';
import { agencyNeedsOnboarding } from '@/lib/auth/agency-onboarding';
import { getServerUser } from '@/lib/auth/getServerUser';
import { getDevice } from '@/lib/device-server';
import { beginDashboardTiming, markServerTimingReady, timed } from '@/lib/perf/timing';
import { UserProvider } from '@/components/providers/UserProvider';
import DeviceProvider from '@/components/dashboard/device/DeviceProvider';
import DeviceSync from '@/components/dashboard/device/DeviceSync';
import Sidebar from '@/components/dashboard/Sidebar';
import TopBar from '@/components/dashboard/TopBar';
import MobileBottomNav from '@/components/dashboard/MobileBottomNav';
import DashboardTourProvider from '@/components/dashboard/tour/TourProvider';
import VoiceCaptureProvider from '@/components/dashboard/voice/VoiceCaptureProvider';
import AssistantProvider from '@/components/dashboard/assistant/AssistantProvider';
import WorkspacePanel from '@/components/dashboard/workspace/WorkspacePanel';
import MobileChrome, { MobileBackSwipe } from './_mobile/MobileChrome';
import { SHELL_BG_CLASS } from '@/lib/today/field';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  beginDashboardTiming();
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');
  if (profile.role === 'directeur' && agencyNeedsOnboarding(agency)) redirect('/onboarding');

  const device = await timed('getDevice(layout)', () => getDevice());
  const isMobile = device === 'mobile';

  const tree = (
    <UserProvider user={user} profile={profile} agency={agency} memberships={memberships}>
      <DeviceProvider device={device}>
        <DeviceSync serverDevice={device} />
        <DashboardTourProvider>
          <VoiceCaptureProvider>
            <AssistantProvider>
                {isMobile ? (
                  <div className="dashboard-mobile flex h-dvh flex-col overflow-hidden overscroll-none bg-bg-base">
                    <MobileChrome />
                    <main
                      className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-none"
                      style={{ paddingBottom: 'var(--field-nav-height)' }}
                    >
                      {children}
                    </main>
                    <MobileBottomNav />
                    <MobileBackSwipe />
                  </div>
                ) : (
                  <div className="flex h-dvh min-h-0 overflow-hidden">
                    <Sidebar />
                    <div className={`${SHELL_BG_CLASS} relative flex min-w-0 flex-1 flex-col`}>
                      <TopBar />
                      <main className="relative min-h-0 flex-1 overflow-hidden rounded-tl-[28px] bg-bg-base max-md:px-4 max-md:pb-[calc(7rem+env(safe-area-inset-bottom))] md:rounded-tl-[32px] md:p-3 md:pb-4 lg:p-4 lg:pb-5">
                        <WorkspacePanel>{children}</WorkspacePanel>
                      </main>
                    </div>
                    <MobileBottomNav />
                  </div>
                )}
            </AssistantProvider>
          </VoiceCaptureProvider>
        </DashboardTourProvider>
      </DeviceProvider>
    </UserProvider>
  );

  markServerTimingReady();
  return tree;
}
