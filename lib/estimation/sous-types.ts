/** Sous-types de bien — ordre et libellés alignés sur le référentiel métier. */
export const SOUS_TYPES_BIEN = [
  'Appartement',
  'Duplex',
  'Triplex',
  'Souplex',
  'Chambre',
  'Penthouse',
  'Studio',
  'Loft',
  'Atelier d\'artiste',
  'Cave',
  'Maison',
  'Mas',
  'Manoir',
  'Bastide',
  'Chalet',
  'Longère',
  'Propriété',
  'Villa',
  'Château',
  'Hôtel particulier',
  'Ferme',
  'Grange',
  'Maison de maître',
  'Maison individuelle',
  'Maison en copropriété',
  'Maison contemporaine',
  'Maison de ville',
  'Maison de village',
  'Maison troglodytique',
  'Maison d\'architecte',
  'Haut de villa',
  'Bas de villa',
  'Moulin',
  'Cabanon',
  'Immeuble',
  'Immeuble de rapport',
  'Ensemble immobilier',
  'Commerce',
  'Fonds de commerce',
  'Murs commerciaux',
  'Bureaux',
  'Entrepôt',
  'Local commercial',
  'Local d\'activité',
  'Local professionnel',
  'Garage',
  'Parking',
  'Parking ouvert',
  'Box',
  'Terrain',
  'Terrain à bâtir',
  'Terrain agricole',
  'Terrain de loisir',
  'Hangar',
] as const;

export type SousTypeBien = (typeof SOUS_TYPES_BIEN)[number];

export function optionsSousType(selected: string | null): { value: string; label: string }[] {
  const courant = selected?.trim();
  const ordre =
    courant && !SOUS_TYPES_BIEN.includes(courant as SousTypeBien)
      ? [courant, ...SOUS_TYPES_BIEN]
      : [...SOUS_TYPES_BIEN];
  return [
    { value: '', label: 'Non renseigné' },
    ...ordre.map((label) => ({ value: label, label })),
  ];
}
