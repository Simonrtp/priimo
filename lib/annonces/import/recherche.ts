'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { EtapeImport, ReponseImport } from './serveur';
import type { LigneFlux } from './flux';
import { MESSAGE_RECHERCHE_ARRETEE } from './messages';
import { annonceImportee, definirAnnonceImportee } from './store';
import {
  SESSION_VIDE,
  lireSession,
  type SessionRecherche,
} from './session-recherche';

const CLE = 'priimo.annonce.recherche';

let session: SessionRecherche = SESSION_VIDE;
let generation = 0;
let controleurCourant: AbortController | null = null;
let file: Promise<void> = Promise.resolve();
let restaure = false;
const abonnes = new Set<() => void>();

function prevenir() {
  for (const f of abonnes) f();
}

function sauver() {
  if (typeof window === 'undefined') return;
  try {
    if (session.etat.k === 'vide' && !session.url) window.sessionStorage.removeItem(CLE);
    else window.sessionStorage.setItem(CLE, JSON.stringify(session));
  } catch {
    /* navigation privée : la session vit au moins le temps de l'onglet */
  }
}

function poser(suivante: SessionRecherche) {
  session = suivante;
  sauver();
  prevenir();
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/** Lit la réponse en flux de /api/dashboard/annonces/importer. Le formulaire « Nouveau bien » s'en sert aussi. */
export async function suivreFlux(res: Response, surEtape: (e: EtapeImport) => void): Promise<ReponseImport> {
  if (!res.ok || !res.body) {
    const json = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
    return { etat: 'erreur', message: json?.message ?? json?.error ?? 'Recherche impossible' };
  }
  const lecteur = res.body.getReader();
  const decodeur = new TextDecoder();
  let reste = '';
  let resultat: ReponseImport | null = null;
  try {
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      reste += decodeur.decode(value, { stream: true });
      const lignes = reste.split('\n');
      reste = lignes.pop() ?? '';
      for (const ligne of lignes) {
        const utile = ligne.trim();
        if (!utile || utile.startsWith(' ')) continue;
        const evt = JSON.parse(utile) as LigneFlux;
        if ('etape' in evt) surEtape(evt.etape);
        else resultat = evt.resultat;
      }
    }
  } catch {
    return { etat: 'erreur', message: MESSAGE_RECHERCHE_ARRETEE };
  }
  return resultat ?? { etat: 'erreur', message: 'Recherche interrompue' };
}

async function annulerServeur() {
  await fetch('/api/dashboard/annonces/importer/annuler', { method: 'POST', keepalive: true }).catch(() => {});
}

async function executer(url: string, gen: number, controleur: AbortController, depuis: number) {
  const res = await fetch('/api/dashboard/annonces/importer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: controleur.signal,
  }).catch(() => null);
  if (gen !== generation) return;
  if (!res) {
    if (controleur.signal.aborted) return;
    poser({ ...session, url, etat: { k: 'echec', message: 'Connexion perdue : réessayez' }, etapes: session.etapes });
    return;
  }
  const r = await suivreFlux(res, (e) => {
    if (gen !== generation) return;
    const precedente = session.etapes[e.cle];
    poser({
      ...session,
      url,
      etapes: { ...session.etapes, [e.cle]: { ...e, ia: e.ia || precedente?.ia } },
    });
  });
  if (gen !== generation || controleur.signal.aborted) return;
  if (r.etat === 'erreur' && r.message === MESSAGE_RECHERCHE_ARRETEE) return;
  if (r.etat === 'trouvee') {
    poser({ ...session, url, etat: { k: 'travail', fini: true, depuis }, etapes: session.etapes });
    await new Promise((ok) => setTimeout(ok, 520));
    if (gen !== generation) return;
    poser({ url, etat: { k: 'trouvee', carte: r.carte, disponible: r.disponible }, etapes: {} });
    definirAnnonceImportee(r.carte);
    return;
  }
  poser({ ...session, url, etat: { k: 'echec', message: r.message }, etapes: session.etapes });
}

function couperLocal() {
  controleurCourant?.abort();
  controleurCourant = null;
}

/** Coupe la lecture et vide le champ. L'écran se vide tout de suite, le serveur s'arrête derrière. */
export function arreterRecherche() {
  generation += 1;
  couperLocal();
  poser(SESSION_VIDE);
  definirAnnonceImportee(null);
  void annulerServeur();
}

