import type { SupabaseClient } from '@supabase/supabase-js';
import { contactGeocodeQuery, geocodeToColumns, type BanGeoColumns } from '@/lib/geo/fields';
import { CONTACTS_SELECT, mapDbContactToContact } from '@/lib/queries/contacts';
import { extractNotePropositions, type NoteExtraction } from '@/lib/notes/propositions';
import { buildReviewPayload, type NoteReviewPayload } from '@/lib/notes/build-review';
import { requireMistralKey } from '@/lib/voice/transcribe';
import type { ContactRow, Database } from '@/types/database';
import type { VoiceNoteVisibilite } from '@/types/contact';

type Admin = SupabaseClient<Database>;

export async function extractAndBuildReview(args: {
  admin: Admin;
  agencyId: string;
  voiceNoteId: string;
  transcript: string;
  visibilite: VoiceNoteVisibilite;
  keepGps: boolean;
  /** Ne pas écraser l'adresse / BAN déjà posés (note écrite). */
  keepAdresse?: boolean;
  initialGeo?: BanGeoColumns;
}): Promise<NoteReviewPayload> {
  const transcript = args.transcript.trim();
  let extraction: NoteExtraction | null = null;
  let extractFailed = false;
  let geo: BanGeoColumns = args.initialGeo
    ? { ...args.initialGeo }
    : {
        ban_id: null,
        adresse_normalisee: null,
        geocode_score: null,
        latitude: null,
        longitude: null,
        geocode_le: null,
      };

  let apiKey: string | null = null;
  try {
    apiKey = requireMistralKey();
  } catch {
    apiKey = null;
  }

  if (apiKey && transcript) {
    try {
      extraction = await extractNotePropositions(transcript, apiKey);
      if (!args.keepAdresse) {
        const query = contactGeocodeQuery(extraction.address, null, null);
        if (query) {
          const columns = await geocodeToColumns(query.adresse, query.codePostal);
          geo = { ...geo, ...columns };
        }
      }
      await args.admin
        .from('voice_notes')
        .update({
          transcript,
          structured: extraction,
          source_info: extraction.sourceInfo,
          ...(args.keepGps ? {} : { latitude: geo.latitude, longitude: geo.longitude }),
          ...(args.keepAdresse
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
    } catch (err) {
      console.error('[voice] extraction', err);
      extractFailed = true;
      await args.admin
        .from('voice_notes')
        .update({ transcript, status: 'transcrit' })
        .eq('id', args.voiceNoteId)
        .eq('agency_id', args.agencyId);
    }
  } else {
    extractFailed = Boolean(transcript);
    await args.admin
      .from('voice_notes')
      .update({ transcript: transcript || null })
      .eq('id', args.voiceNoteId)
      .eq('agency_id', args.agencyId);
  }

  const { data: contactRows } = await args.admin
    .from('contacts')
    .select(CONTACTS_SELECT)
    .eq('agency_id', args.agencyId)
    .limit(400);

  const contacts = ((contactRows ?? []) as unknown as ContactRow[]).map(mapDbContactToContact);

  return buildReviewPayload({
    voiceNoteId: args.voiceNoteId,
    transcript: transcript || null,
    visibilite: args.visibilite,
    extraction,
    extractFailed,
    contacts,
    agencyId: args.agencyId,
    geo,
  });
}
