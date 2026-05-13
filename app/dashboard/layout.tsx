import Sidebar from '@/components/dashboard/Sidebar';
import TopBar from '@/components/dashboard/TopBar';
import MobileBottomNav from '@/components/dashboard/MobileBottomNav';
import { DashboardRoleProvider } from '@/components/dashboard/DashboardRoleContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardRoleProvider>
      <div className="flex bg-canvas" style={{ height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="max-md:pb-[calc(5rem+env(safe-area-inset-bottom))] flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </DashboardRoleProvider>
  );
}
