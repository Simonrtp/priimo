import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ParcelleAdresseRow, ParcelleDiagnosticRow, ParcelleSyntheseRow, ParcelleVenteRow } from '@/types/database';
import {
  canSeeLeadRecord,
  canSeeOwnedRecord,
  type RecordViewer,
} from '@/lib/agency/visibility';
import { canSeeVoiceNote } from '@/lib/notes/visibility';
import {
  filterPublicDiagnostics,
  formatIdu,
  type ParcelleAgencyItem,
  type ParcelleFiche,
  type ParcelleNoteMarker,
} from '@/lib/carte/parcelle';

type Admin = SupabaseClient<Database>;

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickAdresse(rows: ParcelleAdresseRow[]): string | null {
  const principale = rows.find((r) => r.principale && r.libelle.trim());
  const any = rows.find((r) => r.libelle.trim());
  return (principale ?? any)?.libelle.trim() || null;
}

function excerpt(text: string | null): string | null {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return null;
  return t.length > 90 ? `${t.slice(0, 89)}…` : t;
}

export async function fetchParcelleFiche(
  admin: Admin,
  args: { idu: string; agencyId: string; viewer: RecordViewer },
): Promise<ParcelleFiche> {
  const { idu, agencyId, viewer } = args;

  const [syntheseRes, adressesRes, ventesRes, diagRes, liensRes] = await Promise.all([
    admin.from('parcelle_synthese').select('*').eq('idu', idu).maybeSingle(),
    admin.from('parcelle_adresses').select('*').eq('idu', idu),
    admin.from('parcelle_ventes').select('*').eq('idu', idu).order('date_mutation', { ascending: false }),
    admin.from('parcelle_diagnostics').select('*').eq('idu', idu),
    admin.from('note_liens').select('note_id').eq('agency_id', agencyId).eq('entite_type', 'parcelle').eq('entite_id', idu),
  ]);

  const synthese = (syntheseRes.data ?? null) as ParcelleSyntheseRow | null;
  const adresses = (adressesRes.data ?? []) as ParcelleAdresseRow[];
  const ventesRows = (ventesRes.data ?? []) as ParcelleVenteRow[];
  const diagRows = (diagRes.data ?? []) as ParcelleDiagnosticRow[];
  const noteIdsFromLiens = (liensRes.data ?? []).map((r) => r.note_id);

  const diagnostics = filterPublicDiagnostics(
    diagRows.map((row) => ({
      date: row.date_diag,
      etiquette: row.etiquette,
      type: row.type,
    })),
  );

  const banIds = [...new Set(adresses.map((a) => a.ban_id).filter((id): id is string => Boolean(id)))];

  const surCetteParcelle: ParcelleAgencyItem[] = [];
  const seen = new Set<string>();

  function push(item: ParcelleAgencyItem) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    surCetteParcelle.push(item);
  }

  if (banIds.length > 0) {
    const [leadsRes, contactsRes, biensRes, notesBanRes] = await Promise.all([
      admin
        .from('leads')
        .select('id, address, city, postal_code, score, assigned_to, ban_id')
        .eq('agency_id', agencyId)
        .in('ban_id', banIds),
      admin
        .from('contacts')
        .select('id, first_name, last_name, contact_type, assigned_to, created_by, ban_id')
        .eq('agency_id', agencyId)
        .in('ban_id', banIds),
      admin
        .from('biens')
        .select('id, address, mandat_statut, created_by, ban_id')
        .eq('agency_id', agencyId)
        .in('ban_id', banIds),
      admin
        .from('voice_notes')
        .select('id, transcript, visibilite, created_by, assigned_to, ban_id')
        .eq('agency_id', agencyId)
        .in('ban_id', banIds),
    ]);

    for (const row of leadsRes.data ?? []) {
      if (!canSeeLeadRecord(viewer, { assignedTo: row.assigned_to ?? null })) continue;
      push({
        id: row.id,
        kind: 'lead',
        title: row.address,
        subtitle: [row.postal_code, row.city].filter(Boolean).join(' ') || null,
        href: `/dashboard/prospection?lead=${row.id}`,
      });
    }
    for (const row of contactsRes.data ?? []) {
      if (!canSeeOwnedRecord(viewer, { assignedTo: row.assigned_to ?? null, createdBy: row.created_by ?? null })) continue;
      const title = [row.first_name, row.last_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' ') || 'Contact';
      push({
        id: row.id,
        kind: 'contact',
        title,
        subtitle: row.contact_type ?? null,
        href: `/dashboard/contacts?fiche=${row.id}`,
      });
    }
    for (const row of biensRes.data ?? []) {
      if (!canSeeOwnedRecord(viewer, { assignedTo: null, createdBy: row.created_by ?? null })) continue;
      push({
        id: row.id,
        kind: 'bien',
        title: row.address,
        subtitle: row.mandat_statut ?? null,
        href: `/dashboard/biens?fiche=${row.id}`,
      });
    }
    for (const row of notesBanRes.data ?? []) {
      if (!canSeeVoiceNote(viewer, { visibilite: row.visibilite === 'privee' ? 'privee' : 'agence', createdBy: row.created_by ?? null })) {
        continue;
      }
      push({
        id: row.id,
        kind: 'note',
        title: excerpt(row.transcript) ?? 'Note terrain',
        subtitle: null,
        href: '/dashboard',
      });
    }
  }

  if (noteIdsFromLiens.length > 0) {
    const { data: linkedNotes } = await admin
      .from('voice_notes')
      .select('id, transcript, visibilite, created_by')
      .eq('agency_id', agencyId)
      .in('id', noteIdsFromLiens);
    for (const row of linkedNotes ?? []) {
      if (!canSeeVoiceNote(viewer, { visibilite: row.visibilite === 'privee' ? 'privee' : 'agence', createdBy: row.created_by ?? null })) {
        continue;
      }
      push({
        id: row.id,
        kind: 'note',
        title: excerpt(row.transcript) ?? 'Note terrain',
        subtitle: null,
        href: '/dashboard',
      });
    }
  }

  const ventes = ventesRows.map((row) => ({
    date: row.date_mutation,
    prix: num(row.prix),
    surface: num(row.surface),
    prixM2: num(row.prix_m2),
  }));

  const hasCopro = Boolean(
    synthese && (synthese.lots != null || synthese.periode_construction || synthese.procedure_en_cours),
  );

  const videPublic = ventes.length === 0 && diagnostics.length === 0 && !hasCopro;

  return {
    idu,
    reference: formatIdu(idu),
    adresse: pickAdresse(adresses),
    videPublic,
    ventes,
    diagnostics,
    copropriete: hasCopro && synthese
      ? {
          lots: synthese.lots,
          periodeConstruction: synthese.periode_construction,
          procedureEnCours: synthese.procedure_en_cours,
        }
      : null,
    surCetteParcelle,
  };
}

