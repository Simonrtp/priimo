/**
 * Script d'intégration universel — /embed/v1.js
 *
 * Un seul fichier, collé sur n'importe quel site : Webflow, WordPress, Wix,
 * Netty ou fait main. Pas de connecteur par plateforme : une seule
 * maintenance, un seul comportement à vérifier.
 *
 *   <div id="priimo-estimation"></div>
 *   <script src="https://priimo.fr/embed/v1.js" data-agency="IDENTIFIANT"></script>
 *
 * Le script injecte une iframe qui se redimensionne via postMessage. Le
 * visiteur reste sur le domaine de l'agence et ne voit que son URL.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-static';

const SCRIPT = String.raw`(function () {
  'use strict';

  var current = document.currentScript;
  if (!current) return;
  if (current.getAttribute('data-priimo-init') === '1') return;
  current.setAttribute('data-priimo-init', '1');

  var agency = current.getAttribute('data-agency');
  if (!agency || !/^[a-z0-9]{10,32}$/.test(agency)) {
    if (window.console) console.error('[priimo] data-agency manquant ou invalide');
    return;
  }

  var origin;
  try {
    origin = new URL(current.src, window.location.href).origin;
  } catch (e) {
    return;
  }

  var selector = current.getAttribute('data-target') || '#priimo-estimation';
  var mount = document.querySelector(selector);
  if (!mount) {
    // Aucun conteneur : on en crée un juste avant le script, pour que
    // l'intégration fonctionne même si la balise div a été oubliée.
    mount = document.createElement('div');
    if (current.parentNode) current.parentNode.insertBefore(mount, current);
  }
  if (mount.getAttribute('data-priimo-mounted') === '1') return;
  mount.setAttribute('data-priimo-mounted', '1');

  var frameId = 'priimo-estimation-' + Math.random().toString(36).slice(2, 10);

  var params = '?embed=1&frame=' + encodeURIComponent(frameId);
  try {
    params += '&page=' + encodeURIComponent(window.location.href.slice(0, 500));
  } catch (e) {
    /* page inaccessible : le serveur retombe sur le Referer */
  }

  var iframe = document.createElement('iframe');
  iframe.src = origin + '/e/' + agency + params;
  iframe.id = frameId;
  iframe.title = 'Estimation de votre bien';
  iframe.loading = 'lazy';
  iframe.setAttribute('allow', '');
  iframe.setAttribute('referrerpolicy', 'strict-origin');
  iframe.style.width = '100%';
  iframe.style.border = '0';
  iframe.style.display = 'block';
  iframe.style.minHeight = '620px';
  iframe.style.height = '620px';
  iframe.style.colorScheme = 'light';
  iframe.style.transition = 'height 180ms ease';

  mount.appendChild(iframe);

  function onMessage(event) {
    if (event.origin !== origin) return;
    var data = event.data;
    if (!data || data.source !== 'priimo-estimation') return;
    if (data.frame && data.frame !== frameId) return;

    if (data.type === 'resize') {
      var height = Number(data.height);
      if (isFinite(height) && height > 200 && height < 20000) {
        iframe.style.height = Math.ceil(height) + 'px';
      }
      return;
    }

    if (data.type === 'scroll') {
      var box = iframe.getBoundingClientRect();
      if (box.top < 0 || box.top > window.innerHeight * 0.5) {
        window.scrollTo({
          top: window.scrollY + box.top - 24,
          behavior: 'smooth'
        });
      }
    }
  }

  window.addEventListener('message', onMessage, false);
})();
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // Cinq minutes de fraîcheur, une journée de tolérance : un correctif se
      // propage vite sans marteler l'origine.
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
