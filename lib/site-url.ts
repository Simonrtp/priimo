function productionSiteUrl(): string | undefined {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) return `https://${productionHost}`;
  return undefined;
}

/** Canonical public URL — set NEXT_PUBLIC_SITE_URL=https://priimo.fr on Vercel production. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  productionSiteUrl() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}
