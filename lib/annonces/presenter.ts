import type { Annonce, Confiance, EvenementAnnonce, GroupeAnnonce, RunAnnonce } from './types';

const PORTAIL_LABEL: Record<Annonce['portail'], string> = {
  seloger: 'SeLoger',
  pap: 'PAP',
  leboncoin: 'Leboncoin',
  bienici: 'Bien’ici',
  logicimmo: 'Logic-Immo',
};

export function libellePortail(portail: string): string {
  return PORTAIL_LABEL[portail as Annonce['portail']] ?? portail;
}

export function adresseVisible(confiance: Confiance): boolean {
  return confiance === 'certaine' || confiance === 'probable' || confiance === 'adresse_publiee';
}

export function libelleAdresse(annonce: Annonce): { ligne: string; probable: boolean } {
  if (!adresseVisible(annonce.confiance)) {
    return { ligne: annonce.quartier?.trim() || annonce.ville?.trim() || 'Quartier non précisé', probable: false };
  }
  const ligne =
    annonce.adresse?.trim() ||
    [annonce.adresseNumero, annonce.adresseVoie].filter(Boolean).join(' ').trim() ||
    annonce.quartier?.trim() ||
    'Adresse non précisée';
  return { ligne, probable: annonce.confiance === 'probable' };
}

export function repereApproximatif(annonce: Annonce): boolean {
  return annonce.localisationPrecision === 'quartier' || annonce.localisationPrecision === 'code_postal';
}

export function baisseCumulee(annonce: Annonce): number | null {
  const initial = annonce.prixInitial;
  const actuel = annonce.prix;
  if (initial == null || actuel == null || initial <= 0 || actuel >= initial) return null;
  return Math.round(((initial - actuel) / initial) * 1000) / 10;
}

export function prixM2(annonce: Annonce): number | null {
  if (annonce.prix == null || annonce.surface == null || annonce.surface <= 0) return null;
  return Math.round(annonce.prix / annonce.surface);
}

export function joursEnLigne(annonce: Annonce, maintenant = new Date()): number | null {
  const iso = annonce.publieeLe ?? annonce.premiereVueLe;
  if (!iso) return null;
  const debut = new Date(iso);
  if (Number.isNaN(debut.getTime())) return null;
  const ms = maintenant.getTime() - debut.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export type BadgeAnnonce =
  | { kind: 'nouvelle' }
  | { kind: 'baisse'; pourcent: number }
  | { kind: 'modifiee' }
  | { kind: 'retiree'; le: string };

export function badgeAnnonce(annonce: Annonce, maintenant = new Date()): BadgeAnnonce | null {
  if (annonce.statut === 'retiree') {
    return { kind: 'retiree', le: annonce.retireeLe ?? annonce.derniereVueLe ?? '' };
  }
  const baisse = baisseCumulee(annonce);
  if (baisse != null && baisse > 0) return { kind: 'baisse', pourcent: baisse };
  const jours = joursEnLigne(annonce, maintenant);
  if (jours != null && jours <= 2) return { kind: 'nouvelle' };
  return null;
}

export function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mois = d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'Europe/Paris' }).replace('.', '');
  const jour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: 'Europe/Paris' }).format(d);
  return `${jour} ${mois}`;
}

export function heureParis(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(d);
}

export function euros(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} €`;
}

/** Étiquette de pastille : « 310 k€ », « 1,25 M€ ». */
export function eurosCourt(n: number): string {
  if (n >= 1_000_000) {
    const m = Math.round(n / 10_000) / 100;
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(m)} M€`;
  }
  if (n >= 10_000) return `${Math.round(n / 1000)} k€`;
  return euros(n);
}

/** « Particulier » ou le nom de l'agence (« Agence » s'il est inconnu). */
export function libelleVendeur(annonce: Annonce): string {
  if (annonce.typeVendeur === 'particulier') return 'Particulier';
  return annonce.agenceNom?.trim() || 'Agence';
}

