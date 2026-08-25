import { labelCherche, type AssistantIntent } from './intent';

export const MESSAGE_AIDE =
  'La recherche porte sur ce qui est déjà dans votre base : une adresse, une personne, des acquéreurs dont les critères correspondent, ou l\'activité récente. Reformulez autour de l\'un de ces sujets.';

export function messageAucuneLigne(intent: AssistantIntent): string {
  return `Aucune information en base sur ${labelCherche(intent)}`;
}
