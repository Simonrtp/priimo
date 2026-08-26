import { isSignedMandat, PORTFOLIO_STALE_MANDAT_DAYS, PORTFOLIO_STALE_VISIT_MAX } from './portfolio';
import type { CounterTone } from './counter-severity';

const DAY_MS = 86_400_000;

export type DirectorExceptionKind = 'leads-non-pris' | 'notes-brutes' | 'mandats-60j' | 'inactivite';

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
  items: DirectorExceptionItem[];
};

function ageDays(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (now - t) / DAY_MS;
}

function memberQuery(href: string, memberId: string): string {
  const join = href.includes('?') ? '&' : '?';
  return `${href}${join}membre=${encodeURIComponent(memberId)}`;
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
        href: memberQuery('/dashboard/notes?statut=brute&scope=agence', member.id),
        tone: 'surveiller',
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
        kind: 'mandats-60j',
        label: stale > 1 ? 'mandats qui pourrissent' : 'mandat qui pourrit',
        count: stale,
        href: memberQuery('/dashboard/biens?filtre=mandats-60j', member.id),
        tone: 'probleme',
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
