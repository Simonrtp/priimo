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
/** Une demande ne dépasse pas cette durée (la route en a 120 s). */
const DELAI_MS = 100_000;
/**
 * Deux demandes en même temps, la première page reçue l'emporte, l'autre est
 * coupée. Chez Bright Data la même page arrive en 23 s ou en 77 s, ou échoue
 * après 105 s (banc du 22/10/2026, PAP et SeLoger) : l'attente suit la plus
 * rapide des deux, et un échec isolé ne coûte plus une minute et demie. Coût :
 * au pire deux pages facturées (≈ 0,3 centime) — Bright Data ne facture que
 * les pages reçues.
 */
const EN_PARALLELE = 2;
/** Une page d'annonce dépasse rarement 2 Mo ; au-delà, on ne lit que le début. */
const TAILLE_MAX = 3_000_000;

export type Telechargement =
  | { ok: true; html: string }
  | { ok: false; raison: 'sans_cle' | 'bloquee' | 'disparue' | 'echec' | 'abandon' };

export function telechargementConfigure(): boolean {
  return Boolean(process.env.BRIGHTDATA_API_TOKEN && process.env.BRIGHTDATA_ZONE);
}

export async function telechargerPage(url: string, signal?: AbortSignal): Promise<Telechargement> {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  const zone = process.env.BRIGHTDATA_ZONE;
  if (signal?.aborted) return { ok: false, raison: 'abandon' };
  if (!token || !zone) return { ok: false, raison: 'sans_cle' };
  // Coupe les demandes restantes dès qu'une page arrive, ou quand l'agent arrête (croix).
  const coupe = new AbortController();
  const arreter = () => coupe.abort();
  signal?.addEventListener('abort', arreter, { once: true });
  try {
    const essais = Array.from({ length: EN_PARALLELE }, () => unEssai(url, token, zone, DELAI_MS, coupe.signal));
    const resultat = await premiereReponseUtile(essais);
    return signal?.aborted ? { ok: false, raison: 'abandon' } : resultat;
  } finally {
    coupe.abort();
    signal?.removeEventListener('abort', arreter);
  }
}

/** Le plus parlant des échecs, quand aucune demande n'a abouti. */
const ORDRE_ECHEC: Record<string, number> = { abandon: 3, bloquee: 2, echec: 1, sans_cle: 0 };

/** La première page reçue (ou une annonce retirée, sans appel) ; sinon le plus parlant des échecs. */
export function premiereReponseUtile(essais: readonly Promise<Telechargement>[]): Promise<Telechargement> {
  return new Promise((resolve) => {
    const echecs: Telechargement[] = [];
    for (const essai of essais) {
      void essai.then((r) => {
        if (r.ok || r.raison === 'disparue') {
          resolve(r);
          return;
        }
        echecs.push(r);
        if (echecs.length === essais.length) {
          resolve(echecs.reduce((a, b) => ((ORDRE_ECHEC[(b as { raison: string }).raison] ?? 0) > (ORDRE_ECHEC[(a as { raison: string }).raison] ?? 0) ? b : a)));
        }
      });
    }
  });
}

async function unEssai(
  url: string,
  token: string,
  zone: string,
  delaiMs: number,
  signal?: AbortSignal,
): Promise<Telechargement> {
  if (signal?.aborted) return { ok: false, raison: 'abandon' };
  const attente = new AbortController();
  const timer = setTimeout(() => attente.abort(), delaiMs);
  const couper = () => attente.abort();
  signal?.addEventListener('abort', couper, { once: true });
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone, url, format: 'raw', country: 'fr' }),
      cache: 'no-store',
      signal: attente.signal,
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
    if (signal?.aborted) return { ok: false, raison: 'abandon' };
    console.error('[import] Bright Data', err instanceof Error ? err.name : 'réseau');
    return { ok: false, raison: 'echec' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', couper);
  }
}
