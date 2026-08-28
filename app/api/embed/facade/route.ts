import { guardWidgetRequest } from '@/lib/widget/guard';
import { fetchStreetViewImage, parseFacadeFormat } from '@/lib/facade/street-view';

export const runtime = 'nodejs';

/**
 * Vignette de façade du panneau de contexte, côté public.
 *
 * Même garde que les autres routes du widget : identifiant valide, widget
 * actif, origine autorisée, débit borné. Sans quoi le proxy Street View
 * deviendrait une facture ouverte à tous.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  const guard = await guardWidgetRequest(req, url.searchParams.get('agency'), {
    bucket: 'facade',
    perIp: 60,
    perAgency: 600,
    windowMs: 60 * 60 * 1000,
  });
  if (!guard.ok) return guard.response;

  const latitude = Number(url.searchParams.get('lat'));
  const longitude = Number(url.searchParams.get('lng'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return new Response(null, { status: 400 });
  }

  return fetchStreetViewImage(latitude, longitude, parseFacadeFormat(url.searchParams.get('format')));
}
