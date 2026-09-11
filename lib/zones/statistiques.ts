import { adresseAJuger, decouperAdresse, normaliserVoie } from './adresse';
import { adresseDansZone } from './appartenance';
import type { Zone } from './types';

/**
 * Ce qu'on sait d'un secteur une fois qu'il est tracé.
 *
 * Le dénominateur, c'est le parc open data : les immeubles réellement présents
 * dans le périmètre, pas les adresses que Priimo a livrées. Compter la
 * couverture sur ses propres leads reviendrait à se noter sur sa propre copie —
 * un secteur avec trois adresses serait couvert à 100 % en une matinée.
 *
 * Rien n'est saisi à la main : un immeuble est vu parce qu'une note terrain,
 * une rencontre ou un changement d'étape l'a signalé, jamais parce que
 * quelqu'un a coché une case.
 */

/** Un immeuble du parc, tel qu'il est stocké dans `buildings`. */
export type ImmeubleParc = {
  banId: string;
  adresse: string | null;
  codePostal: string | null;
  latitude: number | null;
  longitude: number | null;
  parcelleId?: string | null;
};

/** Une adresse livrée par Priimo, réduite à ce qui permet de la situer. */
export type AdresseSituable = {
  address: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type RueDuSecteur = { nom: string; immeubles: number };

export type StatistiquesSecteur = {
  /** Immeubles du parc qui tombent dans le périmètre. */
  immeubles: number;
  /** Rues distinctes qui les portent. */
  rues: number;
  /** Ceux où Priimo a observé au moins un passage. */
  immeublesVus: number;
  /** Part des immeubles vus, de 0 à 100. Null quand le parc est muet. */
  couverture: number | null;
  /** Adresses livrées par Priimo qui tombent dans le périmètre. */
  adressesPriimo: number;
  /** Les rues les mieux fournies, pour donner une prise aux chiffres. */
  principalesRues: RueDuSecteur[];
};

const RUES_MISES_EN_AVANT = 4;

/**
 * Le libellé le plus lisible pour une même rue : les adresses du parc écrivent
 * « AVENUE GAMBETTA » aussi bien que « Avenue Gambetta ». On garde la forme la
 * moins criarde plutôt que la première rencontrée.
 */
function meilleurLibelle(a: string, b: string): string {
  const crie = (s: string) => s === s.toUpperCase();
  if (crie(a) !== crie(b)) return crie(a) ? b : a;
  return a.length <= b.length ? a : b;
}

export function statistiquesSecteur(params: {
  zone: Zone;
  parc: readonly ImmeubleParc[];
  /** ban_id où un passage a été observé, tous collègues confondus. */
  passages: ReadonlySet<string>;
  leads: readonly AdresseSituable[];
}): StatistiquesSecteur {
  const { zone, parc, passages, leads } = params;

  const vus = new Set<string>();
  const dedans = new Set<string>();
  const rues = new Map<string, RueDuSecteur>();

  for (const immeuble of parc) {
    // Le même ban_id revient une fois par entrée d'immeuble : une porte
    // cochère n'est pas deux immeubles.
    if (dedans.has(immeuble.banId)) continue;

    const situation = adresseAJuger({
      address: immeuble.adresse,
      postalCode: immeuble.codePostal,
      latitude: immeuble.latitude,
      longitude: immeuble.longitude,
      parcelleId: immeuble.parcelleId ?? null,
    });
    if (!adresseDansZone(situation, zone)) continue;

    dedans.add(immeuble.banId);
    if (passages.has(immeuble.banId)) vus.add(immeuble.banId);

    const nomVoie = decouperAdresse(immeuble.adresse).nomVoie;
    if (!nomVoie) continue;
    const cle = normaliserVoie(nomVoie);
    if (cle === '') continue;
    const connue = rues.get(cle);
    if (connue) {
      connue.nom = meilleurLibelle(connue.nom, nomVoie);
      connue.immeubles += 1;
    } else {
      rues.set(cle, { nom: nomVoie, immeubles: 1 });
    }
  }

  const adressesPriimo = leads.filter((lead) =>
    adresseDansZone(adresseAJuger(lead), zone),
  ).length;

  const principalesRues = [...rues.values()]
    .sort((a, b) => b.immeubles - a.immeubles || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, RUES_MISES_EN_AVANT);

  return {
    immeubles: dedans.size,
    rues: rues.size,
    immeublesVus: vus.size,
    couverture: dedans.size === 0 ? null : Math.round((vus.size / dedans.size) * 100),
    adressesPriimo,
    principalesRues,
  };
}
