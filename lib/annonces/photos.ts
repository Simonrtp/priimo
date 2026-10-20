import { execFile } from 'node:child_process';
import type { Portail } from './types';

const HOTES_PAP = new Set(['pap.fr', 'www.pap.fr']);
const PHOTO_PAP =
  /https:\/\/cdn\.pap\.fr\/photos\/pap\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{32}\/[a-f0-9]-p\d+\.(?:jpe?g|webp)/gi;
const MAX_PHOTOS = 24;
const CACHE_MS = 10 * 60 * 1000;

const cache = new Map<string, { at: number; photos: string[] }>();

/** Les URLs de la galerie PAP, dans l’ordre de la page, sans doublon. */
export function extrairePhotosPap(html: string): string[] {
  const vues = new Set<string>();
  const photos: string[] = [];
  for (const match of html.matchAll(PHOTO_PAP)) {
    const url = match[0];
    if (vues.has(url)) continue;
    vues.add(url);
    photos.push(url);
    if (photos.length >= MAX_PHOTOS) break;
  }
  return photos;
}

function pagePap(url: string): URL | null {
  try {
    const page = new URL(url);
    if (page.protocol !== 'https:' || !HOTES_PAP.has(page.hostname)) return null;
    if (page.username || page.password || (page.port !== '' && page.port !== '443')) return null;
    return page;
  } catch {
    return null;
  }
}

const NAVIGATEUR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
/** curl passe la page publique ; le fetch Node reçoit la page « un instant » de Cloudflare. */
function lireViaCurl(url: string): Promise<string> {
  const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
  return new Promise((resolve) => {
    execFile(
      curl,
      ['-sL', '--max-redirs', '0', '--max-time', '2', '-A', NAVIGATEUR, '-H', 'Accept-Language: fr-FR,fr;q=0.9', url],
      { encoding: 'utf8', timeout: 3000, maxBuffer: 2_000_000, windowsHide: true },
      (err, stdout) => {
        resolve(err || typeof stdout !== 'string' ? '' : stdout);
      },
    );
  });
}

/**
 * Photos de l’annonce, lues sur sa page publique au moment où la fiche s’ouvre.
 * Seul PAP est lu : l’URL vient de notre base, et on ne suit pas un autre hôte.
 */
export async function photosPubliques(portail: Portail, url: string): Promise<string[]> {
  if (portail !== 'pap') return [];
  const page = pagePap(url);
  if (!page) return [];

  const garde = cache.get(page.href);
  if (garde && Date.now() - garde.at < CACHE_MS) return garde.photos;

  const html = await lireViaCurl(page.href);
  const finale = html.includes('cdn.pap.fr/photos');
  const photos = finale ? extrairePhotosPap(html.slice(0, 1_500_000)) : [];
  if (photos.length > 0) {
    if (cache.size > 200) cache.clear();
    cache.set(page.href, { at: Date.now(), photos });
  }
  return photos;
}

