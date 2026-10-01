import type { SupabaseClient } from '@supabase/supabase-js';
import { contactGeocodeQuery, geocodeToColumns, type BanGeoColumns } from '@/lib/geo/fields';
import { reverseGeocode } from '@/lib/geo/ban';
import { mapDbContactToContact, withContactsSelect } from '@/lib/queries/contacts';
import {
  extractNotePropositions,
  EMPTY_NOTE_EXTRACTION,
  type ModeLecture,
  type NoteExtraction,
} from '@/lib/notes/propositions';
import { buildReviewPayload, type NoteReviewPayload } from '@/lib/notes/build-review';
import type { BienContexte, EtapeContexte, LeadContexte } from '@/lib/notes/review-v2';
import { guessAdresseFromTranscript } from '@/lib/notes/from-transcript';
import { requireMistralKey } from '@/lib/voice/transcribe';
import type { Contact, VoiceNoteVisibilite } from '@/types/contact';
import type { MandatStatut } from '@/types/bien';
import type { ContactRow, Database } from '@/types/database';

type Admin = SupabaseClient<Database>;

const PAGE = 1_000;
/** Garde-fou : au-delà, la note se relie à la main plutôt que de bloquer. */
const MAX_LIGNES = 20_000;

/**
 * Tout le fichier de l'agence, page par page. Limiter à 400 fiches faisait
 * rater un contact existant et en créait un doublon.
 */
async function toutesLesPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_LIGNES; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) {
      console.error('[voice] lecture du fichier', error);
      break;
    }
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Contexte de l'agence                                                        */
/* -------------------------------------------------------------------------- */

export type ContexteAgence = {
  contacts: Contact[];
  biens: BienContexte[];
  etapes: EtapeContexte[];
};

type BienLu = {
  id: string;
  address: string;
  city: string | null;
  postal_code: string | null;
  price: number | null;
  surface_m2: number | null;
  rooms: number | null;
  mandat_statut: MandatStatut | null;
  ban_id?: string | null;
};

export async function chargerContexteAgence(admin: Admin, agencyId: string): Promise<ContexteAgence> {
  const [contactRows, bienRows, etapes] = await Promise.all([
    toutesLesPages<ContactRow>((from, to) =>
      withContactsSelect((sel) =>
        admin.from('contacts').select(sel).eq('agency_id', agencyId).order('id').range(from, to),
      ),
    ),
    toutesLesPages<BienLu>((from, to) =>
      admin
        .from('biens')
        .select('id, address, city, postal_code, price, surface_m2, rooms, mandat_statut, ban_id')
        .eq('agency_id', agencyId)
        .order('id')
        .range(from, to),
    ),
    admin
      .from('lead_stages')
      .select('id, cle, libelle')
      .eq('agency_id', agencyId)
      .then(({ data }) => (data ?? []) as EtapeContexte[], () => [] as EtapeContexte[]),
  ]);

  return {
    contacts: contactRows.map(mapDbContactToContact),
    biens: bienRows.map((b) => ({
      id: b.id,
      address: b.address,
      city: b.city,
      postalCode: b.postal_code,
      price: b.price != null ? Number(b.price) : null,
      surfaceM2: b.surface_m2 != null ? Number(b.surface_m2) : null,
      rooms: b.rooms,
      mandatStatut: b.mandat_statut,
      banId: b.ban_id ?? null,
    })),
    etapes,
  };
}

/**
 * Pendant la dictée, la lecture repasse toutes les deux ou trois secondes : on
 * garde le fichier de l'agence une minute plutôt que de le relire à chaque fois.
 */
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; contexte: Promise<ContexteAgence> }>();

