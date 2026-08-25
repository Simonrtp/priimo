import { redirect } from 'next/navigation';
import { agencyNeedsOnboarding } from '@/lib/auth/agency-onboarding';
import { getServerUser } from '@/lib/auth/getServerUser';
import { getDevice } from '@/lib/device-server';
import { UserProvider } from '@/components/providers/UserProvider';
import DeviceProvider from '@/components/dashboard/device/DeviceProvider';
import DeviceSync from '@/components/dashboard/device/DeviceSync';
import Sidebar from '@/components/dashboard/Sidebar';
import TopBar from '@/components/dashboard/TopBar';
import MobileBottomNav from '@/components/dashboard/MobileBottomNav';
import DashboardTourProvider from '@/components/dashboard/tour/TourProvider';
import VoiceCaptureProvider from '@/components/dashboard/voice/VoiceCaptureProvider';
import AssistantProvider from '@/components/dashboard/assistant/AssistantProvider';
import WorkspaceBackdrop from '@/components/dashboard/workspace/WorkspaceBackdrop';
import MobileChrome, { MobileBackSwipe } from './_mobile/MobileChrome';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');
  if (profile.role === 'directeur' && agencyNeedsOnboarding(agency)) redirect('/onboarding');

  const device = await getDevice();
  const isMobile = device === 'mobile';

  return (
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
                  <div
                    className="flex overflow-hidden"
                    style={{
                      height: '100dvh',
                      background: 'linear-gradient(180deg, #1E3148 0%, #15202F 100%)',
                    }}
                  >
                    <Sidebar />
                    <div
                      className="relative flex min-w-0 flex-1 flex-col"
                      style={{ background: 'linear-gradient(180deg, #1E3148 0%, #15202F 100%)' }}
                    >
                      <TopBar />
                      <main className="relative min-h-0 flex-1 overflow-y-auto rounded-tl-[22px] bg-bg-base max-md:px-4 max-md:pb-[calc(7rem+env(safe-area-inset-bottom))] md:rounded-tl-[26px] md:p-6 lg:p-8">
                        <div className="relative min-h-full">
                          <WorkspaceBackdrop />
                          <div className="relative z-[1]">{children}</div>
                        </div>
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
}
