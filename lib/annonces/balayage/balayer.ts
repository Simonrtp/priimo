/**
 * Le balayage de nuit des annonces de particuliers (PAP, SeLoger).
 *
 * 1. `planifierNuit` : pour chaque code postal balayé, la page 1 de chaque
 *    portail et une tâche de clôture entrent dans la file.
 * 2. `traiterTranche` : quelques minutes de travail. Une page de résultats
 *    crée ou suit les annonces (prix, remise en ligne) et met en file la page
 *    suivante et la fiche de chaque nouvelle. Une fiche est lue puis localisée
 *    par le même moteur que l'import par URL, sans Mon assistant.
 * 3. Clôture d'un code postal dont toutes les pages sont lues : si le
 *    balayage est complet, les annonces qu'il n'a pas revues voient leur fiche
 *    rouverte (`verification`) avant d'être dites retirées.
 *
 * Coût : une page Bright Data par page lue, une seule demande à la fois
 * (personne n'attend), sur un compteur du jour à part (`balayage_page`).
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { colonnesAnnonce, ligneAdmise } from '@/lib/annonces/import/carte';
import { ficheDepuisPage } from '@/lib/annonces/import/fiche';
import { localiserFiche } from '@/lib/annonces/import/localiser';
import { telechargerPage } from '@/lib/annonces/import/telecharger';
import { analyserUrl } from '@/lib/annonces/import/url';
import { plafondBalayageJour } from '@/lib/quota/regles';
import { reserverQuota } from '@/lib/quota/reserver';
import {
  ficheDisparue,
  lieuSeLoger,
  lirePagePap,
  lirePageSeLoger,
  pageSeLoger,
  pageSuivantePap,
  premierePagePap,
  refusDemarchage,
  type CarteBalayage,
  type PortailBalaye,
} from './portails';
import {
  aVerifierPourRetrait,
  continuerSeLoger,
  modeSeLoger,
  nouvelleLigne,
  nuitDe,
  PAGES_MAX,
  pagesCompletesSeLoger,
  suivreCarte,
  type Connue,
  type Evenement,
} from './regles';

type Db = SupabaseClient;

/**
 * Codes postaux balayés. Décision de Simon (25/10/2026) : les deux secteurs
 * réellement utilisés, 75011 (Swixim) et 75020 (agence de test).
 * BALAYAGE_CODES_POSTAUX (« 75011,75020 ») remplace la liste sans redéployer.
 */
const CODES_POSTAUX_PAR_DEFAUT = ['75011', '75020'];

export function codesPostauxBalayes(): string[] {
  const env = process.env.BALAYAGE_CODES_POSTAUX?.split(',').map((c) => c.trim()).filter((c) => /^\d{5}$/.test(c));
  return env && env.length > 0 ? [...new Set(env)] : CODES_POSTAUX_PAR_DEFAUT;
}

/** Pages lues en même temps : SeLoger met 20 à 50 s à répondre, PAP 5 à 15 s. */
const CONCURRENCE = 6;
/** Une demande Bright Data dure au plus ~100 s : pas de nouvelle tâche si la tranche n'a plus ce temps. */
const MARGE_MS = 110_000;
/** Une page qui échoue est retentée deux fois (tranches suivantes), puis laissée. */
const ESSAIS_MAX = 3;
/** Garde-fou : plus de vérifications que ça d'un coup veut dire un balayage tronqué, pas des retraits. */
const PART_MAX_VERIFICATIONS = 0.3;
/** Identité du compteur du balayage (pas un agent : un identifiant fixe). */
const ROBOT = { profileId: '00000000-0000-0000-0000-000000000000', agencyId: '00000000-0000-0000-0000-000000000000' };

export type Tache = {
  id: string;
  nuit: string;
  portail: PortailBalaye;
  code_postal: string;
  genre: 'recherche' | 'fiche' | 'verification' | 'cloture';
  url: string;
  page: number | null;
  mode: 'complet' | 'recent' | null;
  depuis: string | null;
  annonce_id: string | null;
  statut: string;
  essais: number;
  resultat: Record<string, unknown> | null;
  cree_le: string;
};

