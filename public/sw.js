/**
 * Service worker de Priimo — volontairement minimal.
 *
 * RÈGLE ABSOLUE : rien de ce qui vient du métier n'est mis en cache. Ni les
 * leads, ni les contacts, ni les biens, ni aucune réponse d'API, ni aucune page
 * HTML du tableau de bord. Un agent doit pouvoir se fier à ce qu'il lit ; une
 * donnée périmée servie depuis le disque serait pire qu'une erreur réseau.
 *
 * Le cache se limite donc à une liste blanche d'assets immuables : les bundles
 * de build (`/_next/static/**`, dont le nom contient un hash de contenu), les
 * icônes et le manifeste. Tout le reste passe au réseau sans interception.
 *
 * Pour invalider le cache après un changement d'assets non hachés (icônes,
 * page hors ligne), incrémenter CACHE_VERSION.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `priimo-static-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline.html';

/** Servis dès l'installation : ils doivent exister même sans réseau. */
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
];

/** Préfixes dont tout le contenu est un asset de build immuable. */
const CACHEABLE_PREFIXES = ['/_next/static/', '/icons/'];

/** Fichiers statiques isolés à la racine de `public`. */
const CACHEABLE_PATHS = new Set([
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/icon-48.png',
  '/icon-192.png',
  '/apple-touch-icon.png',
]);

/**
 * Seule porte d'entrée du cache. Tout ce qui n'est pas explicitement autorisé
 * ici part au réseau : c'est une liste blanche, jamais une liste noire.
 */
function isCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (CACHEABLE_PATHS.has(url.pathname)) return true;
  return CACHEABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // `reload` évite de recopier une version déjà périmée du cache HTTP.
      await cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Asset immuable : le cache fait foi, le réseau ne sert qu'au premier accès. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // `basic` = même origine et réponse lisible : on ne stocke ni opaque ni erreur.
  if (response.ok && response.type === 'basic') {
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * Navigation : toujours le réseau. En cas d'échec réel (hors ligne), on affiche
 * une page d'attente statique — jamais une version en cache du tableau de bord.
 */
async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ??
      new Response('Hors ligne', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkOnlyWithOfflineFallback(request));
    return;
  }

  if (isCacheable(url)) {
    event.respondWith(cacheFirst(request));
  }
  // Sinon : aucune interception, le navigateur fait sa requête normalement.
});

/** Permet à la page de forcer l'activation d'une nouvelle version. */
self.addEventListener('message', (event) => {
  if (event.data === 'priimo:skip-waiting') void self.skipWaiting();
});
