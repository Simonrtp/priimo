import { dateKeyParis } from '@/lib/today/calendar';
import { RANGS_CANONIQUES, type TransitionRow } from './derive';
import { dansLaSemaine, type Intervalle } from './semaines';

/**
 * Entonnoir de conversion, par COHORTE.
 *
 * La version précédente empilait quatre compteurs indépendants mesurés sur la
 * même période. Ça produisait des formes impossibles — deux mandats sous zéro
 * estimation — parce qu'un mandat signé cette semaine vient d'un lead entré il
 * y a deux mois, dont l'estimation est hors période. Un entonnoir qui ment sur
 * sa propre géométrie ne sert à rien : on le croit avant de croire la phrase.
 *
 * Ici on prend les leads ENTRÉS dans la fenêtre, et on suit chacun jusqu'à
 * l'étape la plus avancée qu'il ait atteinte, sans limite de date d'arrivée.
 * Un étage ne peut donc jamais dépasser celui du dessus : c'est vrai par
 * construction, pas par lissage.
 *
 * Les contacts physiques n'y figurent plus. Ce ne sont pas des leads : les
 * mettre en haut d'une cohorte de leads était précisément ce qui cassait la
 * monotonie.
 */

export const ETAPES_ENTONNOIR = [
  'leads_pris',
  'contacts_qualifies',
  'estimations',
  'mandats',
] as const;

export type EtapeEntonnoirCle = (typeof ETAPES_ENTONNOIR)[number];

export const LIBELLE_ETAPE: Record<EtapeEntonnoirCle, string> = {
  leads_pris: 'Leads pris',
  contacts_qualifies: 'Contactés',
  estimations: 'Estimations',
  mandats: 'Mandats signés',
};

/** Le jalon de pipeline que chaque étage exige d'avoir atteint. */
const JALON: Record<EtapeEntonnoirCle, string | null> = {
  leads_pris: null, // entrer dans le pipeline suffit
  contacts_qualifies: 'contacte',
  estimations: 'estimation',
  mandats: 'mandat',
};

export type EtapeEntonnoir = {
  cle: EtapeEntonnoirCle;
  libelle: string;
  valeur: number;
  /** Part de la cohorte, 0 à 100. Sert à dessiner la largeur. */
  part: number;
  /** Taux de passage depuis l'étage précédent, en %. `null` au premier étage. */
  conversion: number | null;
};

function rangDe(cle: string | null, rangParCle: Readonly<Record<string, number>>): number {
  if (!cle) return 0;
  return rangParCle[cle] ?? RANGS_CANONIQUES[cle] ?? 0;
}

function jourDe(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return dateKeyParis(new Date(t));
}

/**
 * La cohorte : leads dont l'ENTRÉE dans le pipeline (transition sans étape de
 * départ) tombe dans la fenêtre et revient au collaborateur.
 *
 * Le suivi, lui, regarde toutes les transitions du lead, y compris celles d'un
 * collègue et celles postérieures à la fenêtre — sinon un mandat signé le
 * lendemain de la fin de fenêtre disparaîtrait du bilan de celui qui a fait le
 * travail.
 */
export function entonnoirCohorte(params: {
  transitions: readonly TransitionRow[];
  profileId: string;
  fenetre: Intervalle;
  rangParCle: Readonly<Record<string, number>>;
}): EtapeEntonnoir[] {
  const { transitions, profileId, fenetre, rangParCle } = params;

  const cohorte = new Set<string>();
  for (const t of transitions) {
    if (t.depuisCle !== null) continue;
    if (t.profileId !== profileId) continue;
    const jour = jourDe(t.createdAt);
    if (!jour || !dansLaSemaine(jour, fenetre)) continue;
    cohorte.add(t.leadId);
  }

  const rangMax = new Map<string, number>();
  for (const t of transitions) {
    if (!cohorte.has(t.leadId)) continue;
    const rang = rangDe(t.versCle, rangParCle);
    rangMax.set(t.leadId, Math.max(rangMax.get(t.leadId) ?? 0, rang));
  }

  const sommet = cohorte.size;
  const valeurs = ETAPES_ENTONNOIR.map((cle) => {
    const jalon = JALON[cle];
    if (jalon === null) return sommet;
    const seuil = rangDe(jalon, rangParCle);
    if (seuil === 0) return 0;
    let n = 0;
    for (const leadId of cohorte) {
      if ((rangMax.get(leadId) ?? 0) >= seuil) n += 1;
    }
    return n;
  });

  return ETAPES_ENTONNOIR.map((cle, i) => {
    const valeur = valeurs[i]!;
    const precedent = i === 0 ? null : valeurs[i - 1]!;
    return {
      cle,
      libelle: LIBELLE_ETAPE[cle],
      valeur,
      part: sommet > 0 ? Math.round((valeur / sommet) * 1000) / 10 : 0,
      conversion:
        precedent === null || precedent === 0
          ? null
          : Math.round((valeur / precedent) * 1000) / 10,
    };
  });
}

/** `true` quand l'entonnoir n'a rien à montrer — évite un dessin vide. */
export function entonnoirVide(etapes: readonly EtapeEntonnoir[]): boolean {
  return etapes.every((e) => e.valeur === 0);
}