export async function fetchParcelleOverlays(
  admin: Admin,
  args: { agencyId: string; postalCodes: readonly string[]; viewer: RecordViewer },
): Promise<{ eventIdus: string[]; notes: ParcelleNoteMarker[] }> {
  const codes = args.postalCodes.filter((c) => /^\d{5}$/.test(c));

  let eventIdus: string[] = [];
  if (codes.length > 0) {
    const { data } = await admin
      .from('parcelle_synthese')
      .select('idu')
      .gt('evenements_count', 0)
      .in('code_postal', codes);
    eventIdus = (data ?? []).map((r) => r.idu);
  }

  const { data: liens } = await admin
    .from('note_liens')
    .select('note_id, entite_id')
    .eq('agency_id', args.agencyId)
    .eq('entite_type', 'parcelle');

  const noteIds = [...new Set((liens ?? []).map((l) => l.note_id))];
  const iduByNote = new Map((liens ?? []).map((l) => [l.note_id, l.entite_id]));
  const notes: ParcelleNoteMarker[] = [];
  const seenIdu = new Set<string>();

  if (noteIds.length > 0) {
    const { data: rows } = await admin
      .from('voice_notes')
      .select('id, latitude, longitude, visibilite, created_by')
      .eq('agency_id', args.agencyId)
      .in('id', noteIds);
    for (const row of rows ?? []) {
      if (
        !canSeeVoiceNote(args.viewer, {
          visibilite: row.visibilite === 'privee' ? 'privee' : 'agence',
          createdBy: row.created_by ?? null,
        })
      ) {
        continue;
      }
      const idu = iduByNote.get(row.id);
      if (!idu || seenIdu.has(idu)) continue;
      seenIdu.add(idu);
      notes.push({
        idu,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
      });
    }
  }

  return { eventIdus, notes };
}
