import { isSignedMandat, PORTFOLIO_STALE_MANDAT_DAYS, PORTFOLIO_STALE_VISIT_MAX } from './portfolio';

const DAY_MS = 86_400_000;

export type DirectorExceptionItem = {
  label: string;
  count: number;
  href: string;
};

export type DirectorMemberExceptions = {
  memberId: string;
  fullName: string;
  items: DirectorExceptionItem[];
};

function ageDays(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (now - t) / DAY_MS;
}

/**
 * Exceptions par personne pour la colonne centrale du directeur.
 * Même structure d’accueil, contenu distinct des cartes de tâches.
 */
export function buildDirectorExceptions(input: {
  members: readonly { id: string; fullName: string }[];
  leads: readonly { assignedTo: string | null; stageId: string | null }[];
  notes: readonly { createdBy: string | null; statut: string }[];
  biens: readonly {
    id: string;
    createdBy: string | null;
    mandatStatut: string;
    mandatDate: string | null;
    createdAt: string;
  }[];
  visitCountByBienId: Readonly<Record<string, number>>;
  activityVolumeByMemberId: Readonly<Record<string, number>>;
  now?: number;
}): DirectorMemberExceptions[] {
  const now = input.now ?? Date.now();
  const rows: DirectorMemberExceptions[] = [];

  for (const member of input.members) {
    const items: DirectorExceptionItem[] = [];
    const nonPris = input.leads.filter(
      (l) => l.assignedTo === member.id && l.stageId == null,
    ).length;
    if (nonPris > 0) {
      items.push({
        label: nonPris > 1 ? 'leads livrés non pris' : 'lead livré non pris',
        count: nonPris,
        href: '/dashboard/prospection?filtre=non-pris',
      });
    }

    const brutes = input.notes.filter(
      (n) => n.createdBy === member.id && n.statut === 'brute',
    ).length;
    if (brutes > 0) {
      items.push({
        label: brutes > 1 ? 'notes encore brutes' : 'note encore brute',
        count: brutes,
        href: '/dashboard/notes?statut=brute&scope=agence',
      });
    }

    const stale = input.biens.filter((b) => {
      if (b.createdBy !== member.id || !isSignedMandat(b.mandatStatut)) return false;
      const age = ageDays(b.mandatDate ?? b.createdAt, now);
      if (age === null || age <= PORTFOLIO_STALE_MANDAT_DAYS) return false;
      const visits = input.visitCountByBienId[b.id] ?? 0;
      return visits < PORTFOLIO_STALE_VISIT_MAX;
    }).length;
    if (stale > 0) {
      items.push({
        label: stale > 1 ? 'mandats qui pourrissent' : 'mandat qui pourrit',
        count: stale,
        href: '/dashboard/biens?filtre=mandats-60j',
      });
    }

    const volume = input.activityVolumeByMemberId[member.id] ?? 0;
    if (volume === 0) {
      items.push({
        label: 'aucune activité depuis 7 jours',
        count: 1,
        href: '/dashboard',
      });
    }

    if (items.length > 0) {
      rows.push({ memberId: member.id, fullName: member.fullName, items });
    }
  }

  return rows.sort((a, b) => {
    const ca = a.items.reduce((s, i) => s + i.count, 0);
    const cb = b.items.reduce((s, i) => s + i.count, 0);
    if (cb !== ca) return cb - ca;
    return a.fullName.localeCompare(b.fullName, 'fr');
  });
}
