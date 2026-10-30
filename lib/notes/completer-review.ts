/**
 * Une nouvelle lecture de la note, alors que l'agent a déjà retouché la revue.
 *
 * Avant, une revue touchée (un partage choisi, une carte décochée) ne bougeait
 * plus : le complément dicté ensuite (« son numéro c'est le… », « il est aussi
 * vendeur ») restait dans le texte sans jamais atteindre la fiche. Ici, la
 * lecture complète la revue sans rien défaire : ce que l'agent a réglé reste,
 * ce que la note apporte de neuf s'ajoute. Les identifiants déjà connus sont
 * gardés, pour que l'état de l'écran (fiche corrigée, carte masquée) suive.
 */

import { normalizeName } from '@/lib/import/normalize';
import { repartirRoles, rolesDuContact, type ContactType } from '@/types/contact';
import type { ExtractedPersonne } from '@/lib/notes/propositions';
import { personnesProches, type NoteReviewPayload, type PersonneProposal } from '@/lib/notes/build-review';
import { rolesDitsDansTranscript } from '@/lib/notes/from-transcript';

function cleTexte(s: string): string {
  return normalizeName(s).replace(/\s+/g, ' ').trim();
}

/**
 * D'une lecture à l'autre, le modèle écrit parfois le même nom autrement
 * (« Ben Ali » puis « Benoît Ali ») : même nom de famille et un prénom qui
 * commence l'autre suffisent. Dans une même lecture, la règle reste stricte.
 */
function memePersonne(a: PersonneProposal, b: PersonneProposal): boolean {
  if (personnesProches(a, b)) return true;
  const al = normalizeName(a.personne.lastName);
  const bl = normalizeName(b.personne.lastName);
  const af = normalizeName(a.personne.firstName);
  const bf = normalizeName(b.personne.firstName);
  if (!al || al !== bl || !af || !bf) return false;
  const [court, long] = af.length <= bf.length ? [af, bf] : [bf, af];
  return court.length >= 3 && long.startsWith(court);
}

/** Ce que la dernière lecture sait de la personne l'emporte ; ce qu'elle ignore reste. */
function completerPersonne(avant: PersonneProposal, lue: PersonneProposal): PersonneProposal {
  const a = avant.personne;
  const l = lue.personne;
  return {
    id: avant.id,
    personne: {
      firstName: l.firstName || a.firstName,
      lastName: l.lastName || a.lastName,
      phone: l.phone || a.phone,
      email: l.email || a.email,
      relation: l.relation ?? a.relation ?? null,
      // Une casquette dite plus tard s'ajoute à celles déjà comprises.
      ...repartirRoles([...rolesDuContact(a), ...rolesDuContact(l)]),
    },
    matches: lue.matches.length ? lue.matches : avant.matches,
  };
}

type ChampsFiche = {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  type: ContactType;
  autresTypes: ContactType[];
};

/**
 * La fiche que l'agent a retouchée, et ce que la note a appris depuis :
 * `avant` est la personne lue au moment de la retouche, `maintenant` la
 * dernière lecture. Un numéro ou un e-mail dit après la retouche s'y pose
 * (dit après, il fait foi) ; un nom ne remplit qu'une case vide, pour qu'une
 * lecture moins juste ne défasse pas une correction ; une casquette dite en
 * plus s'ajoute, une casquette retirée à voix haute tombe.
 */
export function completerFiche<T extends ChampsFiche>(
  fields: T,
  avant: ExtractedPersonne | undefined,
  maintenant: ExtractedPersonne,
  transcript: string,
): T {
  if (!avant) return fields;
  const next = { ...fields };
  if (maintenant.phone && maintenant.phone !== avant.phone) next.phone = maintenant.phone;
  if (maintenant.email && maintenant.email !== avant.email) next.email = maintenant.email;
  if (!next.firstName.trim() && maintenant.firstName) next.firstName = maintenant.firstName;
  if (!next.lastName.trim() && maintenant.lastName) next.lastName = maintenant.lastName;
  const lusAvant = rolesDuContact(avant);
  const lus = rolesDuContact(maintenant);
  const ajoutes = lus.filter((r) => r !== 'autre' && !lusAvant.includes(r));
  const { nies } = rolesDitsDansTranscript(transcript);
  const retires = lusAvant.filter((r) => !lus.includes(r) && nies.includes(r));
  if (ajoutes.length || retires.length) {
    const roles = [...rolesDuContact(next).filter((r) => !retires.includes(r)), ...ajoutes];
    Object.assign(next, repartirRoles(roles.length ? roles : ['autre']));
  }
  return next;
}