/** Une page refusée ou illisible : la tâche est retentée, ou laissée (`definitif`). */
class EchecPage extends Error {
  constructor(
    readonly raison: string,
    readonly definitif = false,
  ) {
    super(raison);
  }
}
class PlafondAtteint extends Error {}

const options = () => ({ zone: process.env.BRIGHTDATA_ZONE_BALAYAGE || undefined, enParallele: 1 });

async function telecharger(url: string): Promise<{ ok: true; html: string } | { ok: false; raison: string }> {
  const reservation = await reserverQuota('balayage_page', { agent: plafondBalayageJour(), agence: plafondBalayageJour(), global: plafondBalayageJour() }, ROBOT);
  if (reservation === 'plafond') throw new PlafondAtteint();
  if (reservation !== 'ok') throw new EchecPage('compteur indisponible');
  return telechargerPage(url, undefined, options());
}

// ------------------------------------------------------------------ file

async function ajouterTaches(admin: Db, taches: Record<string, unknown>[]): Promise<void> {
  if (taches.length === 0) return;
  const { error } = await admin.from('annonces_balayage_taches').upsert(taches, { onConflict: 'nuit,genre,url', ignoreDuplicates: true });
  if (error) throw new Error(`file : ${error.message}`);
}

async function finir(admin: Db, t: Tache, valeurs: { statut: 'faite' | 'echec' | 'a_faire'; erreur?: string | null; resultat?: Record<string, unknown> }) {
  const { error } = await admin
    .from('annonces_balayage_taches')
    .update({
      statut: valeurs.statut,
      erreur: valeurs.erreur ?? null,
      resultat: valeurs.resultat ?? null,
      finie_le: valeurs.statut === 'a_faire' ? null : new Date().toISOString(),
      ...(valeurs.statut === 'a_faire' ? { prise_le: null } : {}),
    })
    .eq('id', t.id);
  if (error) console.error('[balayage] fin de tâche', error.message);
}

// ------------------------------------------------------------------ planification

/** La dernière clôture faite d'un portail sur un code postal (complète ou non). */
async function dernieresClotures(admin: Db, portail: PortailBalaye, cp: string): Promise<Tache[]> {
  const { data } = await admin
    .from('annonces_balayage_taches')
    .select('*')
    .eq('genre', 'cloture')
    .eq('portail', portail)
    .eq('code_postal', cp)
    .eq('statut', 'faite')
    .order('cree_le', { ascending: false })
    .limit(20);
  return (data ?? []) as Tache[];
}

export type Planification = { nuit: string; codesPostaux: string[]; ignores: string[]; abandonnees: number };

export async function planifierNuit(admin: Db, maintenant = new Date()): Promise<Planification> {
  const nuit = nuitDe(maintenant);
  // Les pages d'une nuit passée ne se lisent plus : leur clôture se fera en « partielle ».
  const { data: vieilles } = await admin
    .from('annonces_balayage_taches')
    .update({ statut: 'echec', erreur: 'nuit passée', finie_le: maintenant.toISOString() })
    .eq('genre', 'recherche')
    .in('statut', ['a_faire', 'en_cours'])
    .lt('nuit', nuit)
    .select('id');
  const taches: Record<string, unknown>[] = [];
  const ignores: string[] = [];
  const codesPostaux = codesPostauxBalayes();
  for (const cp of codesPostaux) {
    const pap = premierePagePap(cp);
    if (pap) {
      taches.push({ nuit, portail: 'pap', code_postal: cp, genre: 'recherche', url: pap, page: 1 });
      taches.push({ nuit, portail: 'pap', code_postal: cp, genre: 'cloture', url: `cloture:pap:${cp}` });
    } else ignores.push(`pap ${cp}`);
    const lieu = lieuSeLoger(cp);
    if (lieu) {
      const clotures = await dernieresClotures(admin, 'seloger', cp);
      const complet = clotures.find((c) => c.mode === 'complet' && c.resultat?.complet === true);
      const m = modeSeLoger(complet?.cree_le ?? null, clotures[0]?.cree_le ?? null, maintenant);
      const mode = { mode: m.mode, depuis: m.mode === 'recent' ? m.depuis : null };
      taches.push({ nuit, portail: 'seloger', code_postal: cp, genre: 'recherche', url: pageSeLoger(lieu, 1), page: 1, ...mode });
      taches.push({ nuit, portail: 'seloger', code_postal: cp, genre: 'cloture', url: `cloture:seloger:${cp}`, ...mode });
    } else ignores.push(`seloger ${cp}`);
  }
  await ajouterTaches(admin, taches);
  if (ignores.length) console.warn('[balayage] codes postaux sans lieu connu :', ignores.join(', '));
  return { nuit, codesPostaux, ignores, abandonnees: vieilles?.length ?? 0 };
}

