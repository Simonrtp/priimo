/** Ce qu’un collaborateur a fait sur la période, pour le survol des cartes d’agence. */
export type RepartitionEquipe = {
  prenom: string;
  contacts: number;
  notes: number;
  secteursTravailles: number;
  secteursTotal: number;
};

export type LigneDetail = {
  prenom: string;
  valeur: string;
};

export type DetailSurvol = {
  lignes: LigneDetail[];
  /** « et 3 autres », ou « 5 n’en ont pas fait ». */
  suite: string | null;
};

/** Au-delà, la carte ne peut plus lister tout le monde. */
const MAX_LIGNES = 4;

function etAutres(reste: number): string | null {
  if (reste <= 0) return null;
  return reste === 1 ? 'et 1 autre' : `et ${reste} autres`;
}

function phraseSans(sans: readonly { prenom: string }[]): string | null {
  if (sans.length === 0) return null;
  if (sans.length === 1) return `${sans[0]!.prenom} n’en a pas fait`;
  if (sans.length === 2) return `${sans[0]!.prenom} et ${sans[1]!.prenom} n’en ont pas fait`;
  return `${sans.length} n’en ont pas fait`;
}

function joindre(a: string | null, b: string | null): string | null {
  return [a, b].filter(Boolean).join(' · ') || null;
}

/** Qui en a fait le plus, et qui n’en a pas fait — sans dérouler toute l’agence. */
export function detailCompteur(
  equipe: readonly RepartitionEquipe[],
  cle: 'contacts' | 'notes',
): DetailSurvol {
  const tries = [...equipe].sort(
    (a, b) => b[cle] - a[cle] || a.prenom.localeCompare(b.prenom, 'fr'),
  );
  const avec = tries.filter((e) => e[cle] > 0);
  const sans = tries.filter((e) => e[cle] === 0);
  const visibles = avec.slice(0, MAX_LIGNES);
  return {
    lignes: visibles.map((e) => ({ prenom: e.prenom, valeur: String(e[cle]) })),
    suite: joindre(etAutres(avec.length - visibles.length), phraseSans(sans)),
  };
}

/**
 * Qui n’a pas travaillé ses secteurs. Une ligne par personne, jamais
 * la liste de ses secteurs : quinze collaborateurs ne tiennent pas.
 */
export function detailSecteurs(equipe: readonly RepartitionEquipe[]): DetailSurvol {
  const tries = equipe
    .filter((e) => e.secteursTotal > 0)
    .sort((a, b) => {
      const trouA = a.secteursTotal - a.secteursTravailles;
      const trouB = b.secteursTotal - b.secteursTravailles;
      if (trouB !== trouA) return trouB - trouA;
      return a.prenom.localeCompare(b.prenom, 'fr');
    });
  const visibles = tries.slice(0, MAX_LIGNES);
  return {
    lignes: visibles.map((e) => ({
      prenom: e.prenom,
      valeur: e.secteursTravailles === 0 ? 'Aucun' : `${e.secteursTravailles}/${e.secteursTotal}`,
    })),
    suite: etAutres(tries.length - visibles.length),
  };
}