export function contexteAgenceEnCache(admin: Admin, agencyId: string): Promise<ContexteAgence> {
  const hit = cache.get(agencyId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.contexte;
  const contexte = chargerContexteAgence(admin, agencyId).catch((err) => {
    cache.delete(agencyId);
    throw err;
  });
  cache.set(agencyId, { at: Date.now(), contexte });
  return contexte;
}

async function leadsALaBan(admin: Admin, agencyId: string, banId: string | null): Promise<LeadContexte[]> {
  if (!banId) return [];
  const { data, error } = await admin
    .from('leads')
    .select('id, address, ban_id, stage_id')
    .eq('agency_id', agencyId)
    .eq('ban_id', banId)
    .limit(5);
  if (error) return [];
  return ((data ?? []) as { id: string; address: string; ban_id: string | null; stage_id: string | null }[]).map(
    (l) => ({ id: l.id, address: l.address, banId: l.ban_id, stageId: l.stage_id }),
  );
}

/* -------------------------------------------------------------------------- */
/* Lieu de la note                                                             */
/* -------------------------------------------------------------------------- */

/** Ce que la note savait déjà de son lieu : immeuble choisi, ou position GPS. */
export type LieuConnu = {
  banId: string | null;
  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
};

const GEO_VIDE: BanGeoColumns = {
  ban_id: null,
  adresse_normalisee: null,
  geocode_score: null,
  latitude: null,
  longitude: null,
  geocode_le: null,
};

/**
 * La dictée ne cite pas d'adresse : l'immeuble ouvert ou le GPS la donnent.
 * Sans ce repli, relire la note effaçait l'immeuble posé à la capture.
 */
async function geoDuLieu(lieu: LieuConnu | undefined): Promise<BanGeoColumns> {
  if (!lieu) return GEO_VIDE;
  if (lieu.banId) {
    return {
      ...GEO_VIDE,
      ban_id: lieu.banId,
      adresse_normalisee: lieu.adresse,
      latitude: lieu.latitude,
      longitude: lieu.longitude,
    };
  }
  if (lieu.latitude != null && lieu.longitude != null) {
    const hit = await reverseGeocode(lieu.latitude, lieu.longitude);
    if (hit) {
      return {
        ban_id: hit.ban_id,
        adresse_normalisee: hit.adresse_normalisee,
        geocode_score: hit.score,
        latitude: lieu.latitude,
        longitude: lieu.longitude,
        geocode_le: new Date().toISOString(),
      };
    }
  }
  return GEO_VIDE;
}

/* -------------------------------------------------------------------------- */
/* Lecture qui fait foi                                                        */
/* -------------------------------------------------------------------------- */

export async function extractAndBuildReview(args: {
  admin: Admin;
  agencyId: string;
  voiceNoteId: string;
  transcript: string;
  visibilite: VoiceNoteVisibilite;
  keepGps: boolean;
  /** Ne pas écraser l'adresse / BAN déjà posés (note écrite). */
  keepAdresse?: boolean;
  /** L’agent a déjà choisi la source : ne pas la recouvrir. */
  keepSourceInfo?: boolean;
  initialGeo?: BanGeoColumns;
  /** Note écrite guidée : on ne relance pas l’IA. */
  providedExtraction?: NoteExtraction | null;
  /** Jour de la dictée. Une note relue deux jours plus tard garde son « jeudi ». */
  noteDate?: Date;
  /** Immeuble ou position connus à la capture, quand la dictée ne dit pas où. */
  lieuConnu?: LieuConnu;
  /** Prénom de l'agent, pour signer un brouillon d'e-mail. */
  agentPrenom?: string | null;
}): Promise<NoteReviewPayload> {
  const noteDate = args.noteDate ?? new Date();
  const transcript = args.transcript.trim();
  let extraction: NoteExtraction | null = args.providedExtraction ?? null;
  let extractFailed = false;
  let geo: BanGeoColumns = args.initialGeo ? { ...args.initialGeo } : { ...GEO_VIDE };

  let apiKey: string | null = null;
  if (!extraction) {
    try {
      apiKey = requireMistralKey();
    } catch {
      apiKey = null;
    }
  }

  // Le fichier de l'agence se charge pendant que le modèle lit la note.
  const contextePromise = chargerContexteAgence(args.admin, args.agencyId);

  if (!extraction && apiKey && transcript) {
    try {
      extraction = await extractNotePropositions(transcript, apiKey, noteDate, {
        mode: 'profond',
        agentPrenom: args.agentPrenom,
      });
    } catch (err) {
      console.error('[voice] extraction', err instanceof Error ? err.message : err);
      extractFailed = true;
    }
  } else if (!extraction) {
    extractFailed = Boolean(transcript);
  }

  if (!args.keepAdresse) {
    const adresseDite =
      extraction?.address ?? (transcript ? guessAdresseFromTranscript(transcript) : null);
    if (adresseDite && extraction && !extraction.address) {
      extraction = { ...extraction, address: adresseDite };
    } else if (adresseDite && !extraction) {
      extraction = { ...EMPTY_NOTE_EXTRACTION, address: adresseDite };
    }
    const query = adresseDite ? contactGeocodeQuery(adresseDite, null, null) : null;
    if (query) {
      const columns = await geocodeToColumns(query.adresse, query.codePostal);
      geo = { ...geo, ...columns };
    }
    if (!geo.ban_id) {
      const lieu = await geoDuLieu(args.lieuConnu);
      if (lieu.ban_id) geo = lieu;
    }
  }

  if (extraction) {
    await args.admin
      .from('voice_notes')
      .update({
        transcript,
        structured: extraction,
        ...(args.keepSourceInfo ? {} : { source_info: extraction.sourceInfo }),
        ...(args.keepGps || geo.latitude == null
          ? {}
          : { latitude: geo.latitude, longitude: geo.longitude }),
        ...(args.keepAdresse || !geo.ban_id
          ? {}
          : {
              ban_id: geo.ban_id,
              adresse_normalisee: geo.adresse_normalisee,
              geocode_score: geo.geocode_score,
              geocode_le: geo.geocode_le,
            }),
        status: 'transcrit',
      })
      .eq('id', args.voiceNoteId)
      .eq('agency_id', args.agencyId);
  } else {
    await args.admin
      .from('voice_notes')
      .update({ transcript: transcript || null, ...(transcript ? { status: 'transcrit' as const } : {}) })
      .eq('id', args.voiceNoteId)
      .eq('agency_id', args.agencyId);
  }

  const [contexte, leads] = await Promise.all([
    contextePromise,
    leadsALaBan(args.admin, args.agencyId, geo.ban_id),
  ]);

  return buildReviewPayload({
    voiceNoteId: args.voiceNoteId,
    transcript: transcript || null,
    visibilite: args.visibilite,
    extraction,
    extractFailed,
    contacts: contexte.contacts,
    agencyId: args.agencyId,
    geo,
    biensAgence: contexte.biens,
    leadsAgence: leads,
    etapes: contexte.etapes,
    noteDate,
  });
}

/* -------------------------------------------------------------------------- */
/* Lecture pendant la dictée                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ce que Priimo comprend pendant que l'agent parle. Rien n'est écrit : la
 * lecture qui fait foi repasse une fois la dictée terminée.
 */
export async function comprendreEnDirect(args: {
  admin: Admin;
  agencyId: string;
  transcript: string;
  noteDate?: Date;
  banId?: string | null;
  agentPrenom?: string | null;
  mode?: ModeLecture;
}): Promise<NoteReviewPayload> {
  const noteDate = args.noteDate ?? new Date();
  const transcript = args.transcript.trim();
  const apiKey = requireMistralKey();
  const [extraction, contexte, leads] = await Promise.all([
    extractNotePropositions(transcript, apiKey, noteDate, {
      mode: args.mode ?? 'rapide',
      agentPrenom: args.agentPrenom,
    }),
    contexteAgenceEnCache(args.admin, args.agencyId),
    leadsALaBan(args.admin, args.agencyId, args.banId ?? null),
  ]);

  return buildReviewPayload({
    voiceNoteId: 'direct',
    transcript,
    visibilite: 'agence',
    extraction,
    extractFailed: false,
    contacts: contexte.contacts,
    agencyId: args.agencyId,
    geo: { ban_id: args.banId ?? null, adresse_normalisee: null, geocode_score: null },
    biensAgence: contexte.biens,
    leadsAgence: leads,
    etapes: contexte.etapes,
    noteDate,
  });
}
