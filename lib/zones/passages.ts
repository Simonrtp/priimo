import { dateKeyParis } from '@/lib/today/calendar';
import type { JournalActivite } from '@/lib/activite/derive';
import type { PassageObserve } from './fraicheur';

/**
 * Ce que Priimo a vu, rien d'autre. Une case cochée à la main n'existe pas :
 * seuls un contact physique, une note rattachée au terrain, ou un changement
 * de statut de lead deviennent un passage.
 */
export function passagesDepuisJournal(journal: JournalActivite): PassageObserve[] {
  const vus = new Set<string>();
  const out: PassageObserve[] = [];

  function pousser(p: PassageObserve) {
    if (!p.banId || !p.profileId || !p.jour) return;
    const cle = `${p.profileId}:${p.banId}:${p.jour}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    out.push(p);
  }

  for (const c of journal.contactsPhysiques) {
    pousser({ banId: c.banId ?? '', profileId: c.profileId, jour: c.jour });
  }
  for (const n of journal.notes) {
    if (!n.rattacheeTerrain || !n.auteurId || !n.banId) continue;
    pousser({
      banId: n.banId,
      profileId: n.auteurId,
      jour: dateKeyParis(new Date(n.createdAt)),
    });
  }
  for (const t of journal.transitions) {
    if (!t.profileId || !t.banId) continue;
    pousser({
      banId: t.banId,
      profileId: t.profileId,
      jour: dateKeyParis(new Date(t.createdAt)),
    });
  }

  return out;
}