// ------------------------------------------------------------------ annonces

type Bilan = { vues: number; nouvelles: number; evenements: number };

async function ecrireEvenements(admin: Db, lignes: { annonce_id: string; evt: Evenement; le: string }[]) {
  if (lignes.length === 0) return;
  const { error } = await admin
    .from('annonce_evenements')
    .insert(lignes.map((l) => ({ annonce_id: l.annonce_id, type: l.evt.type, survenu_le: l.le, avant: l.evt.avant, apres: l.evt.apres })));
  if (error) console.error('[balayage] événements', error.message);
}

/** Les cartes d'une page : nouvelles annonces créées (fiche en file), connues suivies. */
async function enregistrerCartes(admin: Db, t: Tache, cartes: CarteBalayage[]): Promise<Bilan> {
  const vueLe = new Date().toISOString();
  const bilan: Bilan = { vues: cartes.length, nouvelles: 0, evenements: 0 };
  if (cartes.length === 0) return bilan;
  const { data, error } = await admin
    .from('annonces')
    .select('id, id_portail, statut, prix, retiree_le')
    .eq('portail', t.portail)
    .in('id_portail', cartes.map((c) => c.idPortail));
  if (error) throw new Error(`lecture des annonces : ${error.message}`);
  const connues = new Map(
    ((data ?? []) as { id: string; id_portail: string; statut: string; prix: number | null; retiree_le: string | null }[]).map((r) => [
      r.id_portail,
      { id: r.id, statut: r.statut === 'retiree' ? 'retiree' : 'active', prix: r.prix, retireeLe: r.retiree_le } satisfies Connue,
    ]),
  );
  const evenements: { annonce_id: string; evt: Evenement; le: string }[] = [];
  const fiches: Record<string, unknown>[] = [];
  for (const carte of cartes) {
    const connue = connues.get(carte.idPortail);
    if (connue) {
      const { colonnes, evenements: evts } = suivreCarte(connue, carte, vueLe);
      const { error: e } = await admin.from('annonces').update(colonnes).eq('id', connue.id);
      if (e) console.error('[balayage] suivi', e.message);
      evts.forEach((evt) => evenements.push({ annonce_id: connue.id, evt, le: vueLe }));
      continue;
    }
    const { data: creee, error: e } = await admin
      .from('annonces')
      .upsert(nouvelleLigne(carte, t.code_postal, vueLe), { onConflict: 'portail,id_portail', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();
    if (e) {
      console.error('[balayage] nouvelle annonce', e.message);
      continue;
    }
    const id = (creee as { id: string } | null)?.id;
    if (!id) continue;
    bilan.nouvelles += 1;
    evenements.push({ annonce_id: id, evt: { type: 'nouvelle', avant: {}, apres: { prix: carte.prix } }, le: vueLe });
    fiches.push({ nuit: t.nuit, portail: t.portail, code_postal: t.code_postal, genre: 'fiche', url: carte.url, annonce_id: id });
  }
  await ecrireEvenements(admin, evenements);
  await ajouterTaches(admin, fiches);
  bilan.evenements = evenements.filter((e) => e.evt.type !== 'nouvelle').length;
  return bilan;
}

async function retirer(admin: Db, annonceId: string, prix: number | null) {
  const le = new Date().toISOString();
  const { data } = await admin.from('annonces').update({ statut: 'retiree', retiree_le: le }).eq('id', annonceId).eq('statut', 'active').select('id');
  if ((data ?? []).length > 0) await ecrireEvenements(admin, [{ annonce_id: annonceId, evt: { type: 'retiree', avant: { prix }, apres: {} }, le }]);
}

// ------------------------------------------------------------------ tâches

async function pageOuEchec(url: string): Promise<string> {
  const page = await telecharger(url);
  if (!page.ok) throw new EchecPage(page.raison, page.raison === 'interdite');
  return page.html;
}

async function traiterRecherche(admin: Db, t: Tache): Promise<Record<string, unknown>> {
  const html = await pageOuEchec(t.url);
  const page = t.page ?? 1;
  if (t.portail === 'pap') {
    const cartes = lirePagePap(html).filter((c) => c.codePostal === t.code_postal);
    const suivante = pageSuivantePap(html);
    // La page suivante entre en file avant que celle-ci soit faite : la clôture l'attend.
    if (suivante && page < PAGES_MAX) {
      await ajouterTaches(admin, [{ nuit: t.nuit, portail: 'pap', code_postal: t.code_postal, genre: 'recherche', url: suivante, page: page + 1 }]);
    }
    return { ...(await enregistrerCartes(admin, t, cartes)), suivante: Boolean(suivante) };
  }
  const lue = lirePageSeLoger(html);
  if (!lue.lisible) throw new EchecPage('illisible');
  const lieu = lieuSeLoger(t.code_postal);
  const suite: number[] = [];
  if (lieu && t.mode === 'complet' && page === 1) {
    for (let p = 2; p <= pagesCompletesSeLoger(lue.total); p += 1) suite.push(p);
  } else if (lieu && t.mode === 'recent' && t.depuis && continuerSeLoger({ datesCreation: lue.datesCreation, depuis: t.depuis, page, total: lue.total })) {
    suite.push(page + 1);
  }
  await ajouterTaches(
    admin,
    suite.map((p) => ({ nuit: t.nuit, portail: 'seloger', code_postal: t.code_postal, genre: 'recherche', url: pageSeLoger(lieu!, p), page: p, mode: t.mode, depuis: t.depuis })),
  );
  const cartes = lue.cartes.filter((c) => c.codePostal === t.code_postal);
  return { ...(await enregistrerCartes(admin, t, cartes)), total: lue.total, annonces: lue.annonces };
}

/** Colonnes d'une fiche lue qui ne remplacent jamais une valeur connue par du vide. */
const CHAMPS_FICHE = ['publiee_le', 'type_bien', 'titre', 'surface', 'pieces', 'etage', 'dpe', 'conso_kwh_m2', 'ges', 'ges_kg_m2', 'ville', 'quartier', 'photos'];
/** La localisation, elle, s'écrit telle que le moteur la rend (une adresse incertaine reste vide). */
const CHAMPS_LOCALISATION = [
  'confiance',
  'localisation_precision',
  'adresse',
  'adresse_numero',
  'adresse_voie',
  'parcelle_ids',
  'numero_dpe',
  'complement_dpe',
  'latitude',
  'longitude',
  'logement_cle',
  'score_localisation',
  'raisons_localisation',
  'adresses_possibles',
];

async function traiterFiche(admin: Db, t: Tache): Promise<Record<string, unknown>> {
  if (!t.annonce_id) return { ignoree: 'sans annonce' };
  const { data: ligne } = await admin.from('annonces').select('id, statut, prix, code_postal').eq('id', t.annonce_id).maybeSingle();
  const annonce = ligne as { id: string; statut: string; prix: number | null; code_postal: string } | null;
  if (!annonce || annonce.statut !== 'active') return { ignoree: 'annonce absente ou retirée' };
  const u = analyserUrl(t.url);
  if (!u) return { ignoree: 'url illisible' };
  const page = await telecharger(t.url);
  if (!page.ok && page.raison === 'disparue') {
    await retirer(admin, annonce.id, annonce.prix);
    return { retiree: true };
  }
  if (!page.ok) throw new EchecPage(page.raison, page.raison === 'interdite');
  if (ficheDisparue(t.portail, page.html)) {
    await retirer(admin, annonce.id, annonce.prix);
    return { retiree: true };
  }
  // Sans Mon assistant : les données structurées de PAP et SeLoger suffisent (banc du 25/10 : 30 fiches sur 30 lues).
  const fiche = await ficheDepuisPage(u, page.html, async () => null);
  if (!fiche) throw new EchecPage('illisible');
  fiche.codePostal ??= annonce.code_postal;
  const loc = await localiserFiche(fiche);
  const colonnes = ligneAdmise(colonnesAnnonce(fiche, loc) ?? {});
  const maj: Record<string, unknown> = { refus_demarchage: refusDemarchage(page.html) };
  for (const c of CHAMPS_FICHE) {
    const v = colonnes[c];
    if (v != null && !(Array.isArray(v) && v.length === 0)) maj[c] = v;
  }
  for (const c of CHAMPS_LOCALISATION) if (c in colonnes) maj[c] = colonnes[c];
  if (annonce.prix == null && fiche.prix != null) maj.prix = maj.prix_initial = Math.round(fiche.prix);
  const { error } = await admin.from('annonces').update(maj).eq('id', annonce.id);
  if (error) throw new Error(`fiche : ${error.message}`);
  return { confiance: loc.confiance, adresse: loc.adresse };
}

async function traiterVerification(admin: Db, t: Tache): Promise<Record<string, unknown>> {
  if (!t.annonce_id) return { ignoree: 'sans annonce' };
  const { data: ligne } = await admin.from('annonces').select('id, statut, prix').eq('id', t.annonce_id).maybeSingle();
  const annonce = ligne as { id: string; statut: string; prix: number | null } | null;
  if (!annonce || annonce.statut !== 'active') return { ignoree: 'déjà retirée' };
  const page = await telecharger(t.url);
  if ((!page.ok && page.raison === 'disparue') || (page.ok && ficheDisparue(t.portail, page.html))) {
    await retirer(admin, annonce.id, annonce.prix);
    return { retiree: true };
  }
  if (!page.ok) throw new EchecPage(page.raison, page.raison === 'interdite');
  // Toujours en ligne, juste absente des résultats ce soir.
  await admin.from('annonces').update({ derniere_vue_le: new Date().toISOString() }).eq('id', annonce.id);
  return { retiree: false };
}

/** Une tâche ; faux si le plafond du jour est atteint (la tâche retourne en file). */
async function traiter(admin: Db, t: Tache): Promise<boolean> {
  try {
    const resultat =
      t.genre === 'recherche' ? await traiterRecherche(admin, t) : t.genre === 'fiche' ? await traiterFiche(admin, t) : await traiterVerification(admin, t);
    await finir(admin, t, { statut: 'faite', resultat });
    return true;
  } catch (err) {
    if (err instanceof PlafondAtteint) {
      await admin.from('annonces_balayage_taches').update({ statut: 'a_faire', prise_le: null, essais: Math.max(0, t.essais - 1) }).eq('id', t.id);
      return false;
    }
    const raison = err instanceof Error ? err.message : String(err);
    const definitif = err instanceof EchecPage && err.definitif;
    console.error('[balayage]', t.genre, t.portail, t.code_postal, t.page ?? '', raison);
    await finir(admin, t, { statut: definitif || t.essais >= ESSAIS_MAX ? 'echec' : 'a_faire', erreur: raison.slice(0, 300) });
    return true;
  }
}

// ------------------------------------------------------------------ clôture

/** Les codes postaux dont toutes les pages de la nuit sont lues : retraits à vérifier, journal. */
async function clore(admin: Db): Promise<number> {
  const { data } = await admin.from('annonces_balayage_taches').select('*').eq('genre', 'cloture').eq('statut', 'a_faire');
  let closes = 0;
  for (const c of (data ?? []) as Tache[]) {
    const { data: pages } = await admin
      .from('annonces_balayage_taches')
      .select('statut, resultat')
      .eq('nuit', c.nuit)
      .eq('portail', c.portail)
      .eq('code_postal', c.code_postal)
      .eq('genre', 'recherche');
    const lignes = (pages ?? []) as { statut: string; resultat: Record<string, number> | null }[];
    if (lignes.some((p) => p.statut === 'a_faire' || p.statut === 'en_cours')) continue;
    const complet = lignes.length > 0 && lignes.every((p) => p.statut === 'faite') && (c.portail === 'pap' || c.mode === 'complet');
    const somme = (k: string) => lignes.reduce((s, p) => s + (Number(p.resultat?.[k]) || 0), 0);

    let verifications = 0;
    let anomalie: string | null = null;
    if (complet) {
      const { data: actives } = await admin
        .from('annonces')
        .select('id, url, statut, derniere_vue_le')
        .eq('portail', c.portail)
        .eq('code_postal', c.code_postal)
        .eq('origine', 'veille')
        .eq('statut', 'active')
        .limit(5000);
      const lignesActives = ((actives ?? []) as { id: string; url: string; statut: string; derniere_vue_le: string }[]).map((a) => ({ ...a, derniereVueLe: a.derniere_vue_le }));
      const aVerifier = aVerifierPourRetrait(lignesActives, c.cree_le);
      if (lignesActives.length > 0 && aVerifier.length / lignesActives.length > PART_MAX_VERIFICATIONS) {
        anomalie = `${aVerifier.length} annonces sur ${lignesActives.length} non revues : balayage tronqué, aucun retrait`;
        console.warn('[balayage]', c.portail, c.code_postal, anomalie);
      } else {
        await ajouterTaches(
          admin,
          aVerifier.map((a) => ({ nuit: c.nuit, portail: c.portail, code_postal: c.code_postal, genre: 'verification', url: a.url, annonce_id: a.id })),
        );
        verifications = aVerifier.length;
      }
    }
    // Retraits confirmés depuis le passage précédent (les vérifications de ce soir compteront au prochain).
    const { data: precedent } = await admin
      .from('annonces_runs')
      .select('started_at')
      .eq('portail', c.portail)
      .contains('codes_postaux', [c.code_postal])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { count: retirees } = await admin
      .from('annonces')
      .select('id', { count: 'exact', head: true })
      .eq('portail', c.portail)
      .eq('code_postal', c.code_postal)
      .eq('origine', 'veille')
      .gte('retiree_le', (precedent as { started_at: string } | null)?.started_at ?? c.cree_le);
    await admin.from('annonces_runs').insert({
      portail: c.portail,
      codes_postaux: [c.code_postal],
      started_at: c.cree_le,
      finished_at: new Date().toISOString(),
      status: lignes.length > 0 && lignes.every((p) => p.statut === 'faite') ? 'success' : 'partial',
      n_vues: somme('vues'),
      n_nouvelles: somme('nouvelles'),
      n_evenements: somme('evenements'),
      n_retirees: retirees ?? 0,
      error_message: anomalie,
    });
    await finir(admin, c, { statut: 'faite', resultat: { complet, pages: lignes.length, verifications, ...(anomalie ? { anomalie } : {}) } });
    closes += 1;
  }
  return closes;
}

// ------------------------------------------------------------------ tranche

export type Tranche = { traitees: number; restantes: number; closes: number; plafond: boolean; dureeMs: number };

async function restantes(admin: Db): Promise<number> {
  const { count } = await admin
    .from('annonces_balayage_taches')
    .select('id', { count: 'exact', head: true })
    .neq('genre', 'cloture')
    .in('statut', ['a_faire', 'en_cours']);
  return count ?? 0;
}

/** Quelques minutes de travail (`budgetMs`), puis la clôture de ce qui est fini. */
export async function traiterTranche(admin: Db, budgetMs = 270_000): Promise<Tranche> {
  const debut = Date.now();
  let traitees = 0;
  let plafond = false;
  while (!plafond && Date.now() - debut < budgetMs - MARGE_MS) {
    const { data, error } = await admin.rpc('balayage_prendre', { p_n: CONCURRENCE });
    if (error) throw new Error(`file : ${error.message}`);
    const taches = (data ?? []) as Tache[];
    if (taches.length === 0) {
      // Plus rien à lire : les clôtures peuvent créer des vérifications.
      if ((await clore(admin)) === 0) break;
      continue;
    }
    const faits = await Promise.all(taches.map((t) => traiter(admin, t)));
    traitees += faits.filter(Boolean).length;
    plafond = faits.some((f) => !f);
  }
  const closes = await clore(admin);
  return { traitees, restantes: await restantes(admin), closes, plafond, dureeMs: Date.now() - debut };
}
