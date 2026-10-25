import type { JournalActivite } from './derive';
import { dateKeyParis } from '@/lib/today/calendar';
import { dansLaSemaine, type Intervalle } from './semaines';
import { adresseDansZone } from '@/lib/zones/appartenance';
import type { AdresseAJuger, Zone } from '@/lib/zones/types';

/** Une étape qui pose un contact, une estimation ou un mandat sur une adresse. */
const ETAPES_SUR_BIEN = new Set(['contacte', 'estimation', 'mandat']);

export type SecteurPeriode = {
  id: string;
  nom: string;
  couleur: string;
  travaille: boolean;
  /** Titulaire du secteur. `null` si la zone n’est attribuée à personne. */
  titulaireId: string | null;
};

function jourDe(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return dateKeyParis(new Date(t));
}

/**
 * Les adresses touchées dans la période, et les notes à résoudre.
 *
 * Une note ne travaille un secteur que si elle est rattachée à un bien :
 * le ban de la note, ou un lien bien / immeuble / parcelle lu ensuite.
 * Une sortie le travaille. Un contact aussi, à condition que le lead ait une adresse.
 */
export function touchesPeriode(input: {
  journal: JournalActivite;
  profileIds: ReadonlySet<string>;
  intervalle: Intervalle;
}): { banIds: string[]; noteIds: string[] } {
  const bans = new Set<string>();
  const notes = new Set<string>();

  for (const n of input.journal.notes) {
    if (!n.auteurId || !input.profileIds.has(n.auteurId)) continue;
    const jour = jourDe(n.createdAt);
    if (!jour || !dansLaSemaine(jour, input.intervalle)) continue;
    if (n.id) notes.add(n.id);
    if (n.banId && n.rattacheeTerrain) bans.add(n.banId);
  }

  for (const c of input.journal.contactsPhysiques) {
    if (!input.profileIds.has(c.profileId)) continue;
    if (!dansLaSemaine(c.jour, input.intervalle)) continue;
    if (c.banId) bans.add(c.banId);
  }

  for (const t of input.journal.transitions) {
    if (!t.profileId || !input.profileIds.has(t.profileId)) continue;
    if (!t.versCle || !ETAPES_SUR_BIEN.has(t.versCle) || !t.banId) continue;
    const jour = jourDe(t.createdAt);
    if (!jour || !dansLaSemaine(jour, input.intervalle)) continue;
    bans.add(t.banId);
  }

  return { banIds: [...bans], noteIds: [...notes] };
}

/** Les mêmes gestes, séparés par auteur — pour dire qui a travaillé son secteur. */
export function touchesParAuteur(input: {
  journal: JournalActivite;
  profileIds: ReadonlySet<string>;
  intervalle: Intervalle;
}): Map<string, { banIds: Set<string>; noteIds: Set<string> }> {
  const par = new Map<string, { banIds: Set<string>; noteIds: Set<string> }>();
  const seau = (id: string) => {
    let s = par.get(id);
    if (!s) {
      s = { banIds: new Set(), noteIds: new Set() };
      par.set(id, s);
    }
    return s;
  };

  for (const n of input.journal.notes) {
    if (!n.auteurId || !input.profileIds.has(n.auteurId)) continue;
    const jour = jourDe(n.createdAt);
    if (!jour || !dansLaSemaine(jour, input.intervalle)) continue;
    const s = seau(n.auteurId);
    if (n.id) s.noteIds.add(n.id);
    if (n.banId && n.rattacheeTerrain) s.banIds.add(n.banId);
  }

  for (const c of input.journal.contactsPhysiques) {
    if (!input.profileIds.has(c.profileId)) continue;
    if (!dansLaSemaine(c.jour, input.intervalle)) continue;
    if (c.banId) seau(c.profileId).banIds.add(c.banId);
  }

  for (const t of input.journal.transitions) {
    if (!t.profileId || !input.profileIds.has(t.profileId)) continue;
    if (!t.versCle || !ETAPES_SUR_BIEN.has(t.versCle) || !t.banId) continue;
    const jour = jourDe(t.createdAt);
    if (!jour || !dansLaSemaine(jour, input.intervalle)) continue;
    seau(t.profileId).banIds.add(t.banId);
  }

  return par;
}

/** Chaque secteur du titulaire, travaillé dès qu’une adresse de la période y tombe. */
export function etatsSecteurs(input: {
  zones: readonly Zone[];
  adresses: readonly AdresseAJuger[];
}): SecteurPeriode[] {
  return input.zones
    .filter((z) => z.actif)
    .map((z) => ({
      id: z.id,
      nom: z.nom,
      couleur: z.couleur,
      travaille: input.adresses.some((a) => adresseDansZone(a, z)),
      titulaireId: z.assignedTo,
    }));
}
