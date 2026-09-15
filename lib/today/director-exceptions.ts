import type { CounterTone } from './counter-severity';

export type DirectorExceptionKind = 'leads-non-pris' | 'notes-brutes' | 'inactivite';

export type DirectorExceptionItem = {
  kind: DirectorExceptionKind;
  label: string;
  count: number;
  href: string | null;
  tone: CounterTone;
};

export type DirectorMemberExceptions = {
  memberId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  items: DirectorExceptionItem[];
};

function memberQuery(href: string, memberId: string): string {
  const join = href.includes('?') ? '&' : '?';
  return `${href}${join}membre=${encodeURIComponent(memberId)}`;
}

/**
 * Exceptions par personne pour la colonne centrale du directeur.
 * Même structure d’accueil, contenu distinct des cartes de tâches.
 */
export function buildDirectorExceptions(input: {
  members: readonly {
    id: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
  }[];
  leads: readonly { assignedTo: string | null; stageId: string | null }[];
  notes: readonly { createdBy: string | null; statut: string }[];
  activityVolumeByMemberId: Readonly<Record<string, number>>;
}): DirectorMemberExceptions[] {
  const rows: DirectorMemberExceptions[] = [];

  for (const member of input.members) {
    const items: DirectorExceptionItem[] = [];
    const nonPris = input.leads.filter(
      (l) => l.assignedTo === member.id && l.stageId == null,
    ).length;
    if (nonPris > 0) {
      items.push({
        kind: 'leads-non-pris',
        label: nonPris > 1 ? 'leads livrés non pris' : 'lead livré non pris',
        count: nonPris,
        href: memberQuery('/dashboard/prospection?filtre=non-pris&vue=liste', member.id),
        tone: 'probleme',
      });
    }

    const brutes = input.notes.filter(
      (n) => n.createdBy === member.id && n.statut === 'brute',
    ).length;
    if (brutes > 0) {
      items.push({
        kind: 'notes-brutes',
        label: brutes > 1 ? 'notes encore brutes' : 'note encore brute',
        count: brutes,
        href: memberQuery('/dashboard?notes=1', member.id),
        tone: 'surveiller',
      });
    }

    const volume = input.activityVolumeByMemberId[member.id] ?? 0;
    if (volume === 0) {
      items.push({
        kind: 'inactivite',
        label: 'aucune activité depuis 7 jours',
        count: 1,
        href: null,
        tone: 'surveiller',
      });
    }

    if (items.length > 0) {
      rows.push({
        memberId: member.id,
        fullName: member.fullName,
        firstName: member.firstName ?? '',
        lastName: member.lastName ?? '',
        avatarUrl: member.avatarUrl ?? null,
        items,
      });
    }
  }

  return rows.sort((a, b) => {
    const ca = a.items.reduce((s, i) => s + i.count, 0);
    const cb = b.items.reduce((s, i) => s + i.count, 0);
    if (cb !== ca) return cb - ca;
    return a.fullName.localeCompare(b.fullName, 'fr');
  });
}
