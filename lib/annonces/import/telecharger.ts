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
import 'server-only';
import { pageInexploitable } from './pages';

const ENDPOINT = 'https://api.brightdata.com/request';
/** Leboncoin et SeLoger, rendus par un navigateur chez Bright Data : 30 à 55 s constatés. */
const DELAI_MS = 90_000;
/**
 * Une page qui n'arrive pas (réseau, défi anti-robot) est redemandée une fois,
 * tant que le tout tient dans la durée de la route (120 s) : Bright Data ne
 * facture que les pages reçues.
 */
const ESSAIS = 2;
const BUDGET_MS = 105_000;
const DELAI_MIN_ESSAI_MS = 25_000;
/** Une page d'annonce dépasse rarement 2 Mo ; au-delà, on ne lit que le début. */
const TAILLE_MAX = 3_000_000;

export type Telechargement =
  | { ok: true; html: string }
  | { ok: false; raison: 'sans_cle' | 'bloquee' | 'disparue' | 'echec' };

export function telechargementConfigure(): boolean {
  return Boolean(process.env.BRIGHTDATA_API_TOKEN && process.env.BRIGHTDATA_ZONE);
}

export async function telechargerPage(url: string): Promise<Telechargement> {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  const zone = process.env.BRIGHTDATA_ZONE;
  if (!token || !zone) return { ok: false, raison: 'sans_cle' };
  const debut = Date.now();
  let dernier: Telechargement = { ok: false, raison: 'echec' };
  for (let essai = 0; essai < ESSAIS; essai += 1) {
    const reste = BUDGET_MS - (Date.now() - debut);
    if (essai > 0 && reste < DELAI_MIN_ESSAI_MS) break;
    dernier = await unEssai(url, token, zone, Math.min(DELAI_MS, reste));
    if (dernier.ok || dernier.raison === 'disparue') return dernier;
  }
  return dernier;
}

async function unEssai(url: string, token: string, zone: string, delaiMs: number): Promise<Telechargement> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone, url, format: 'raw', country: 'fr' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(delaiMs),
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
