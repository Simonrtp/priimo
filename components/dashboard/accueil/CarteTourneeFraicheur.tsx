'use client';

import CarteVideAccueil, { BOUTON_CARTE_VIDE } from './CarteVideAccueil';

/** Ce qu’on fait en arrivant : les rues, puis autant de secteurs qu’il en faut. */
const ETAPES = [
  'Définir les rues à travailler : mon secteur de prospection.',
  'Vous pouvez définir plusieurs secteurs.',
] as const;

const ETAPES_DIRECTION = [
  'Définir les rues à travailler : le secteur de prospection.',
  'Un négociateur peut en définir plusieurs.',
] as const;

/**
 * Personne n'a envie de paramétrer quoi que ce soit. Deux gestes, pas un mode d'emploi.
 */
export function DessinerMonSecteur({
  estDirecteur,
  onAtelier,
  prenom = null,
}: {
  estDirecteur: boolean;
  onAtelier: () => void;
  prenom?: string | null;
}) {
  return (
    <CarteVideAccueil
      titre={estDirecteur ? 'Les secteurs de l’agence' : prenom ? `Secteur de ${prenom}` : 'Mon secteur'}
      accroche={
        prenom
          ? `${prenom} n’a pas encore dessiné son secteur.`
          : 'Deux minutes pour définir son terrain, montre en main.'
      }
      etapes={prenom ? [] : estDirecteur ? ETAPES_DIRECTION : ETAPES}
      icone="/emplacement.png"
      action={
        prenom ? null : (
        <button type="button" onClick={onAtelier} className={BOUTON_CARTE_VIDE}>
          {estDirecteur ? 'Définir un secteur' : 'Créer mon secteur'}
        </button>
        )
      }
    />
  );
}
