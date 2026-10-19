/**
 * Télécharger la page d'une annonce, quel que soit le site.
 *
 * Depuis nos serveurs, PAP (Cloudflare), SeLoger, Leboncoin, Logic-Immo
 * (DataDome) et Le Figaro répondent 403. Bright Data Web Unlocker récupère la
 * page comme un navigateur, depuis son réseau, facturé à la page réussie
 * (≈ 1,50 $ les 1 000). Une URL n'est lue qu'une fois pour tout Priimo : le
 * résultat est gardé en base (annonces_imports / annonces).
 *
 * Réglages (Vercel et .env.local) : BRIGHTDATA_API_TOKEN, BRIGHTDATA_ZONE
 * (nom de la zone « Web Unlocker » du tableau de bord Bright Data).
 * https://docs.brightdata.com/scraping-automation/web-unlocker/send-your-first-request
 */

const ENDPOINT = 'https://api.brightdata.com/request';
const DELAI_MS = 45_000;
/** Une page d'annonce dépasse rarement 2 Mo ; au-delà, on ne lit que le début. */
const TAILLE_MAX = 3_000_000;

export type Telechargement =
  | { ok: true; html: string }
  | { ok: false; raison: 'sans_cle' | 'bloquee' | 'disparue' | 'echec' };

export function telechargementConfigure(): boolean {
  return Boolean(process.env.BRIGHTDATA_API_TOKEN && process.env.BRIGHTDATA_ZONE);
}

/** Page vide, page d'erreur ou défi anti-robot encore présent. */
export function pageInexploitable(html: string): 'bloquee' | 'disparue' | null {
  if (html.length < 800) return 'bloquee';
  if (/captcha-delivery\.com|cf-chl-|Just a moment\.\.\.|Please enable JS and disable any ad blocker/i.test(html)) return 'bloquee';
  if (/annonce (?:n'est plus|n’est plus) (?:disponible|en ligne)|cette annonce a été (?:supprimée|désactivée)|page introuvable/i.test(html.slice(0, 200_000))) {
    return 'disparue';
  }
  return null;
}

export async function telechargerPage(url: string): Promise<Telechargement> {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  const zone = process.env.BRIGHTDATA_ZONE;
  if (!token || !zone) return { ok: false, raison: 'sans_cle' };
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone, url, format: 'raw', country: 'fr' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(DELAI_MS),
    });
    // Statut du site visé, quand Bright Data le transmet.
    const statutSite = Number(res.headers.get('x-brd-status-code') ?? res.status);
    if (statutSite === 404 || statutSite === 410) return { ok: false, raison: 'disparue' };
    if (!res.ok) {
      console.error('[import] Bright Data', res.status, (await res.text().catch(() => '')).slice(0, 160));
      return { ok: false, raison: 'echec' };
    }
    const html = (await res.text()).slice(0, TAILLE_MAX);
    const probleme = pageInexploitable(html);
    if (probleme) return { ok: false, raison: probleme };
    return { ok: true, html };
  } catch (err) {
    console.error('[import] Bright Data', err instanceof Error ? err.name : 'réseau');
    return { ok: false, raison: 'echec' };
  }
}
