export interface ParisArrondissement {
  code: string;
  /** Ex. « 13e » */
  shortLabel: string;
  /** Ex. « Paris 13e » */
  label: string;
}

const ORDINALS: Record<number, string> = {
  1: '1er',
  2: '2e',
  3: '3e',
  4: '4e',
  5: '5e',
  6: '6e',
  7: '7e',
  8: '8e',
  9: '9e',
  10: '10e',
  11: '11e',
  12: '12e',
  13: '13e',
  14: '14e',
  15: '15e',
  16: '16e',
  17: '17e',
  18: '18e',
  19: '19e',
  20: '20e',
};

export const PARIS_ARRONDISSEMENT_MIN = 1;
export const PARIS_ARRONDISSEMENT_MAX = 20;

export const PARIS_ARRONDISSEMENTS: ParisArrondissement[] = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  const code = `750${String(n).padStart(2, '0')}`;
  const shortLabel = ORDINALS[n] ?? `${n}e`;
  return {
    code,
    shortLabel,
    label: `Paris ${shortLabel}`,
  };
});

export const PARIS_POSTAL_CODE_SET = new Set(PARIS_ARRONDISSEMENTS.map((a) => a.code));
