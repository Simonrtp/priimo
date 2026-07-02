import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { Panel, PageHeader } from '@/components/Panel';
import { NotesButton } from '@/components/notes/NotesButton';
import { getNotesByEntity } from '@/lib/notes/store';
import { fetchAgenciesWithCounts } from '@/lib/queries/admin';
import { PLAN_LABELS, formatDate } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AgencesPage() {
  const [agencies, agencyNotes] = await Promise.all([
    fetchAgenciesWithCounts(),
    getNotesByEntity('agency'),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Agences" subtitle={`${agencies.length} agence(s) — lecture seule`} />

      <Panel bodyClassName="overflow-x-auto">
        {agencies.length === 0 ? (
          <EmptyState icon={Building2} title="Aucune agence" description="Aucune agence enregistrée en base." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Plan</th>
                <th>Créée le</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Membres</th>
                <th>Statut</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((agency) => (
                <tr key={agency.id}>
                  <td>
                    <Link
                      href={`/agences/${agency.id}`}
                      className="font-medium text-white transition hover:text-indigo-300"
                    >
                      {agency.name}
                    </Link>
                  </td>
                  <td className="text-white/60">{PLAN_LABELS[agency.plan] ?? agency.plan}</td>
                  <td className="whitespace-nowrap text-white/50">{formatDate(agency.created_at)}</td>
                  <td className="text-right font-semibold tabular-nums text-white">{agency.leadsCount}</td>
                  <td className="text-right tabular-nums text-white/70">{agency.membersCount}</td>
                  <td>
                    <Badge
                      variant={
                        agency.statusLabel === 'Active'
                          ? 'success'
                          : agency.statusLabel === 'Sans membres'
                            ? 'muted'
                            : 'warning'
                      }
                    >
                      {agency.statusLabel}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap">
                    <NotesButton
                      entityType="agency"
                      entityId={agency.id}
                      title={agency.name}
                      subtitle={PLAN_LABELS[agency.plan] ?? agency.plan}
                      initialNotes={agencyNotes.get(agency.id) ?? []}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
