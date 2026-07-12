/** Photo de profil par défaut pour les articles de Simon Ropiot. */
export const SIMON_ROPIOT_AUTHOR_IMAGE = '/Tintin_image_2.jpg';

export function resolveAuthorImage(author: string, authorImage?: string): string | undefined {
  if (authorImage) return authorImage;
  if (author.trim() === 'Simon Ropiot') return SIMON_ROPIOT_AUTHOR_IMAGE;
  return undefined;
}
