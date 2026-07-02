import { Users } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { RelanceBadge } from '@/components/RelanceBadge';
import { EmptyState } from '@/components/EmptyState';
import { Panel, PageHeader } from '@/components/Panel';
import { NotesButton } from '@/components/notes/NotesButton';
import { getNotesByEntity } from '@/lib/notes/store';
import { fetchAllProfiles } from '@/lib/queries/admin';
import { ROLE_LABELS, formatDate } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UtilisateursPage() {
  const [profiles, profileNotes] = await Promise.all([
    fetchAllProfiles(),
    getNotesByEntity('profile'),
  ]);

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
                <th>Relance fondateur</th>
                <th>Notes</th>
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
                  <td className="whitespace-nowrap text-white/50">{formatDate(p.created_at)}</td>
                  <td className="whitespace-nowrap">
                    {p.role === 'directeur' ? (
                      <RelanceBadge registeredAt={p.created_at} size="sm" />
                    ) : (
                      <span className="text-white/25">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <NotesButton
                      entityType="profile"
                      entityId={p.id}
                      title={`${p.first_name} ${p.last_name}`}
                      subtitle={p.agency_name}
                      initialNotes={profileNotes.get(p.id) ?? []}
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
