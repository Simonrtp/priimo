import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/getServerUser';
import EstimationDashboardClient from '@/components/dashboard/estimation/EstimationDashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardEstimationPage() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl py-8 text-[14px] text-mute">Chargement…</div>
      }
    >
      <EstimationDashboardClient
        agencyName={agency.name}
        sectorPostcodes={agency.codes_postaux ?? []}
      />
    </Suspense>
  );
}
