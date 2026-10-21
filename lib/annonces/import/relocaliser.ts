/**
 * Chaque nuit, les annonces ajoutées par les agences et encore sans adresse
 * sont relocalisées. Cause la plus fréquente constatée (audit du 21/10/2026) :
 * le DPE de l'annonce n'est pas encore dans la base publique de l'ADEME, mise
 * à jour par lots (le 21/10, dernière mise à jour le 14/10, DPE jusqu'au
 * 12/10). L'adresse arrive d'elle-même dès qu'il y est.
 *
 * Mêmes règles que la lecture de l'URL (localiserFiche) : rien n'est affirmé
 * de plus qu'au premier passage. Sans conso chiffrée, rien à gagner : ignorée.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { localiserFiche } from './localiser';
import { numeroEtVoie } from './carte';
import type { FicheAnnonce } from './types';
import type { PortailImport } from './url';

/** Rayon d'un quartier publié (SeLoger : 180 à 350 m constatés) quand seul son centre est gardé. */
const RAYON_QUARTIER_M = 350;
const LOT_IDS = 150;
const PLAFOND_PAR_NUIT = 150;

type Ligne = Record<string, unknown>;

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const t = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Une ligne `annonces` → la fiche que le localiseur attend. Pur. */
export function ficheDepuisLigne(r: Ligne): FicheAnnonce {
  const lat = n(r.latitude);
  const lon = n(r.longitude);
  const precision = t(r.localisation_precision);
  return {
    portail: (t(r.portail) ?? 'autre') as PortailImport,
    idPortail: t(r.id_portail),
    url: t(r.url) ?? '',
    typeVendeur: r.type_vendeur === 'particulier' ? 'particulier' : 'professionnel',
    agenceNom: t(r.agence_nom),
    typeBien: r.type_bien === 'appartement' || r.type_bien === 'maison' ? r.type_bien : r.type_bien ? 'autre' : null,
    titre: t(r.titre),
    prix: n(r.prix),
    surface: n(r.surface),
    pieces: n(r.pieces),
    etage: n(r.etage),
    dpe: t(r.dpe),
    consoKwhM2: n(r.conso_kwh_m2),
    ges: t(r.ges),
    gesKgM2: n(r.ges_kg_m2),
    dpeApresJuillet2021: null,
    dateDpe: null,
    anneeConstruction: null,
    chauffage: null,
    codePostal: t(r.code_postal),
    ville: t(r.ville),
    quartier: t(r.quartier),
    description: null,
    datePublication: t(r.publiee_le),
    // Un quartier : son centre et un rayon type. Un code postal entier : pas de repère.
    zone: lat != null && lon != null && precision === 'quartier' ? { latitude: lat, longitude: lon, rayonM: RAYON_QUARTIER_M } : null,
    photos: [],
  };
}

export async function relocaliserAnnoncesAjoutees(admin: SupabaseClient): Promise<{ revues: number; retrouvees: number }> {
  const { data: liens, error } = await admin.from('annonces_agences').select('annonce_id').limit(5000);
  if (error) {
    console.error('[relocaliser] liens', error.message);
    return { revues: 0, retrouvees: 0 };
  }
  const ids = [...new Set(((liens ?? []) as { annonce_id: string }[]).map((l) => String(l.annonce_id)))];
  const aRevoir: Ligne[] = [];
  for (let i = 0; i < ids.length && aRevoir.length < PLAFOND_PAR_NUIT; i += LOT_IDS) {
    const { data, error: e } = await admin
      .from('annonces')
      .select('*')
      .in('id', ids.slice(i, i + LOT_IDS))
      .eq('confiance', 'incertaine')
      .eq('statut', 'active')
      .not('conso_kwh_m2', 'is', null);
    if (e) {
      console.error('[relocaliser] annonces', e.message);
      break;
    }
    aRevoir.push(...((data ?? []) as Ligne[]));
  }

  let retrouvees = 0;
  for (const ligne of aRevoir.slice(0, PLAFOND_PAR_NUIT)) {
    const loc = await localiserFiche(ficheDepuisLigne(ligne));
    if (loc.confiance === 'incertaine' || loc.latitude == null || loc.longitude == null) continue;
    const { numero, voie } = numeroEtVoie(loc.adresse);
    const { error: e } = await admin
      .from('annonces')
      .update({
        confiance: loc.confiance,
        localisation_precision: loc.precision,
        adresse: loc.adresse,
        adresse_numero: numero,
        adresse_voie: voie,
        parcelle_ids: loc.parcelleIds,
        numero_dpe: loc.numeroDpe,
        complement_dpe: loc.complementDpe,
        latitude: loc.latitude,
        longitude: loc.longitude,
        logement_cle: loc.numeroDpe ?? ligne.logement_cle ?? null,
        score_localisation: loc.score,
        raisons_localisation: loc.raisons,
      })
      .eq('id', String(ligne.id))
      .eq('confiance', 'incertaine');
    if (e) console.error('[relocaliser] mise à jour', e.message);
    else retrouvees += 1;
  }
  return { revues: aRevoir.length, retrouvees };
}
