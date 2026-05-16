/**
 * URL Calendly pour réserver une démo Priimo.
 *
 * Source de vérité : la variable d'environnement `NEXT_PUBLIC_CALENDLY_URL`.
 * Le fallback est utilisé pour le développement local et les previews tant
 * que la variable n'est pas définie côté Vercel.
 */
export const CALENDLY_URL: string =
  process.env.NEXT_PUBLIC_CALENDLY_URL ??
  "https://calendly.com/simon-ropiot44/nouvelle-reunion";
