/**
 * Forces et faiblesses : uniquement à partir des caractéristiques saisies.
 * Aucun fait inventé (quartier, vue, « calme », etc.).
 */

export type FicheStrategie = {
  propertyType: 'appartement' | 'maison' | null;
  surfaceM2: number | null;
  rooms: number | null;
  floor: string | null;
  anneeConstruction: number | null;
  dpeClass: string | null;
  conditionRating: 1 | 2 | 3 | 4 | null;
  ascenseur: boolean | null;
  balconTerrasse: boolean | null;
  piscine: boolean | null;
  terrainM2: number | null;
  annexes: readonly { libelle: string }[];
  commentairesPublics: string | null;
};

export function promptStrategie(fiche: FicheStrategie): string {
  const lignes: string[] = [
    'Rédige deux listes courtes, en français, pour un avis de valeur immobilier.',
    'Forces et faiblesses uniquement à partir des faits ci-dessous. N’invente rien.',
    'N’évoque pas le quartier, la vue, le calme, les écoles, ni un prix.',
    'Réponds en JSON : {"forces":["…"],"faiblesses":["…"]}. Maximum 4 items chacune.',
    '',
    'Faits :',
  ];
  if (fiche.propertyType) lignes.push(`- Type : ${fiche.propertyType}`);
  if (fiche.surfaceM2) lignes.push(`- Surface : ${fiche.surfaceM2} m²`);
  if (fiche.rooms) lignes.push(`- Pièces : ${fiche.rooms}`);
  if (fiche.floor) lignes.push(`- Étage : ${fiche.floor}`);
  if (fiche.anneeConstruction) lignes.push(`- Année : ${fiche.anneeConstruction}`);
  if (fiche.dpeClass) lignes.push(`- DPE : ${fiche.dpeClass}`);
  if (fiche.conditionRating != null) lignes.push(`- État (1 à 4) : ${fiche.conditionRating}`);
  if (fiche.ascenseur === true) lignes.push('- Ascenseur : oui');
  if (fiche.ascenseur === false) lignes.push('- Ascenseur : non');
  if (fiche.balconTerrasse) lignes.push('- Balcon ou terrasse');
  if (fiche.piscine) lignes.push('- Piscine');
  if (fiche.terrainM2) lignes.push(`- Terrain : ${fiche.terrainM2} m²`);
  for (const a of fiche.annexes) {
    if (a.libelle.trim()) lignes.push(`- Annexe : ${a.libelle.trim()}`);
  }
  if (fiche.commentairesPublics?.trim()) {
    lignes.push(`- Notes de l’agent : ${fiche.commentairesPublics.trim()}`);
  }
  return lignes.join('\n');
}

export function parserStrategie(raw: string): { forces: string[]; faiblesses: string[] } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { forces: [], faiblesses: [] };
  try {
    const json = JSON.parse(match[0]) as { forces?: unknown; faiblesses?: unknown };
    const list = (v: unknown) =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, 4)
        : [];
    return { forces: list(json.forces), faiblesses: list(json.faiblesses) };
  } catch {
    return { forces: [], faiblesses: [] };
  }
}
