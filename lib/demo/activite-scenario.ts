import { semaineDe, semaineDecalee, type Semaine } from '@/lib/activite/semaines';

/**
 * Douze semaines d'activité fictive pour un négociateur.
 *
 * Écrit comme un scénario, pas comme du bruit aléatoire. Un jeu de démonstration
 * tiré au sort produit des entonnoirs plats et des phrases absurdes ; ce qu'on
 * veut montrer, c'est une trajectoire qu'un directeur reconnaît : une montée en
 * régime, une semaine creuse au milieu — arrêt maladie, vacances, peu importe —
 * et une reprise. Les chiffres sont donc posés à la main, et vérifiés par un
 * test qui les fait passer dans le vrai `bilanPeriode`.
 *
 * Ce module ne parle pas à Supabase : il produit des lignes, le script de seed
 * les écrit. C'est ce qui permet de valider l'histoire sans toucher à la base.
 */

/** Contacts physiques déclarés par semaine, de S-11 à S0. */
const CONTACTS_PAR_SEMAINE = [16, 18, 15, 20, 17, 22, 4, 14, 19, 21, 12, 7] as const;

/** Notes vocales rattachées à un immeuble, par semaine. */
const NOTES_PAR_SEMAINE = [3, 3, 2, 4, 3, 4, 1, 2, 3, 4, 3, 2] as const;

/** La semaine creuse — indice dans les tableaux ci-dessus. */
export const SEMAINE_CREUSE = 6;

export type EtapeFinale = 'pris' | 'contacte' | 'estimation' | 'mandat' | 'perdu';

/** Le chemin complet d'un lead, du plus court au plus abouti. */
const CHEMIN: Record<EtapeFinale, readonly string[]> = {
  pris: ['pris'],
  contacte: ['pris', 'contacte'],
  estimation: ['pris', 'contacte', 'estimation'],
  mandat: ['pris', 'contacte', 'estimation', 'mandat'],
  perdu: ['pris', 'perdu'],
};

type Parcours = {
  /** Semaine d'entrée, en décalage négatif depuis la semaine courante. */
  entree: number;
  final: EtapeFinale;
  /** Décalage en semaines de chaque étape après l'entrée. Jamais dans le futur. */
  delais: readonly number[];
};

/**
 * Vingt-quatre leads : 24 pris, 17 contactés, 8 estimations, 4 mandats.
 *
 * Quatre mandats et pas trois : le ratio personnel se déclenche à trois, et
 * une démonstration qui tient tout juste sur le seuil casse au premier lead
 * qu'on déplace à la main pendant une présentation.
 */
const PARCOURS: readonly Parcours[] = [
  { entree: -11, final: 'mandat', delais: [0, 1, 3, 5] },
  { entree: -11, final: 'contacte', delais: [0, 2] },
  { entree: -10, final: 'estimation', delais: [0, 1, 4] },
  { entree: -10, final: 'mandat', delais: [0, 1, 2, 6] },
  { entree: -9, final: 'contacte', delais: [0, 1] },
  { entree: -9, final: 'perdu', delais: [0, 2] },
  { entree: -8, final: 'mandat', delais: [0, 1, 2, 4] },
  { entree: -8, final: 'contacte', delais: [0, 1] },
  { entree: -8, final: 'pris', delais: [0] },
  { entree: -7, final: 'estimation', delais: [0, 2, 4] },
  { entree: -7, final: 'contacte', delais: [0, 1] },
  { entree: -6, final: 'mandat', delais: [0, 1, 3, 4] },
  { entree: -6, final: 'contacte', delais: [0, 2] },
  { entree: -6, final: 'pris', delais: [0] },
  // S-5 : la semaine creuse. Aucun lead pris, une seule sortie.
  { entree: -4, final: 'contacte', delais: [0, 1] },
  { entree: -4, final: 'pris', delais: [0] },
  { entree: -3, final: 'estimation', delais: [0, 1, 2] },
  { entree: -3, final: 'contacte', delais: [0, 1] },
  { entree: -3, final: 'pris', delais: [0] },
  { entree: -2, final: 'estimation', delais: [0, 1, 2] },
  { entree: -2, final: 'contacte', delais: [0, 1] },
  { entree: -2, final: 'pris', delais: [0] },
  { entree: -1, final: 'contacte', delais: [0, 1] },
  { entree: 0, final: 'pris', delais: [0] },
];

export type TransitionFictive = {
  leadId: string;
  depuisCle: string | null;
  versCle: string;
  /** Horodatage ISO. */
  quand: string;
};

export type SortieFictive = { jour: string; banId: string; leadId: string | null };
export type NoteFictive = { quand: string; banId: string };

