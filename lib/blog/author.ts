/** Photo de profil par défaut pour les articles de l'équipe Priimo. */
export const PRIIMO_TEAM_AUTHOR_IMAGE = '/Tintin_image_2.jpg';

export function resolveAuthorImage(author: string, authorImage?: string): string | undefined {
  if (authorImage) return authorImage;
  const n = author.trim();
  if (n === "L'équipe Priimo" || n === 'L’équipe Priimo' || n.toLowerCase().includes('priimo')) {
    return PRIIMO_TEAM_AUTHOR_IMAGE;
  }
  return PRIIMO_TEAM_AUTHOR_IMAGE;
}
