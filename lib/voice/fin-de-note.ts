/**
 * « Fin de note » : l'agent termine sans toucher l'écran, téléphone en poche
 * ou mains prises. La formule est retirée du texte gardé.
 *
 * On ne l'écoute qu'en toute fin de transcription, pour ne pas couper une note
 * qui parlerait d'une « fin de note de frais ».
 */

const FORMULE = /(?:^|[\s,.;!?…-])(?:fin de (?:la )?note|fin de dictée|terminer la note)[\s.!?…]*$/i;

export function finDeNoteDite(texte: string): boolean {
  return FORMULE.test(texte.trim());
}

export function retirerFinDeNote(texte: string): string {
  return texte.trim().replace(FORMULE, '').replace(/[\s,;-]+$/, '').trim();
}
