/**
 * Service worker de Priimo.
 *
 * Le réseau gagne toujours quand il répond. S'il lâche, on relit la dernière
 * page du tableau de bord déjà ouverte sur cet appareil : l'agent voit ses
 * leads, sa carte et sa liste plutôt qu'un écran vide.
 *
 * On ne met jamais en cache les API, ni les envois (POST). Les bundles de
 * build (`/_next/static/**`), les icônes et le manifeste restent en liste
 * blanche, servis depuis le disque.
 *
 * Pour invalider le cache après un changement d'assets non hachés (icônes,
 * page hors ligne), incrémenter CACHE_VERSION.
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `priimo-static-${CACHE_VERSION}`;
/** Dernières pages HTML ouvertes. Survivent à un changement de CACHE_VERSION. */
const PAGES_CACHE = 'priimo-pages';
/** Derniers chargements du routeur (RSC), distincts du HTML. */
const RSC_CACHE = 'priimo-rsc';
const PAGES_MAX = 40;

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
      const garder = new Set([CACHE_NAME, PAGES_CACHE, RSC_CACHE]);
      await Promise.all(
        names.filter((name) => !garder.has(name)).map((name) => caches.delete(name)),
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

function estRsc(request) {
  if (request.headers.get('RSC') === '1') return true;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/x-component');
}

/** Page de l'application, pas un asset ni une API. */
function estPageApp(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/_next/')) return false;
  if (isCacheable(url)) return false;
  return true;
}

async function memoriser(cacheName, request, response) {
  if (!response.ok || response.type !== 'basic' || response.redirected) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  const cles = await cache.keys();
  if (cles.length > PAGES_MAX) await cache.delete(cles[0]);
}

/**
 * Réseau d'abord. S'il ne répond pas, la dernière version de cette page.
 * L'écran « Pas de connexion » ne sort que si rien n'a encore été ouvert ici.
 */
async function reseauPuisMemoire(request, cacheName) {
  try {
    const response = await fetch(request);
    await memoriser(cacheName, request, response);
    return response;
  } catch (error) {
    // Navigation annulée (tap fantôme, chargement interrompu) : ne pas
    // remplacer le tableau de bord par la page « Pas de connexion ».
    if (error && error.name === 'AbortError') throw error;
    const cache = await caches.open(cacheName);
    const garde = await cache.match(request);
    if (garde) return garde;
    if (request.mode !== 'navigate') throw error;
    const statique = await caches.open(CACHE_NAME);
    const offline = await statique.match(OFFLINE_URL);
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

  if (request.mode === 'navigate' && estPageApp(url)) {
    event.respondWith(reseauPuisMemoire(request, PAGES_CACHE));
    return;
  }

  if (estRsc(request) && estPageApp(url)) {
    event.respondWith(reseauPuisMemoire(request, RSC_CACHE));
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

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Brief du matin. Le `tag` garantit qu'un seul brief reste affiche : si celui
 * d'hier n'a pas ete ouvert, il est remplace plutot qu'empile.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const titre = data.titre || 'Priimo';
  const options = {
    body: data.corps || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'priimo',
    renotify: true,
    data: { url: data.url || '/dashboard' },
  };

  event.waitUntil(self.registration.showNotification(titre, options));
});

/**
 * Un clic ramene sur l'onglet deja ouvert quand il y en a un : ouvrir une
 * seconde fenetre du tableau de bord desoriente plus qu'autre chose.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const cible = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const fenetre of fenetres) {
        if (fenetre.url.includes('/dashboard') && 'focus' in fenetre) {
          fenetre.navigate(cible);
          return fenetre.focus();
        }
      }
      return self.clients.openWindow(cible);
    }),
  );
});
