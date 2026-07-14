import { redirect } from 'next/navigation';
import AdminAgenciesClient from '@/components/admin/AdminAgenciesClient';
import { getServerUser } from '@/lib/auth/getServerUser';
import { isAdminEmail } from '@/lib/auth/requireAdmin';

export const metadata = {
  title: 'Admin — Agences',
};

export default async function AdminAgenciesPage() {
  const { user } = await getServerUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect('/dashboard');
  }

  return <AdminAgenciesClient />;
}
