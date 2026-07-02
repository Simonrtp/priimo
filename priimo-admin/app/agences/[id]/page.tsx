import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, MapPin, StickyNote, Users } from 'lucide-react';
import { Badge, ScoreBadge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { KpiCard } from '@/components/KpiCard';
import { Panel } from '@/components/Panel';
import { RelanceBadge } from '@/components/RelanceBadge';
import { NotesButton } from '@/components/notes/NotesButton';
import { NotesPanel } from '@/components/notes/NotesPanel';
import { getNotes, getNotesByEntity } from '@/lib/notes/store';
import { fetchAgencyDetail } from '@/lib/queries/admin';
import {
  LEAD_STATUS_LABELS,
  OWNER_TYPE_LABELS,
  PLAN_LABELS,
  ROLE_LABELS,
  extractMainSignal,
  formatDate,
  formatNumber,
  getInvitationStatus,
} from '@/lib/utils/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AgenceDetailPage({ params }: { params: { id: string } }) {
  const [{ agency, profiles, invitations, leads }, agencyNotes, profileNotes] = await Promise.all([
    fetchAgencyDetail(params.id),
    getNotes('agency', params.id),
    getNotesByEntity('profile'),
  ]);
  if (!agency) notFound();

  const scored = leads.filter((l) => typeof l.score === 'number');
  const avgScore = scored.length ? scored.reduce((s, l) => s + l.score, 0) / scored.length : null;

  const infoFields: { label: string; value: string }[] = [
    { label: 'Plan', value: PLAN_LABELS[agency.plan] ?? agency.plan },
    { label: 'Email', value: agency.email ?? '—' },
    { label: 'Téléphone', value: agency.phone ?? '—' },
    { label: 'Adresse', value: agency.address ?? '—' },
    {
      label: 'Zone',
      value:
        agency.zone_type === 'postal_codes'
          ? `CP : ${agency.zone_postal_codes?.join(', ') ?? '—'}`
          : agency.zone_center_address
            ? `${agency.zone_center_address} (${agency.zone_radius_km ?? '?'} km)`
            : '—',
    },
    { label: 'Créée / MAJ', value: `${formatDate(agency.created_at)} · ${formatDate(agency.updated_at)}` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-3">
        <Link
          href="/agences"
          className="inline-flex items-center gap-1.5 text-xs text-white/45 transition hover:text-indigo-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Agences
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{agency.name}</h1>
          <Badge variant="info">{PLAN_LABELS[agency.plan] ?? agency.plan}</Badge>
        </div>
        <p className="font-mono text-[11px] text-white/30">
          ID {agency.id} · créée le {formatDate(agency.created_at)}
        </p>
      </div>

      {/* 3 mini KPIs */}
      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Leads" value={formatNumber(leads.length)} icon={MapPin} accent="sky" />
        <KpiCard label="Membres" value={formatNumber(profiles.length)} icon={Users} accent="indigo" />
        <KpiCard
          label="Score moyen"
          value={avgScore != null ? formatNumber(avgScore, 1) : '—'}
          icon={Mail}
          accent="emerald"
        />
      </section>

      {/* Infos agence */}
      <Panel title="Informations" bodyClassName="grid gap-4 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {infoFields.map((f) => (
          <div key={f.label}>
            <p className="text-[11px] uppercase tracking-widest text-white/35">{f.label}</p>
            <p className="mt-0.5 text-white/80">{f.value}</p>
          </div>
        ))}
      </Panel>

      {/* Notes agence : appels, rendez-vous, suivi commercial */}
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-400" />
            Notes de suivi
          </span>
        }
        subtitle="Appels, rendez-vous, infos à retenir — visible uniquement dans l'admin"
        bodyClassName="p-5"
      >
        <NotesPanel entityType="agency" entityId={agency.id} initialNotes={agencyNotes} />
      </Panel>

      {/* Leads */}
      <Panel title="Leads" subtitle={`${leads.length} lead(s)`} bodyClassName="overflow-x-auto">
        {leads.length === 0 ? (
          <EmptyState icon={MapPin} title="Aucun lead" description="Cette agence n'a aucun lead." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Adresse</th>
                <th className="text-right">Score</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="text-white/80">
                    {lead.address}
                    {lead.city ? `, ${lead.city}` : ''}
                  </td>
                  <td className="text-right">
                    <ScoreBadge score={lead.score} />
                  </td>
                  <td className="text-white/60">{OWNER_TYPE_LABELS[lead.owner_type]}</td>
                  <td className="text-white/60">{LEAD_STATUS_LABELS[lead.status]}</td>
                  <td className="max-w-[220px] truncate text-white/50">{extractMainSignal(lead.signals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Membres */}
      <Panel title="Membres" subtitle={`${profiles.length} membre(s)`} bodyClassName="overflow-x-auto">
        {profiles.length === 0 ? (
          <EmptyState icon={Users} title="Aucun membre" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Rôle</th>
                <th>Téléphone</th>
                <th>Inscrit le</th>
                <th>Relance fondateur</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td className="text-white/80">
                    {p.first_name} {p.last_name}
                  </td>
                  <td>
                    <Badge variant={p.role === 'directeur' ? 'info' : 'default'}>
                      {ROLE_LABELS[p.role] ?? p.role}
                    </Badge>
                  </td>
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
                      subtitle={agency.name}
                      initialNotes={profileNotes.get(p.id) ?? []}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Invitations */}
      <Panel
        title="Invitations agence"
        subtitle={`${invitations.length} invitation(s)`}
        bodyClassName="overflow-x-auto"
      >
        {invitations.length === 0 ? (
          <EmptyState icon={Mail} title="Aucune invitation" description="Aucune invitation pour cette agence." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rôle</th>
                <th>Créée</th>
                <th>Expire</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => {
                const status = getInvitationStatus(inv);
                return (
                  <tr key={inv.id}>
                    <td className="text-white/80">{inv.email}</td>
                    <td className="text-white/60">{ROLE_LABELS[inv.role] ?? inv.role}</td>
                    <td className="whitespace-nowrap text-white/50">{formatDate(inv.created_at)}</td>
                    <td className="whitespace-nowrap text-white/50">{formatDate(inv.expires_at)}</td>
                    <td>
                      <Badge
                        variant={status === 'active' ? 'success' : status === 'used' ? 'muted' : 'warning'}
                      >
                        {status === 'active' ? 'Active' : status === 'used' ? 'Utilisée' : 'Expirée'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