/**
 * Lance (ou relance) la lecture. Une recherche déjà affichée pour la même URL
 * n'est pas recommencée : quitter la page ne doit pas en ouvrir une deuxième.
 */
export function lancerRecherche(brute: string, opts?: { forcer?: boolean }) {
  const url = brute.trim();
  if (!url) return;
  const enCours =
    session.etat.k === 'travail' &&
    !session.etat.fini &&
    session.url.trim() === url &&
    controleurCourant != null &&
    !controleurCourant.signal.aborted;
  if (enCours && !opts?.forcer) return;

  couperLocal();
  const gen = ++generation;
  const controleur = new AbortController();
  controleurCourant = controleur;
  const depuis = Date.now();
  poser({ url, etat: { k: 'travail', fini: false, depuis }, etapes: {} });
  definirAnnonceImportee(null);

  file = file
    .catch(() => undefined)
    .then(async () => {
      if (gen !== generation) return;
      await annulerServeur();
      if (gen !== generation || controleur.signal.aborted) return;
      await executer(url, gen, controleur, depuis);
    });
}

/** Le champ, sans relancer la lecture. */
export function ecrireUrl(url: string) {
  if (session.url === url) return;
  poser({ ...session, url });
}

/** L'annonce vient d'être ajoutée : la carte et le point restent. */
export function noterAnnonceAjoutee(annonceId: string) {
  if (session.etat.k !== 'trouvee') return;
  const carte = { ...session.etat.carte, annonceId, surCarte: true };
  poser({ ...session, etat: { k: 'trouvee', carte, disponible: session.etat.disponible } });
  definirAnnonceImportee(carte);
}

/** L'agent désigne l'une des adresses possibles, ou revient à toutes : le panneau et la carte suivent. */
export function choisirAdresseImport(adresse: string | null) {
  if (session.etat.k !== 'trouvee') return;
  const carte = { ...session.etat.carte, adresseChoisie: adresse };
  poser({ ...session, etat: { k: 'trouvee', carte, disponible: session.etat.disponible } });
  if (carte.surCarte !== false) definirAnnonceImportee(carte);
}

/**
 * Le point quitte la carte. La recherche affichée dans le panneau reste.
 * Avec un id : seulement si c'est cette annonce (un autre point ne l'efface pas).
 */
export function masquerSurLaCarte(annonceId?: string) {
  const courante = annonceImportee();
  if (!annonceId || courante?.annonceId === annonceId) definirAnnonceImportee(null);
  if (session.etat.k !== 'trouvee') return;
  const carte = session.etat.carte;
  if (annonceId && carte.annonceId !== annonceId) return;
  poser({
    ...session,
    etat: {
      k: 'trouvee',
      disponible: session.etat.disponible,
      carte: {
        ...carte,
        surCarte: false,
        annonceId: annonceId && carte.annonceId === annonceId ? null : carte.annonceId,
      },
    },
  });
}

function reprendre() {
  if (session.etat.k !== 'travail' || session.etat.fini) return;
  if (controleurCourant && !controleurCourant.signal.aborted) return;
  const gen = generation;
  const controleur = new AbortController();
  controleurCourant = controleur;
  const depuis = Date.now();
  poser({ ...session, etat: { k: 'travail', fini: false, depuis }, etapes: {} });
  file = file
    .catch(() => undefined)
    .then(async () => {
      if (gen !== generation) return;
      await executer(session.url, gen, controleur, depuis);
    });
}

function restaurer() {
  if (restaure || typeof window === 'undefined') return;
  restaure = true;
  let lu: SessionRecherche | null = null;
  try {
    lu = lireSession(window.sessionStorage.getItem(CLE));
  } catch {
    lu = null;
  }
  if (!lu || (lu.etat.k === 'vide' && !lu.url)) return;
  session = lu;
  if (lu.etat.k === 'trouvee' && lu.etat.carte.surCarte !== false) definirAnnonceImportee(lu.etat.carte);
  prevenir();
  if (lu.etat.k === 'travail' && !lu.etat.fini) reprendre();
}

export function useSessionRecherche(): SessionRecherche {
  useEffect(() => {
    restaurer();
  }, []);
  return useSyncExternalStore(abonner, () => session, () => SESSION_VIDE);
}
