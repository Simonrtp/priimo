import { redirect } from 'next/navigation';
import { agencyNeedsOnboarding } from '@/lib/auth/agency-onboarding';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { UserProvider } from '@/components/providers/UserProvider';
import Sidebar from '@/components/dashboard/Sidebar';
import TopBar from '@/components/dashboard/TopBar';
import MobileBottomNav from '@/components/dashboard/MobileBottomNav';
import { PLAN_LEADS_QUOTA } from '@/lib/plan-meta';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');
  if (profile.role === 'directeur' && agencyNeedsOnboarding(agency)) redirect('/onboarding');

  const supabase = await createSupabaseServerClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: leadsThisMonth } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart.toISOString());

  const monthlyQuota = PLAN_LEADS_QUOTA[agency.plan];

  return (
    <UserProvider user={user} profile={profile} agency={agency}>
      <div className="flex bg-canvas" style={{ height: '100vh', overflow: 'hidden' }}>
        <Sidebar leadsThisMonth={leadsThisMonth ?? 0} monthlyQuota={monthlyQuota} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="max-md:pb-[calc(5rem+env(safe-area-inset-bottom))] flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </UserProvider>
  );
}
