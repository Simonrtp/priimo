import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { JournalActivite } from './derive';
import { etatsSecteurs, touchesParAuteur, type SecteurPeriode } from './secteurs-travailles';
import type { Intervalle } from './semaines';
import { adresseAJuger } from '@/lib/zones/adresse';
import type { AdresseAJuger, Zone } from '@/lib/zones/types';

type Client = SupabaseClient<Database>;

const LOT = 200;

function lots<T>(valeurs: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < valeurs.length; i += LOT) out.push(valeurs.slice(i, i + LOT));
  return out;
}

/**
 * Les secteurs du ou des titulaires, chacun travaillé ou non sur la période.
 *
 * Un geste compte s’il touche un bien du secteur : note rattachée, sortie,
 * ou contact posé sur l’adresse. Une note ou un contact sans bien ne suffit pas.
 */
export async function secteursTravaillesPeriode(params: {
  supabase: Client;
  journal: JournalActivite;
  profileIds: readonly string[];
  intervalle: Intervalle;
  zones: readonly Zone[];
}): Promise<SecteurPeriode[]> {
  const titulaires = new Set(params.profileIds);
  const zones = params.zones.filter((z) => z.actif && z.assignedTo != null && titulaires.has(z.assignedTo));
  if (zones.length === 0) return [];

  try {
    const parAuteur = await adressesParAuteur(params.supabase, params.journal, titulaires, params.intervalle);
    const out: SecteurPeriode[] = [];
    for (const zone of zones) {
      const adresses = zone.assignedTo ? (parAuteur.get(zone.assignedTo) ?? []) : [];
      out.push(...etatsSecteurs({ zones: [zone], adresses }));
    }
    return out;
  } catch (err) {
    console.error('[activite] secteurs travaillés', err);
    return etatsSecteurs({ zones, adresses: [] });
  }
}

type Seau = { bans: Set<string>; biens: Set<string>; parcelles: Set<string> };

function seauDe(par: Map<string, Seau>, auteurId: string): Seau {
  let s = par.get(auteurId);
  if (!s) {
    s = { bans: new Set(), biens: new Set(), parcelles: new Set() };
    par.set(auteurId, s);
  }
  return s;
}

/** Les adresses touchées par chaque auteur. Le secteur n’est travaillé que par son titulaire. */
async function adressesParAuteur(
  supabase: Client,
  journal: JournalActivite,
  profileIds: ReadonlySet<string>,
  intervalle: Intervalle,
): Promise<Map<string, AdresseAJuger[]>> {
  const gestes = touchesParAuteur({ journal, profileIds, intervalle });
  const par = new Map<string, Seau>();
  const auteurParNote = new Map<string, string>();
  for (const n of journal.notes) {
    if (n.id && n.auteurId) auteurParNote.set(n.id, n.auteurId);
  }

  const noteIds: string[] = [];
  for (const [auteurId, geste] of gestes) {
    const s = seauDe(par, auteurId);
    for (const ban of geste.banIds) s.bans.add(ban);
    for (const noteId of geste.noteIds) noteIds.push(noteId);
  }

  for (const lot of lots(noteIds)) {
    const { data, error } = await supabase
      .from('note_liens')
      .select('note_id, entite_type, entite_id')
      .in('note_id', lot)
      .in('entite_type', ['bien', 'immeuble', 'parcelle']);
    if (error) {
      console.error('[activite] liens de notes', error.message);
      continue;
    }
    for (const row of data ?? []) {
      const auteurId = auteurParNote.get(row.note_id);
      if (!auteurId) continue;
      const s = seauDe(par, auteurId);
      if (row.entite_type === 'immeuble') s.bans.add(row.entite_id);
      else if (row.entite_type === 'parcelle') s.parcelles.add(row.entite_id);
      else if (row.entite_type === 'bien') s.biens.add(row.entite_id);
    }
  }

  const bienIds = [...new Set([...par.values()].flatMap((s) => [...s.biens]))];
  const adressesBiens = new Map<string, AdresseAJuger>();
  for (const lot of lots(bienIds)) {
    const { data, error } = await supabase
      .from('biens')
      .select('id, address, postal_code, latitude, longitude, ban_id')
      .in('id', lot);
    if (error) {
      console.error('[activite] biens des secteurs', error.message);
      continue;
    }
    for (const b of data ?? []) {
      if (b.ban_id) {
        for (const s of par.values()) {
          if (s.biens.has(b.id)) s.bans.add(b.ban_id);
        }
      }
      adressesBiens.set(
        b.id,
        adresseAJuger({
          address: b.address,
          postalCode: b.postal_code,
          latitude: b.latitude,
          longitude: b.longitude,
        }),
      );
    }
  }

  const banIds = [...new Set([...par.values()].flatMap((s) => [...s.bans]))];
  const adressesBans = new Map<string, AdresseAJuger>();
  for (const lot of lots(banIds)) {
    const { data, error } = await supabase
      .from('buildings')
      .select('ban_id, adresse, code_postal, lat, lng, parcelle_id')
      .in('ban_id', lot);
    if (error) {
      console.error('[activite] immeubles des secteurs', error.message);
      continue;
    }
    for (const b of data ?? []) {
      adressesBans.set(
        b.ban_id,
        adresseAJuger({
          address: b.adresse,
          postalCode: b.code_postal,
          latitude: b.lat,
          longitude: b.lng,
          parcelleId: b.parcelle_id,
        }),
      );
    }
  }

  const out = new Map<string, AdresseAJuger[]>();
  for (const [auteurId, s] of par) {
    const adresses: AdresseAJuger[] = [];
    for (const ban of s.bans) {
      const adresse = adressesBans.get(ban);
      if (adresse) adresses.push(adresse);
    }
    for (const bien of s.biens) {
      const adresse = adressesBiens.get(bien);
      if (adresse) adresses.push(adresse);
    }
    for (const parcelleId of s.parcelles) adresses.push(adresseAJuger({ parcelleId }));
    out.set(auteurId, adresses);
  }
  return out;
}
