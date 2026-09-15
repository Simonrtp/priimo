'use client';

import CarteVideAccueil, { BOUTON_CARTE_VIDE } from './CarteVideAccueil';

/** Les trois gestes du réglage. Trois, pas huit : c'est tout l'argument. */
const ETAPES = [
  'Un nom, puis le contour à main levée sur la carte.',
  'Les rues à retirer, si le voisin en a déjà pris une.',
  'C’est tout. On ne vous le redemandera plus.',
] as const;

const ETAPES_DIRECTION = [
  'Un nom, puis le contour à main levée sur la carte.',
  'Le négociateur qui le tient. Un secteur, un titulaire.',
  'Vos négociateurs peuvent dessiner le leur, vous arbitrez.',
] as const;

/**
 * Personne n'a envie de paramétrer quoi que ce soit. Autant le dire, annoncer
 * la durée réelle, et montrer qu'il n'y a que trois gestes.
 */
export function DessinerMonSecteur({
  estDirecteur,
  onAtelier,
}: {
  estDirecteur: boolean;
  onAtelier: () => void;
}) {
  return (
    <CarteVideAccueil
      titre={estDirecteur ? 'Les secteurs de l’agence' : 'Couverture de mon secteur'}
      accroche="Deux minutes pour définir son terrain, montre en main."
      etapes={estDirecteur ? ETAPES_DIRECTION : ETAPES}
      icone="/emplacement.png"
      action={
        <button type="button" onClick={onAtelier} className={BOUTON_CARTE_VIDE}>
          {estDirecteur ? 'Définir un secteur' : 'Définir mon secteur'}
        </button>
      }
    />
  );
}