export function completerReview(
  avant: NoteReviewPayload | null,
  lue: NoteReviewPayload,
  transcript: string,
): NoteReviewPayload {
  if (!avant) return { ...lue, transcript };

  /* Personnes : appariées par nom, téléphone ou fiche reconnue. */
  const idDe = new Map<string, string>();
  const personnes = [...avant.personnes];
  const prises = new Set<string>();
  const ids = new Set(personnes.map((p) => p.id));
  for (const l of lue.personnes) {
    const i = personnes.findIndex((p) => !prises.has(p.id) && memePersonne(p, l));
    if (i >= 0) {
      const p = personnes[i]!;
      prises.add(p.id);
      idDe.set(l.id, p.id);
      personnes[i] = completerPersonne(p, l);
      continue;
    }
    // Quelqu'un de nouveau dans le complément : un identifiant qui ne heurte personne.
    let id = l.id;
    for (let n = 2; ids.has(id); n += 1) id = `${l.id}-${n}`;
    ids.add(id);
    prises.add(id);
    idDe.set(l.id, id);
    personnes.push({ ...l, id });
  }
  // « Finalement il ne vend plus » : seule personne de la note, la casquette tombe.
  const { nies } = rolesDitsDansTranscript(transcript);
  if (personnes.length === 1 && nies.length > 0) {
    const seule = personnes[0]!;
    const roles = rolesDuContact(seule.personne).filter((r) => !nies.includes(r));
    personnes[0] = { ...seule, personne: { ...seule.personne, ...repartirRoles(roles.length ? roles : ['autre']) } };
  }
  const versAvant = (ref: string | null) => (ref ? (idDe.get(ref) ?? ref) : ref);

  /* Actions : celles réglées par l'agent restent, les nouvelles s'ajoutent. */
  const actionsConnues = new Set(avant.actions.map((a) => `${a.type}|${cleTexte(a.intitule)}`));
  const actionIds = new Set(avant.actions.map((a) => a.id));
  const actions = [...avant.actions];
  for (const a of lue.actions) {
    const cle = `${a.type}|${cleTexte(a.intitule)}`;
    if (actionsConnues.has(cle)) continue;
    actionsConnues.add(cle);
    let id = a.id;
    for (let n = 2; actionIds.has(id); n += 1) id = `${a.id}-${n}`;
    actionIds.add(id);
    actions.push({ ...a, id, personneRef: versAvant(a.personneRef) });
  }

  const majConnues = new Set(avant.misesAJour.map((m) => `${m.bienId}|${m.champ}`));
  const misesAJour = [
    ...avant.misesAJour,
    ...lue.misesAJour.filter((m) => !majConnues.has(`${m.bienId}|${m.champ}`)),
  ];

  const constats = new Set(avant.observations.map((o) => cleTexte(o.texte)));
  const observations = [...avant.observations];
  for (const o of lue.observations) {
    if (constats.has(cleTexte(o.texte))) continue;
    constats.add(cleTexte(o.texte));
    observations.push({ ...o, id: `${o.id}-c${observations.length}` });
  }

  const unionParId = <T extends { id: string }>(a: readonly T[], b: readonly T[]) => [
    ...a,
    ...b.filter((x) => !a.some((y) => y.id === x.id)),
  ];

  return {
    ...avant,
    transcript,
    personnes,
    // L'adresse a pu être corrigée à la main : elle ne se réécrit pas.
    immeuble: avant.immeuble ?? lue.immeuble,
    biens: unionParId(avant.biens, lue.biens),
    leads: unionParId(avant.leads, lue.leads),
    relance: avant.relance ?? lue.relance,
    promesse: avant.promesse ?? lue.promesse,
    rendezVous: avant.rendezVous ?? lue.rendezVous,
    visite: avant.visite ?? lue.visite,
    details: lue.details.length ? lue.details : avant.details,
    prix: lue.prix ?? avant.prix,
    rooms: lue.rooms ?? avant.rooms,
    surface: lue.surface ?? avant.surface,
    secteur: lue.secteur ?? avant.secteur,
    sourceInfo: avant.sourceInfo ?? lue.sourceInfo,
    titre: lue.titre ?? avant.titre,
    resume: lue.resume ?? avant.resume,
    actions,
    misesAJour,
    // Les critères ne se règlent pas à la main (seule la case) : la lecture complète les dit mieux.
    recherche: lue.recherche
      ? {
          ...lue.recherche,
          personneRef: avant.recherche?.personneRef ?? versAvant(lue.recherche.personneRef),
          accepted: avant.recherche?.accepted ?? lue.recherche.accepted,
        }
      : avant.recherche,
    prospect: avant.prospect ?? lue.prospect,
    // Objet et message se retouchent : seul un brouillon encore vide se remplit.
    email: avant.email
      ? { ...avant.email, corps: avant.email.corps || (lue.email?.corps ?? '') }
      : lue.email
        ? { ...lue.email, personneRef: versAvant(lue.email.personneRef) }
        : null,
    observations,
  };
}
