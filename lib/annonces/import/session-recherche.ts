import type { CarteImport } from './carte';

/** Étape telle que le panneau la reprend après avoir quitté la page. */
export type EtapePersistee = {
  cle: 'lecture' | 'donnees' | 'adresse';
  etat: 'en_cours' | 'fait' | 'rate';
  detail?: string;
  ia?: boolean;
};

export type EtatSession =
  | { k: 'vide' }
  | { k: 'travail'; fini: boolean; depuis: number }
  | { k: 'echec'; message: string }
  | { k: 'trouvee'; carte: CarteImport; disponible: boolean };

export type SessionRecherche = {
  url: string;
  etat: EtatSession;
  etapes: Partial<Record<EtapePersistee['cle'], EtapePersistee>>;
};

export const SESSION_VIDE: SessionRecherche = { url: '', etat: { k: 'vide' }, etapes: {} };

const CLES_ETAPE = new Set(['lecture', 'donnees', 'adresse']);

function etape(v: unknown): EtapePersistee | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.cle !== 'lecture' && o.cle !== 'donnees' && o.cle !== 'adresse') return null;
  if (o.etat !== 'en_cours' && o.etat !== 'fait' && o.etat !== 'rate') return null;
  return {
    cle: o.cle,
    etat: o.etat,
    detail: typeof o.detail === 'string' ? o.detail : undefined,
    ia: o.ia === true ? true : undefined,
  };
}

function carte(v: unknown): CarteImport | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as CarteImport;
  if (typeof o.url !== 'string' || typeof o.portail !== 'string') return null;
  return o;
}

/** Reprend une session gardée dans le navigateur. Null si le JSON n'est pas le nôtre. */
export function lireSession(brut: string | null): SessionRecherche | null {
  if (!brut) return null;
  let json: unknown;
  try {
    json = JSON.parse(brut);
  } catch {
    return null;
  }
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (typeof o.url !== 'string') return null;
  const etatBrut = o.etat;
  if (!etatBrut || typeof etatBrut !== 'object') return null;
  const e = etatBrut as Record<string, unknown>;
  let etat: EtatSession;
  if (e.k === 'vide') etat = { k: 'vide' };
  else if (e.k === 'travail' && typeof e.depuis === 'number') etat = { k: 'travail', fini: e.fini === true, depuis: e.depuis };
  else if (e.k === 'echec' && typeof e.message === 'string' && e.message) etat = { k: 'echec', message: e.message };
  else if (e.k === 'trouvee') {
    const lue = carte(e.carte);
    if (!lue) return null;
    etat = { k: 'trouvee', carte: lue, disponible: e.disponible !== false };
  } else return null;

  const etapes: SessionRecherche['etapes'] = {};
  if (o.etapes && typeof o.etapes === 'object') {
    for (const [cle, valeur] of Object.entries(o.etapes as Record<string, unknown>)) {
      if (!CLES_ETAPE.has(cle)) continue;
      const et = etape(valeur);
      if (et) etapes[et.cle] = et;
    }
  }
  return { url: o.url, etat, etapes };
}
