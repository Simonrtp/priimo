import type { PortraitCollaborateur } from '@/types/contact';

type MembrePortrait = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
};

export function portraitCollaborateur(
  m: Pick<MembrePortrait, 'firstName' | 'lastName' | 'fullName' | 'avatarUrl'>,
): PortraitCollaborateur {
  return portraitDepuisMembre(m);
}

export function portraitDepuisMembre(m: {
  firstName?: string;
  lastName?: string;
  fullName: string;
  avatarUrl?: string | null;
}): PortraitCollaborateur {
  const firstName = (m.firstName ?? '').trim();
  const lastName = (m.lastName ?? '').trim();
  if (firstName || lastName) {
    return { firstName, lastName, fullName: m.fullName, avatarUrl: m.avatarUrl ?? null };
  }
  const parts = m.fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    fullName: m.fullName,
    avatarUrl: m.avatarUrl ?? null,
  };
}

export function portraitsParId(
  members: readonly MembrePortrait[],
): Map<string, PortraitCollaborateur> {
  return new Map(members.map((m) => [m.id, portraitCollaborateur(m)]));
}

function cleNom(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/\s+/g, ' ')
    .trim();
}

export function portraitsParNom(
  members: readonly MembrePortrait[],
): Map<string, PortraitCollaborateur> {
  return new Map(members.map((m) => [cleNom(m.fullName), portraitCollaborateur(m)]));
}

export function portraitPourNom(
  nom: string | null | undefined,
  parNom: ReadonlyMap<string, PortraitCollaborateur>,
): PortraitCollaborateur | null {
  if (!nom?.trim()) return null;
  return parNom.get(cleNom(nom)) ?? null;
}

export function auteurNote(
  createdBy: string | null | undefined,
  parId: ReadonlyMap<string, PortraitCollaborateur>,
): PortraitCollaborateur | null {
  if (!createdBy) return null;
  return parId.get(createdBy) ?? null;
}
