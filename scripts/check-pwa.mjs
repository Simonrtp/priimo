/**
 * Contrôle d'installabilité de la PWA contre un serveur en fonctionnement.
 *
 * Reprend les critères que Chrome et Lighthouse vérifient réellement :
 * manifeste servi et valide, icônes 192 et 512 présentes, service worker
 * accessible avec un gestionnaire `fetch`. Le HTTPS est assuré par Vercel.
 *
 * Usage : node scripts/check-pwa.mjs [origine]
 */
const ORIGIN = process.argv[2] ?? 'http://localhost:3100';

let failures = 0;

function check(label, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function head(path) {
  const res = await fetch(`${ORIGIN}${path}`, { redirect: 'manual' });
  return res;
}

async function main() {
  console.log(`Contrôle PWA sur ${ORIGIN}\n`);

  // --- Manifeste ---
  const manifestRes = await head('/manifest.json');
  check('/manifest.json répond 200', manifestRes.status === 200, `statut ${manifestRes.status}`);
  check(
    'Content-Type du manifeste',
    (manifestRes.headers.get('content-type') ?? '').includes('manifest+json'),
    manifestRes.headers.get('content-type') ?? 'absent',
  );

  const manifest = await manifestRes.json();
  check('name', manifest.name === 'Priimo', manifest.name);
  check('short_name', manifest.short_name === 'Priimo', manifest.short_name);
  check('display autorise l’installation', ['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display), manifest.display);
  check('theme_color orange', manifest.theme_color === '#E8743C', manifest.theme_color);
  check('background_color crème', manifest.background_color === '#FFF7F0', manifest.background_color);
  check('orientation portrait', manifest.orientation === 'portrait', manifest.orientation);
  check('start_url défini', typeof manifest.start_url === 'string', manifest.start_url);

  const sizes = new Set((manifest.icons ?? []).map((i) => i.sizes));
  check('icône 192x192', sizes.has('192x192'));
  check('icône 512x512', sizes.has('512x512'));
  check(
    'icône maskable',
    (manifest.icons ?? []).some((i) => (i.purpose ?? '').includes('maskable')),
  );

  // --- Icônes réellement servies ---
  for (const icon of manifest.icons ?? []) {
    const res = await head(icon.src);
    check(`${icon.src} servi`, res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('image/'), `statut ${res.status}`);
  }

  // --- Service worker ---
  const swRes = await head('/sw.js');
  const swBody = await swRes.text();
  check('/sw.js répond 200', swRes.status === 200, `statut ${swRes.status}`);
  check(
    'servi comme JavaScript',
    (swRes.headers.get('content-type') ?? '').includes('javascript'),
    swRes.headers.get('content-type') ?? 'absent',
  );
  check('gestionnaire fetch présent', /addEventListener\(\s*['"]fetch['"]/.test(swBody));
  check('revalidation forcée', (swRes.headers.get('cache-control') ?? '').includes('max-age=0'));

  // --- Garde-fou : aucune donnée métier mise en cache ---
  check(
    'les routes /api/ sont exclues du cache',
    swBody.includes("url.pathname.startsWith('/api/')") && swBody.includes('return false'),
  );
  check(
    'la navigation ne sert jamais de HTML en cache',
    /request\.mode === 'navigate'/.test(swBody) && swBody.includes('networkOnlyWithOfflineFallback'),
  );

  // --- Page hors ligne ---
  const offlineRes = await head('/offline.html');
  check('/offline.html répond 200', offlineRes.status === 200, `statut ${offlineRes.status}`);

  // --- Le manifeste est bien référencé par le document ---
  const homeRes = await fetch(`${ORIGIN}/`);
  const html = await homeRes.text();
  check('<link rel="manifest"> dans le HTML', /rel="manifest"[^>]*href="\/manifest\.json"/.test(html));
  check('theme-color dans le HTML', /name="theme-color"[^>]*content="#E8743C"/.test(html));
  check('capture de beforeinstallprompt injectée', html.includes('__priimoInstallPrompt'));

  console.log(`\n${failures === 0 ? 'Tous les contrôles passent.' : `${failures} contrôle(s) en échec.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