export type ActiviteFictive = {
  transitions: TransitionFictive[];
  sorties: SortieFictive[];
  notes: NoteFictive[];
  /** Les leads réellement utilisés, dans l'ordre des parcours. */
  leadsUtilises: string[];
  /** Étape finale de chaque lead — sert au script pour poser `stage_id`. */
  etapeFinaleParLead: Record<string, string>;
};

/** Un instant ouvré dans la semaine : lundi + `n` jours, à une heure crédible. */
function instantDansLaSemaine(semaine: Semaine, jourIndex: number, heure: number): string {
  const [y, m, d] = semaine.debut.split('-').map(Number);
  // Lundi–samedi : on ne fabrique jamais d'activité un dimanche.
  const decalage = jourIndex % 6;
  return new Date(
    Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + decalage, heure, (jourIndex * 7) % 60, 0),
  ).toISOString();
}

function jourDansLaSemaine(semaine: Semaine, jourIndex: number): string {
  return instantDansLaSemaine(semaine, jourIndex, 12).slice(0, 10);
}

/**
 * Construit les lignes du scénario.
 *
 * `maintenant` est explicite pour que le test et le seed produisent exactement
 * la même histoire, l'un sans horloge et l'autre avec.
 */
export function construireActiviteFictive(params: {
  maintenant: Date;
  /** Leads réels de l'agence de démonstration, réutilisés comme support. */
  leadIds: readonly string[];
  /** Immeubles (ban_id) sur lesquels poser sorties et notes. */
  banIds: readonly string[];
}): ActiviteFictive {
  const { maintenant, leadIds, banIds } = params;
  const semaineCourante = semaineDe(maintenant);

  const transitions: TransitionFictive[] = [];
  const leadsUtilises: string[] = [];
  const etapeFinaleParLead: Record<string, string> = {};

  PARCOURS.forEach((parcours, i) => {
    const leadId = leadIds[i % Math.max(1, leadIds.length)];
    if (!leadId || leadsUtilises.includes(leadId)) return;
    leadsUtilises.push(leadId);

    const etapes = CHEMIN[parcours.final];
    let precedente: string | null = null;
    etapes.forEach((etape, k) => {
      const delai = parcours.delais[k] ?? k;
      const offset = parcours.entree + delai;
      // Rien dans le futur : une démonstration datée de demain se voit.
      if (offset > 0) return;
      const semaine = semaineDecalee(semaineCourante, offset);
      transitions.push({
        leadId,
        depuisCle: precedente,
        versCle: etape,
        quand: instantDansLaSemaine(semaine, i + k, 9 + (k % 6)),
      });
      precedente = etape;
    });
    if (precedente) etapeFinaleParLead[leadId] = precedente;
  });

  const sorties: SortieFictive[] = [];
  const notes: NoteFictive[] = [];

  CONTACTS_PAR_SEMAINE.forEach((combien, index) => {
    const offset = index - (CONTACTS_PAR_SEMAINE.length - 1);
    const semaine = semaineDecalee(semaineCourante, offset);
    for (let n = 0; n < combien; n += 1) {
      const banId = banIds[(index * 7 + n) % Math.max(1, banIds.length)];
      if (!banId) continue;
      sorties.push({ jour: jourDansLaSemaine(semaine, n), banId, leadId: null });
    }
  });

  NOTES_PAR_SEMAINE.forEach((combien, index) => {
    const offset = index - (NOTES_PAR_SEMAINE.length - 1);
    const semaine = semaineDecalee(semaineCourante, offset);
    for (let n = 0; n < combien; n += 1) {
      const banId = banIds[(index * 3 + n) % Math.max(1, banIds.length)];
      if (!banId) continue;
      notes.push({ quand: instantDansLaSemaine(semaine, n + 1, 14), banId });
    }
  });

  return { transitions, sorties, notes, leadsUtilises, etapeFinaleParLead };
}

/** Combien de leads distincts le scénario réclame. */
export const LEADS_REQUIS = PARCOURS.length;

/** Cibles attendues, utilisées par le test comme par la trace du seed. */
export const CIBLES_SCENARIO = {
  leadsPris: PARCOURS.length,
  contactes: PARCOURS.filter((p) => p.final !== 'pris' && p.final !== 'perdu').length,
  estimations: PARCOURS.filter((p) => p.final === 'estimation' || p.final === 'mandat').length,
  mandats: PARCOURS.filter((p) => p.final === 'mandat').length,
  contactsPhysiques: CONTACTS_PAR_SEMAINE.reduce((a, b) => a + b, 0),
  notes: NOTES_PAR_SEMAINE.reduce((a, b) => a + b, 0),
} as const;
