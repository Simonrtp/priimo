import { LeadsTable } from '@/components/LeadsTable';
import { PageHeader } from '@/components/Panel';
import { fetchAgencyOptions, fetchAllLeads } from '@/lib/queries/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { agency?: string; status?: string; type?: string; minScore?: string };
}) {
  const filters = {
    agencyId: searchParams.agency,
    status: searchParams.status,
    ownerType: searchParams.type,
    minScore: searchParams.minScore ? Number(searchParams.minScore) : undefined,
  };

  const [leads, agencies] = await Promise.all([fetchAllLeads(filters), fetchAgencyOptions()]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Leads"
        subtitle={`Tous les leads cross-agences — lecture seule — ${leads.length} chargé(s)`}
      />
      <LeadsTable
        leads={leads}
        agencies={agencies}
        initialFilters={{
          agencyId: searchParams.agency,
          status: searchParams.status,
          ownerType: searchParams.type,
          minScore: searchParams.minScore,
        }}
      />
    </div>
  );
}
