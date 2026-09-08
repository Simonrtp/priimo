import type { Activite } from './types';

/**
 * Ratios de conversion, avec cascade à trois niveaux.
 *
 * Le point dur n'est pas le calcul, c'est l'honnêteté. Un ratio personnel
 * inventé à partir de deux semaines de données est pire qu'une moyenne
 * assumée : le jour où il se corrige tout seul, l'agent cesse de croire
 * l'outil entier. La fonction retourne donc toujours QUEL niveau elle a
 * utilisé, et l'écran doit le dire.
 */

/** En dessous, un ratio personnel n'a aucune valeur statistique. */
export const MANDATS_MINIMUM = 3;

/** Fenêtre de calcul, en semaines glissantes. */
export const FENETRE_SEMAINES = 12;

export type NiveauRatio = 'personnel' | 'agence' | 'reference';

export const LIBELLE_NIVEAU: Record<NiveauRatio, string> = {
  personnel: 'Mon ratio',
  agence: 'Moyenne de l’agence',
  reference: 'Référence métier, en attendant mes chiffres',
};

/** Les compteurs qui entrent dans la conversion. */
export type EtapesConversion = Pick<
  Record<Activite, number>,
  'contacts_physiques' | 'contacts_qualifies' | 'estimations' | 'mandats'
>;

export type ReferenceMetier = {
  physiquesParQualifie: number | null;
  qualifiesParEstimation: number | null;
  estimationsParMandat: number | null;
};

export type PositionMoyenne = 'dans' | 'mieux' | 'moins' | null;

export type Ratios = {
  niveau: NiveauRatio;
  /**
   * `true` quand les chiffres affichés ne viennent ni du collaborateur ni de
   * l'agence ET que le réseau n'a pas encore fourni sa référence. L'écran doit
   * alors le dire explicitement, pas afficher un nombre nu.
   */
  provisoire: boolean;
  /** Mandats retenus pour choisir le niveau — sert à expliquer le choix. */
  mandatsRetenus: number;
  physiquesParQualifie: number | null;
  qualifiesParEstimation: number | null;
  estimationsParMandat: number | null;
  /** Contacts physiques pour 1 mandat — le chiffre qui remet les pendules. */
  physiquesParMandat: number | null;
  /** Par rapport à l’agence / la référence, si le niveau est personnel. */
  positionMoyenne: PositionMoyenne;
};

/** Arrondi à la décimale : un ratio s'affiche « 8,4 pour 1 », pas 8,42857. */
function ratio(numerateur: number, denominateur: number): number | null {
  if (denominateur <= 0) return null;
  return Math.round((numerateur / denominateur) * 10) / 10;
}

function ratiosDe(etapes: EtapesConversion): ReferenceMetier {
  return {
    physiquesParQualifie: ratio(etapes.contacts_physiques, etapes.contacts_qualifies),
    qualifiesParEstimation: ratio(etapes.contacts_qualifies, etapes.estimations),
    estimationsParMandat: ratio(etapes.estimations, etapes.mandats),
  };
}

/** Produit des trois paliers — « 1 mandat pour N contacts ». */
export function physiquesParMandatDepuis(paliers: ReferenceMetier): number | null {
  const a = paliers.physiquesParQualifie;
  const b = paliers.qualifiesParEstimation;
  const c = paliers.estimationsParMandat;
  if (a == null || b == null || c == null || a <= 0 || b <= 0 || c <= 0) return null;
  return Math.round(a * b * c * 10) / 10;
}

export function physiquesParMandatDe(
  etapes: EtapesConversion | null,
  paliers: ReferenceMetier,
): number | null {
  if (etapes && etapes.mandats > 0 && etapes.contacts_physiques > 0) {
    return ratio(etapes.contacts_physiques, etapes.mandats);
  }
  return physiquesParMandatDepuis(paliers);
}

/** Moins de contacts pour un mandat = mieux. */
export function positionVsMoyenne(
  personnel: number | null,
  moyenne: number | null,
): PositionMoyenne {
  if (personnel == null || moyenne == null || moyenne <= 0) return null;
  const r = personnel / moyenne;
  if (r <= 0.85) return 'mieux';
  if (r <= 1.2) return 'dans';
  return 'moins';
}

export function formateRatio(n: number | null): string {
  if (n == null) return '—';
  const v = n >= 10 ? Math.round(n) : n;
  return v.toLocaleString('fr-FR', { maximumFractionDigits: n >= 10 ? 0 : 1 });
}

function completer(
  base: Omit<Ratios, 'physiquesParMandat' | 'positionMoyenne'>,
  etapes: EtapesConversion | null,
  moyenne: number | null,
): Ratios {
  const paliers: ReferenceMetier = {
    physiquesParQualifie: base.physiquesParQualifie,
    qualifiesParEstimation: base.qualifiesParEstimation,
    estimationsParMandat: base.estimationsParMandat,
  };
  const physiquesParMandat = physiquesParMandatDe(etapes, paliers);
  return {
    ...base,
    physiquesParMandat,
    positionMoyenne:
      base.niveau === 'personnel' ? positionVsMoyenne(physiquesParMandat, moyenne) : null,
  };
}

/**
 * Choisit le niveau le plus proche du collaborateur qui tienne debout, et le
 * déclare. `reference` peut contenir des `null` : c'est le cas tant que le
 * réseau n'a pas transmis ses chiffres, et il vaut mieux un trou affiché comme
 * tel qu'un nombre inventé.
 */
export function cascadeRatios(params: {
  personnel: EtapesConversion;
  agence: EtapesConversion;
  reference: ReferenceMetier;
  referenceFournie: boolean;
}): Ratios {
  const { personnel, agence, reference, referenceFournie } = params;

  const moyenneAgence =
    agence.mandats >= MANDATS_MINIMUM
      ? physiquesParMandatDe(agence, ratiosDe(agence))
      : physiquesParMandatDepuis(reference);

  if (personnel.mandats >= MANDATS_MINIMUM) {
    return completer(
      {
        niveau: 'personnel',
        provisoire: false,
        mandatsRetenus: personnel.mandats,
        ...ratiosDe(personnel),
      },
      personnel,
      moyenneAgence,
    );
  }

  if (agence.mandats >= MANDATS_MINIMUM) {
    return completer(
      {
        niveau: 'agence',
        provisoire: false,
        mandatsRetenus: agence.mandats,
        ...ratiosDe(agence),
      },
      agence,
      null,
    );
  }

  return completer(
    {
      niveau: 'reference',
      provisoire: !referenceFournie,
      mandatsRetenus: personnel.mandats,
      physiquesParQualifie: reference.physiquesParQualifie,
      qualifiesParEstimation: reference.qualifiesParEstimation,
      estimationsParMandat: reference.estimationsParMandat,
    },
    null,
    null,
  );
}
