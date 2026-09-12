import type { CorrectionLine } from '@/lib/estimation/corrections';
import { indiceQualitePct } from '@/lib/estimation/grille';
import type { GrilleSaisie } from '@/lib/estimation/grille';
import type { EstimationOccupation } from '@/lib/estimation/cycle';

const TAUX_CAPITALISATION = 0.055;

export type AjustementAgent = {
  travauxEur: number;
  decoteOccupationEur: number;
  autresEur: number;
  justification: string | null;
};

export type LigneValeur = CorrectionLine & {
  /** Pour le survol : « établi sur n ventes ». */
  hint: string | null;
};

export type DecompositionValeur = {
  methode: 'comparaison' | 'capitalisation';
  lignes: LigneValeur[];
  valeur: number;
  low: number | null;
  high: number | null;
  netVendeur: number;
};

function roundEuro(n: number): number {
  return Math.round(n / 100) * 100;
}

function hintVentes(n: number | null): string | null {
  if (n == null || n <= 0) return 'Ajustement forfaitaire — pas calibré sur un échantillon.';
  return `Établi sur ${n} vente${n > 1 ? 's' : ''} réelle${n > 1 ? 's' : ''}.`;
}

export function avecHints(lines: readonly CorrectionLine[]): LigneValeur[] {
  return lines.map((l) => ({
    ...l,
    hint: l.kind === 'total' ? null : hintVentes(l.sampleSize),
  }));
}

export function appliquerQualiteEtAgent(
  baseLines: readonly CorrectionLine[],
  input: {
    grille: GrilleSaisie;
    agent: AjustementAgent;
    honorairesPct: number;
    netVendeur: boolean;
    rangePct: number;
  },
): DecompositionValeur {
  const horsTotal = baseLines.filter((l) => l.kind !== 'total');
  const lignes: LigneValeur[] = avecHints(horsTotal);
  const sousTotal = horsTotal.reduce((s, l) => s + l.amountEur, 0);

  const qualite = indiceQualitePct(input.grille);
  if (qualite != null && qualite !== 0) {
    const amount = roundEuro(sousTotal * qualite);
    lignes.push({
      id: 'qualite',
      label: `Indice de qualité (${qualite > 0 ? '+' : ''}${Math.round(qualite * 100)} %)`,
      amountEur: amount,
      sampleSize: null,
      kind: 'ajustement',
      hint: 'Plafonné à ±10 %. Uniquement les critères renseignés.',
    });
  }

  if (input.agent.travauxEur !== 0) {
    lignes.push({
      id: 'travaux',
      label: 'Travaux à réaliser',
      amountEur: -Math.abs(roundEuro(input.agent.travauxEur)),
      sampleSize: null,
      kind: 'ajustement',
      hint: input.agent.justification,
    });
  }
  if (input.agent.decoteOccupationEur !== 0) {
    lignes.push({
      id: 'occupation',
      label: 'Décote pour occupation',
      amountEur: -Math.abs(roundEuro(input.agent.decoteOccupationEur)),
      sampleSize: null,
      kind: 'ajustement',
      hint: input.agent.justification,
    });
  }
  if (input.agent.autresEur !== 0) {
    lignes.push({
      id: 'autres',
      label: 'Autre ajustement',
      amountEur: roundEuro(input.agent.autresEur),
      sampleSize: null,
      kind: 'ajustement',
      hint: input.agent.justification,
    });
  }

  const valeur = roundEuro(lignes.reduce((s, l) => s + l.amountEur, 0));
  lignes.push({
    id: 'total',
    label: 'Valeur',
    amountEur: valeur,
    sampleSize: null,
    kind: 'total',
    hint: null,
  });

  const honoraires = Math.max(0, input.honorairesPct) / 100;
  const net = input.netVendeur ? roundEuro(valeur * (1 - honoraires)) : valeur;
  const half = Math.round(valeur * input.rangePct);

  return {
    methode: 'comparaison',
    lignes,
    valeur,
    low: half > 0 ? valeur - half : null,
    high: half > 0 ? valeur + half : null,
    netVendeur: net,
  };
}

/**
 * Capitalisation : uniquement si le bien est occupé et qu'un loyer annuel
 * est saisi. Pas de moyenne avec la comparaison.
 */
export function capitaliser(input: {
  occupation: EstimationOccupation;
  loyerAnnuel: number | null;
  honorairesPct: number;
  netVendeur: boolean;
}): DecompositionValeur | null {
  if (input.occupation !== 'occupe') return null;
  const loyer = input.loyerAnnuel;
  if (loyer == null || !Number.isFinite(loyer) || loyer <= 0) return null;
  const valeur = roundEuro(loyer / TAUX_CAPITALISATION);
  const honoraires = Math.max(0, input.honorairesPct) / 100;
  const net = input.netVendeur ? roundEuro(valeur * (1 - honoraires)) : valeur;
  return {
    methode: 'capitalisation',
    lignes: [
      {
        id: 'loyer',
        label: `Loyer annuel ${loyer.toLocaleString('fr-FR')} €`,
        amountEur: loyer,
        sampleSize: null,
        kind: 'base',
        hint: `Capitalisé à ${(TAUX_CAPITALISATION * 100).toFixed(1).replace('.', ',')} %.`,
      },
      {
        id: 'total',
        label: 'Valeur locative capitalisée',
        amountEur: valeur,
        sampleSize: null,
        kind: 'total',
        hint: null,
      },
    ],
    valeur,
    low: null,
    high: null,
    netVendeur: net,
  };
}

export const TAUX_CAPITALISATION_PCT = TAUX_CAPITALISATION * 100;
