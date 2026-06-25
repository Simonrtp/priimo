import { Users } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { DirectorFollowupHint } from '@/components/DirectorFollowupHint';
import { EmptyState } from '@/components/EmptyState';
import { Panel, PageHeader } from '@/components/Panel';
import { fetchAllProfiles } from '@/lib/queries/admin';
import { ROLE_LABELS, formatDate } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UtilisateursPage() {
  const profiles = await fetchAllProfiles();

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Utilisateurs" subtitle={`${profiles.length} profil(s) — lecture seule`} />

      <Panel bodyClassName="overflow-x-auto">
        {profiles.length === 0 ? (
          <EmptyState icon={Users} title="Aucun utilisateur" description="Aucun profil enregistré." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Agence</th>
                <th>Téléphone</th>
                <th>Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-white/85">
                    {p.first_name} {p.last_name}
                  </td>
                  <td className="text-white/60">{p.email}</td>
                  <td>
                    <Badge variant={p.role === 'directeur' ? 'info' : 'default'}>
                      {ROLE_LABELS[p.role] ?? p.role}
                    </Badge>
                  </td>
                  <td className="max-w-[180px] truncate text-white/60">{p.agency_name}</td>
                  <td className="text-white/60">{p.phone ?? '—'}</td>
                  <td className="whitespace-nowrap text-white/50">
                    {formatDate(p.created_at)}
                    {p.role === 'directeur' ? (
                      <DirectorFollowupHint registeredAt={p.created_at} />
                    ) : null}
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
