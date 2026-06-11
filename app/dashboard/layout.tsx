import { redirect } from 'next/navigation';
import { agencyNeedsOnboarding } from '@/lib/auth/agency-onboarding';
import { getServerUser } from '@/lib/auth/getServerUser';
import Footer from '@/components/Footer';
import { UserProvider } from '@/components/providers/UserProvider';
import Sidebar from '@/components/dashboard/Sidebar';
import TopBar from '@/components/dashboard/TopBar';
import MobileBottomNav from '@/components/dashboard/MobileBottomNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');
  if (profile.role === 'directeur' && agencyNeedsOnboarding(agency)) redirect('/onboarding');

  return (
    <UserProvider user={user} profile={profile} agency={agency}>
      <div className="flex bg-canvas" style={{ height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="max-md:px-4 max-md:pt-0 max-md:pb-[calc(5rem+env(safe-area-inset-bottom))] flex-1 overflow-y-auto md:p-8">
            {children}
            <Footer className="mt-12" />
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </UserProvider>
  );
}