function prixDans(json: Record<string, unknown> | null): number | null {
  if (!json) return null;
  const v = json.prix ?? json.price;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function ymdParis(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(date);
}

function joursDepuis(iso: string, maintenant: Date): number | null {
  const fini = new Date(iso);
  if (Number.isNaN(fini.getTime())) return null;
  const [ya, ma, da] = ymdParis(fini).split('-').map(Number);
  const [yb, mb, db] = ymdParis(maintenant).split('-').map(Number);
  if (!ya || !ma || !da || !yb || !mb || !db) return null;
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/** Baisse déjà affichée par le portail avant qu'on suive l'annonce. */
export function baisseAvantSuivi(evt: EvenementAnnonce, premiereVueLe: string | null): boolean {
  if (evt.type !== 'baisse_prix' || !premiereVueLe) return false;
  return evt.survenuLe < premiereVueLe;
}

export function ligneHistorique(evt: EvenementAnnonce, premiereVueLe: string | null = null): string {
  const quand = dateCourte(evt.survenuLe);
  const apres = prixDans(evt.apres);
  const avant = prixDans(evt.avant);
  if (baisseAvantSuivi(evt, premiereVueLe)) {
    return avant != null ? `${quand} — ancien prix ${euros(avant)}` : `${quand} — ancien prix`;
  }
  if (evt.type === 'nouvelle') {
    return apres != null ? `${quand} — mise en ligne à ${euros(apres)}` : `${quand} — mise en ligne`;
  }
  if (evt.type === 'baisse_prix' || evt.type === 'hausse_prix') {
    const verbe = evt.type === 'baisse_prix' ? 'baisse' : 'hausse';
    if (apres == null) return `${quand} — ${verbe} de prix`;
    if (avant != null && avant > 0) {
      const pct = (Math.round((Math.abs(avant - apres) / avant) * 1000) / 10)
        .toLocaleString('fr-FR');
      const signe = evt.type === 'baisse_prix' ? '−' : '+';
      return `${quand} — ${verbe} à ${euros(apres)} (${signe}${pct} %)`;
    }
    return `${quand} — ${verbe} à ${euros(apres)}`;
  }
  if (evt.type === 'retiree') return `${quand} — retirée`;
  if (evt.type === 'remise_en_ligne') return `${quand} — remise en ligne`;
  return `${quand} — modifiée`;
}

export function regrouperAnnonces(annonces: readonly Annonce[]): GroupeAnnonce[] {
  const groupes = new Map<string, Annonce[]>();
  for (const annonce of annonces) {
    const cle = annonce.logementCle?.trim() || annonce.id;
    const liste = groupes.get(cle) ?? [];
    liste.push(annonce);
    groupes.set(cle, liste);
  }
  return [...groupes.entries()].map(([cle, liste]) => {
    const triees = [...liste].sort((a, b) => {
      const da = a.derniereVueLe ?? a.publieeLe ?? '';
      const db = b.derniereVueLe ?? b.publieeLe ?? '';
      return db.localeCompare(da);
    });
    return { cle, annonces: triees, principale: triees[0]! };
  });
}

export function bandeauMiseAJour(
  runs: readonly RunAnnonce[],
  maintenant = new Date(),
): { texte: string; alertes: string[] } {
  const termines = runs.filter((r) => r.status !== 'running' && r.finishedAt);
  const dernier = [...termines].sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))[0];
  const ecart = dernier?.finishedAt ? joursDepuis(dernier.finishedAt, maintenant) : null;
  const heure = dernier?.finishedAt ? heureParis(dernier.finishedAt) : null;
  const moment =
    ecart === 0 ? 'ce soir' : ecart === 1 ? 'hier' : dernier?.finishedAt ? `le ${dateCourte(dernier.finishedAt)}` : null;
  const texte = heure && moment
    ? `Secteur mis à jour ${moment} à ${heure}`
    : 'Secteur pas encore mis à jour';
  const jour = ymdParis(maintenant);
  const frais = termines.filter((r) => r.finishedAt && ymdParis(new Date(r.finishedAt)) === jour);
  const alertes = frais
    .filter((r) => r.status === 'partial' || r.status === 'failed')
    .map((r) => `${libellePortail(r.portail)} pas mis à jour`);
  return { texte, alertes };
}
