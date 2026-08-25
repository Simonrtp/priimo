import type { SupabaseClient } from '@supabase/supabase-js';
import { contactGeocodeQuery, geocodeToColumns } from '@/lib/geo/fields';
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
}): Promise<NoteReviewPayload> {
  const transcript = args.transcript.trim();
  let extraction: NoteExtraction | null = null;
  let extractFailed = false;
  let geo = {
    ban_id: null as string | null,
    adresse_normalisee: null as string | null,
    geocode_score: null as number | null,
    latitude: null as number | null,
    longitude: null as number | null,
    geocode_le: null as string | null,
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
      const query = contactGeocodeQuery(extraction.address, null, null);
      if (query) {
        const columns = await geocodeToColumns(query.adresse, query.codePostal);
        geo = { ...geo, ...columns };
      }
      await args.admin
        .from('voice_notes')
        .update({
          transcript,
          structured: extraction,
          source_info: extraction.sourceInfo,
          ...(args.keepGps ? {} : { latitude: geo.latitude, longitude: geo.longitude }),
          ban_id: geo.ban_id,
          adresse_normalisee: geo.adresse_normalisee,
          geocode_score: geo.geocode_score,
          geocode_le: geo.geocode_le,
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
