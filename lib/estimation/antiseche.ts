/** Antisèche pour l’agent : ce qu’on peut dire, pas un ordre à suivre. */

export type GroupeAntiseche = {
  titre: string;
  champs: string;
};

export const GROUPES_ANTISECHE_ESTIMATION: readonly GroupeAntiseche[] = [
  {
    titre: 'Le bien',
    champs: 'type, pièces, chambres, surface, Carrez, terrain, niveaux, étage, occupation, année si dite',
  },
  {
    titre: 'Caractéristiques',
    champs: 'emplacement, ascenseur, balcon ou terrasse',
  },
  {
    titre: 'Charges',
    champs: 'loyer, charges, copro, taxe foncière',
  },
  {
    titre: 'Annexes',
    champs: 'cave, parking, box, terrasse — surface ou valeur si tu l’as',
  },
  {
    titre: 'Énergie',
    champs: 'DPE, GES, conso, version du DPE',
  },
  {
    titre: 'Points forts',
    champs: 'atouts, défauts, ce qui se voit (lumineux, moulures…)',
  },
];
