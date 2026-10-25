/**
 * L'entrée dans l'outil : une animation signature à la connexion et à la
 * première ouverture de la journée, jamais davantage (un outil quotidien ne
 * doit pas lasser), jamais si l'appareil demande moins d'animations, et
 * jamais au prix d'une attente : elle joue sur l'écran déjà rendu.
 */

/** Le jour de la dernière grande entrée (localStorage). */
export const CLE_JOUR = 'priimo:entree:jour';
/** L'heure d'envoi du formulaire de connexion, en ms (sessionStorage). */
export const CLE_CONNEXION = 'priimo:entree:connexion';
/** Où était le logo sur la page de connexion, pour qu'il reparte de là (sessionStorage). */
export const CLE_LOGO = 'priimo:entree:logo';
/** Les adresses déjà vues sur l'Accueil, pour compter les nouvelles (localStorage). */
export const CLE_ADRESSES_VUES = 'priimo:accueil:adresses-vues';
/** Le jour où le secteur a déjà plongé en vue (localStorage). */
export const CLE_EVEIL_SECTEUR = 'priimo:accueil:eveil-secteur';

/** Au-delà, la connexion est trop ancienne pour être prolongée (passage par l'onboarding, échec répété). */
export const FRAICHEUR_CONNEXION_MS = 60_000;

export type Entree = 'grande' | null;

/** Le drapeau de connexion n'a de sens que dans la minute qui suit l'envoi du formulaire. */
export function connexionRecente(valeur: string | null, maintenant: number = Date.now()): boolean {
  const t = Number(valeur);
  if (!valeur || !Number.isFinite(t) || t <= 0) return false;
  const ecart = maintenant - t;
  return ecart >= 0 && ecart < FRAICHEUR_CONNEXION_MS;
}

/** « 2026-10-24 », à l'heure de Paris. */
export function jourParis(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function deciderEntree(entree: {
  connexion: boolean;
  dernierJour: string | null;
  aujourdhui: string;
  mouvementReduit: boolean;
}): Entree {
  if (entree.mouvementReduit) return null;
  if (entree.connexion) return 'grande';
  return entree.dernierJour === entree.aujourdhui ? null : 'grande';
}

/** Les adresses arrivées depuis la dernière visite ; aucune la toute première fois. */
export function nouveautesDepuis(vues: readonly string[] | null, actuelles: readonly string[]): number {
  if (!vues) return 0;
  const deja = new Set(vues);
  return actuelles.filter((id) => !deja.has(id)).length;
}

/**
 * Le même choix, à l'ouverture de la page avant tout rendu : posé sur la racine
 * de la coque (le script qui le contient en est le premier enfant), il évite
 * l'écran déjà affiché qui s'efface pour s'animer. Ne jette jamais.
 */
export const SCRIPT_ENTREE = `(function(){try{var r=document.currentScript&&document.currentScript.parentElement;if(!r)return;if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;var j=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());var t=Number(sessionStorage.getItem('${CLE_CONNEXION}')),e=Date.now()-t;var c=t>0&&e>=0&&e<${FRAICHEUR_CONNEXION_MS};var l=localStorage.getItem('${CLE_JOUR}');if(c||l!==j){r.setAttribute('data-entree','grande');window.__priimoEntreeScript=1;}}catch(e){}})();`;
