import { redirect } from 'next/navigation';
import AdminAssistantUsageClient from '@/components/admin/AdminAssistantUsageClient';
import { getServerUser } from '@/lib/auth/getServerUser';
import { isAdminEmail } from '@/lib/auth/requireAdmin';

export const metadata = {
  title: 'Admin — Assistant',
};

export default async function AdminAssistantPage() {
  const { user } = await getServerUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect('/dashboard');
  }

  return <AdminAssistantUsageClient />;
}
