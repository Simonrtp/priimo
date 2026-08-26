import type { NoteLien, NoteLienEntite } from '@/types/contact';
import type { NoteReviewPayload } from '@/lib/notes/build-review';

export type NoteAttachmentProposal = {
  key: string;
  label: string;
  subtitle: string | null;
  entiteType: NoteLienEntite;
  entiteId: string;
  alreadyLinked: boolean;
  rejected: boolean;
};

function lienKey(type: NoteLienEntite, id: string): string {
  return `${type}:${id}`;
}

export function rejectedKeysFromStructured(structured: unknown): Set<string> {
  if (!structured || typeof structured !== 'object') return new Set();
  const raw = (structured as { rejected_liens?: unknown }).rejected_liens;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((k): k is string => typeof k === 'string'));
}

export function withRejectedKey(structured: unknown, key: string): Record<string, unknown> {
  const prev =
    structured && typeof structured === 'object' ? (structured as Record<string, unknown>) : {};
  const existing = rejectedKeysFromStructured(structured);
  existing.add(key);
  return { ...prev, rejected_liens: [...existing] };
}

/** Rattachements proposés par l’extraction — jamais créés tant que l’agent n’accepte pas. */
export function proposalsFromReview(
  review: NoteReviewPayload,
  liens: readonly NoteLien[],
  rejected: ReadonlySet<string>,
): NoteAttachmentProposal[] {
  const linked = new Set(liens.map((l) => lienKey(l.entiteType, l.entiteId)));
  const out: NoteAttachmentProposal[] = [];

  for (const personne of review.personnes) {
    const match = personne.matches[0];
    if (!match) continue;
    const key = lienKey('contact', match.contactId);
    out.push({
      key,
      label: match.label,
      subtitle: personne.personne.type || null,
      entiteType: 'contact',
      entiteId: match.contactId,
      alreadyLinked: linked.has(key),
      rejected: rejected.has(key),
    });
  }

  if (review.immeuble?.banId) {
    const key = lienKey('immeuble', review.immeuble.banId);
    out.push({
      key,
      label: review.immeuble.adresseNormalisee ?? review.immeuble.address,
      subtitle: 'Immeuble',
      entiteType: 'immeuble',
      entiteId: review.immeuble.banId,
      alreadyLinked: linked.has(key),
      rejected: rejected.has(key),
    });
  }

  return out;
}
