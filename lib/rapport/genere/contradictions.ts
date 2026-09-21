import { numeroEtage } from '@/lib/estimation/etages';
import { parseDpeLetter } from '@/lib/carte/dpe-public';

export type ContradictionRapport = {
  id: 'ascenseur' | 'etage' | 'surface' | 'dpe';
  label: string;
};

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’]/g, ' ');
}

function mentionneAscenseur(n: string): boolean {
  return /\bascenseur\b/.test(n);
}

function nieAscenseur(n: string): boolean {
  return (
    /\bsans ascenseur\b/.test(n) ||
    /\bpas d.? ascenseur\b/.test(n) ||
    /\baucun ascenseur\b/.test(n) ||
    /\babsence d.? ascenseur\b/.test(n)
  );
}

function etagesDansTexte(n: string): number[] {
  const out: number[] = [];
  if (/\brez[- ]de[- ]chaussee\b|\brdc\b/.test(n)) out.push(0);
  for (const m of n.matchAll(/\b(\d{1,2})\s*(?:e|eme|er)\s*etage\b/g)) {
    const v = Number(m[1]);
    if (Number.isFinite(v)) out.push(v);
  }
  return [...new Set(out)];
}

function surfacesDansTexte(n: string): number[] {
  const out: number[] = [];
  for (const m of n.matchAll(/\b(\d{2,4}(?:[.,]\d)?)\s*m(?:2|²)\b/g)) {
    const v = Number(m[1]!.replace(',', '.'));
    if (Number.isFinite(v) && v >= 9 && v <= 2000) out.push(v);
  }
  return out;
}

function dpeDansTexte(n: string): string | null {
  const m = n.match(/\bdpe\s*(?:classe\s*)?([a-g])\b/);
  return m?.[1] ? m[1].toUpperCase() : null;
}

export function contradictionsCommentaire(input: {
  commentaire: string | null;
  ascenseur: boolean | null;
  floor: string | null;
  surfaceM2: number | null;
  dpeClass: string | null;
}): ContradictionRapport[] {
  const brut = input.commentaire?.trim() ?? '';
  if (!brut) return [];
  const n = normaliser(brut);
  const out: ContradictionRapport[] = [];

  if (input.ascenseur === false && mentionneAscenseur(n) && !nieAscenseur(n)) {
    out.push({
      id: 'ascenseur',
      label: 'La description mentionne un ascenseur alors que le champ indique « sans ascenseur »',
    });
  }
  if (input.ascenseur === true && nieAscenseur(n)) {
    out.push({
      id: 'ascenseur',
      label: 'La description indique l’absence d’ascenseur alors que le champ indique « avec ascenseur »',
    });
  }

  const etageChamp = numeroEtage(input.floor);
  const etagesTexte = etagesDansTexte(n);
  if (etageChamp != null && etagesTexte.length > 0 && !etagesTexte.includes(etageChamp)) {
    out.push({
      id: 'etage',
      label: 'L’étage de la description ne correspond pas au champ étage',
    });
  }

  if (input.surfaceM2 != null && input.surfaceM2 > 0) {
    const surfaces = surfacesDansTexte(n);
    const ecart = surfaces.some((s) => Math.abs(s - input.surfaceM2!) / input.surfaceM2! > 0.08);
    if (surfaces.length > 0 && ecart) {
      out.push({
        id: 'surface',
        label: 'La surface citée dans la description s’écarte du champ surface habitable',
      });
    }
  }

  const dpeTexte = dpeDansTexte(n);
  const dpeChamp = parseDpeLetter(input.dpeClass);
  if (dpeTexte && dpeChamp && dpeTexte !== dpeChamp) {
    out.push({
      id: 'dpe',
      label: `La description cite un DPE ${dpeTexte} alors que le champ indique ${dpeChamp}`,
    });
  }

  return out;
}
