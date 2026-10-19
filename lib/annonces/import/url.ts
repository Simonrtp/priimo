/**
 * Une URL d'annonce collée par l'agent → portail + identifiant de l'annonce.
 * Pur, sans réseau. Les paramètres de suivi (utm, xtor…) sont retirés : la
 * même annonce donne la même clé, d'où qu'on vienne.
 */

export const PORTAILS_IMPORT = ['pap', 'seloger', 'bienici', 'leboncoin', 'logicimmo', 'figaro', 'autre'] as const;
export type PortailImport = (typeof PORTAILS_IMPORT)[number];

export type UrlAnnonce = {
  portail: PortailImport;
  /** Identifiant du portail (null si l'URL n'en porte pas : portail « autre »). */
  idPortail: string | null;
  /** URL nettoyée : https, sans fragment ni paramètres de suivi. */
  url: string;
};

const PARAMS_SUIVI = /^(utm_|xtor|at_|fbclid|gclid|mc_|cmp|from|src|ref)/i;

function hote(h: string): string {
  return h.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
}

function nettoyer(u: URL): string {
  const propre = new URL(u.toString());
  propre.protocol = 'https:';
  propre.hash = '';
  for (const cle of [...propre.searchParams.keys()]) {
    if (PARAMS_SUIVI.test(cle)) propre.searchParams.delete(cle);
  }
  return propre.toString();
}

function dernierSegment(chemin: string): string {
  return chemin.replace(/\/+$/, '').split('/').pop() ?? '';
}

/** Lit l'URL ; null si ce n'est pas une adresse web exploitable. */
export function analyserUrl(brute: string): UrlAnnonce | null {
  const texte = brute.trim().match(/https?:\/\/\S+/i)?.[0] ?? brute.trim();
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(texte) ? texte : `https://${texte}`);
  } catch {
    return null;
  }
  // Une annonce est sur le web public : ni adresse IP, ni machine locale, ni autre protocole.
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!u.hostname.includes('.') || /^[\d.]+$|^\[|localhost$|\.local$|\.internal$/i.test(u.hostname)) return null;
  const h = hote(u.hostname);
  const url = nettoyer(u);
  const chemin = u.pathname;

  if (h === 'pap.fr' || h.endsWith('.pap.fr')) {
    const id = chemin.match(/-r(\d{6,})(?:\/|$)/)?.[1] ?? null;
    return { portail: 'pap', idPortail: id, url };
  }
  if (h === 'seloger.com' || h.endsWith('.seloger.com')) {
    // /annonces/achat/appartement/paris-20eme-75/gambetta/26B8QY8S7L4V.htm
    // /annonces/achat/appartement/paris-20eme-75/251234567.htm
    const id = dernierSegment(chemin).replace(/\.html?$/i, '');
    return { portail: 'seloger', idPortail: /^[A-Z0-9]{6,}$/i.test(id) ? id : null, url };
  }
  if (h === 'bienici.com' || h.endsWith('.bienici.com')) {
    const id = u.searchParams.get('id') ?? dernierSegment(chemin);
    return { portail: 'bienici', idPortail: /^[\w-]{6,}$/.test(id) ? id : null, url };
  }
  if (h === 'leboncoin.fr' || h.endsWith('.leboncoin.fr')) {
    const id = chemin.match(/(\d{8,})/)?.[1] ?? null;
    return { portail: 'leboncoin', idPortail: id, url };
  }
  if (h.includes('logic-immo.com')) {
    const id = chemin.match(/(\d{6,})/)?.[1] ?? null;
    return { portail: 'logicimmo', idPortail: id, url };
  }
  if (h === 'immobilier.lefigaro.fr' || h.endsWith('.lefigaro.fr')) {
    const id = chemin.match(/annonce-(\d+)/)?.[1] ?? chemin.match(/(\d{6,})/)?.[1] ?? null;
    return { portail: 'figaro', idPortail: id, url };
  }
  return { portail: 'autre', idPortail: null, url };
}

/** Clé stable en base : l'identifiant du portail, sinon l'URL nettoyée elle-même. */
export function cleImport(u: UrlAnnonce): string {
  return u.idPortail ?? u.url.slice(0, 500);
}
