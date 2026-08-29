/** Photo de profil par défaut pour les articles de l'équipe Priimo. */
export const PRIIMO_TEAM_AUTHOR_IMAGE = '/Tintin_image_2.jpg';

/** @deprecated alias — conserver pour imports existants */
export const SIMON_ROPIOT_AUTHOR_IMAGE = PRIIMO_TEAM_AUTHOR_IMAGE;

export function resolveAuthorImage(author: string, authorImage?: string): string | undefined {
  if (authorImage) return authorImage;
  const n = author.trim();
  if (
    n === 'Simon Ropiot' ||
    n === 'Simon' ||
    n === "L'équipe Priimo" ||
    n === 'L’équipe Priimo'
  ) {
    return PRIIMO_TEAM_AUTHOR_IMAGE;
  }
  return undefined;
}
