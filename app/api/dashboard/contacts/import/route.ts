import { after, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleContactsFor } from '@/lib/agency/scope-records';
import { contactFieldsToRow } from '@/lib/contact-input';
import { createBanGeocodeCache } from '@/lib/geo/ban';
import { contactGeocodeQuery, geocodeToColumns } from '@/lib/geo/fields';
import {
  insertContactRow,
  insertContactRows,
  mapDbContactToContact,
  updateContactRow,
  withContactsSelect,
} from '@/lib/queries/contacts';
import {
  CONTACT_IMPORT_FIELDS,
  completerContact,
  contactToDuplicateRef,
  contactToInput,
  planContactImport,
} from '@/lib/import/contacts';
import {
  ANNULATION_JOURS,
  colonnesDesChamps,
  importAnnulable,
  tableImportsAbsente,
} from '@/lib/import/annulation';
import { CONTACT_IMPORT_LOT } from '@/lib/import/limits';
import { MAX_COLONNES_RELUES, validerColonnes } from '@/lib/import/colonnes-ia';
import { retenirFormat } from '@/lib/import/colonnes-ia-serveur';
import type { Contact } from '@/types/contact';
import type { ContactImportCompletion, ContactInsert, ContactRow, Database } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Client = SupabaseClient<Database>;

const FIELD_KEYS = new Set(CONTACT_IMPORT_FIELDS.map((f) => f.key));
const GEOCODAGES_SIMULTANES = 8;
const INSERTIONS_PAR_REQUETE = 100;
const PAGE_LECTURE = 1_000;

function sanitizeRows(raw: unknown): { line: number; mapped: Record<string, string> }[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, CONTACT_IMPORT_LOT).flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    const line = Number(row.line);
    if (!Number.isInteger(line) || line < 1) return [];
    const mappedRaw = row.mapped;
    if (typeof mappedRaw !== 'object' || mappedRaw === null) return [];
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(mappedRaw as Record<string, unknown>)) {
      if (!FIELD_KEYS.has(key)) continue;
      mapped[key] = typeof value === 'string' ? value.slice(0, 8000) : '';
    }
    return [{ line, mapped }];
  });
}

/** `{ enTetes, champs, notes }` envoyé avec le premier lot d'un tableur ; null sinon. */
function lireFormatEnvoye(
  raw: unknown,
): { enTetes: string[]; colonnes: { champs: Record<string, number>; notes: number[] } } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.enTetes) || r.enTetes.length === 0 || r.enTetes.length > MAX_COLONNES_RELUES) return null;
  const enTetes = r.enTetes.map((h) => (typeof h === 'string' ? h.slice(0, 120) : ''));
  const colonnes = validerColonnes({ champs: r.champs, notes: r.notes }, enTetes.length);
  if (!colonnes || Object.keys(colonnes.champs).length === 0) return null;
  return { enTetes, colonnes: { champs: colonnes.champs, notes: colonnes.notes } };
}

async function enParallele<T, R>(
  items: readonly T[],
  limite: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let suivant = 0;
  async function ouvrier() {
    while (suivant < items.length) {
      const i = suivant++;
      out[i] = await fn(items[i] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, ouvrier));
  return out;
}

/** Toute l'agence, page par page : PostgREST plafonne une lecture à 1 000 lignes. */
async function lireContacts(supabase: Client): Promise<{ rows: ContactRow[]; error: unknown }> {
  const rows: ContactRow[] = [];
  for (let debut = 0; ; debut += PAGE_LECTURE) {
    const { data, error } = await withContactsSelect((sel) =>
      supabase
        .from('contacts')
        .select(sel)
        .order('created_at', { ascending: true })
        .range(debut, debut + PAGE_LECTURE - 1),
    );
    if (error) return { rows, error };
    const page = (data ?? []) as unknown as ContactRow[];
    rows.push(...page);
    if (page.length < PAGE_LECTURE) return { rows, error: null };
  }
}

/** L'import en cours (lots suivants) ou un nouvel import. `null` : migration pas passée, pas d'annulation. */
async function ouvrirImport(
  supabase: Client,
  payload: Record<string, unknown>,
  ids: { agencyId: string; profileId: string },
): Promise<{ id: string | null; refus?: string }> {
  if (typeof payload.importId === 'string' && payload.importId) {
    const { data, error } = await supabase
      .from('contact_imports')
      .select('id, created_at, annule_le')
      .eq('id', payload.importId)
      .eq('agency_id', ids.agencyId)
      .eq('created_by', ids.profileId)
      .maybeSingle();
    if (error || !data) return { id: null, refus: 'Import introuvable' };
    if (data.annule_le) return { id: null, refus: 'Cet import a été annulé' };
    return { id: data.id };
  }

  const fichier =
    typeof payload.fichier === 'object' && payload.fichier !== null
      ? (payload.fichier as Record<string, unknown>)
      : {};
  const format =
    fichier.format === 'vcard' || fichier.format === 'google' || fichier.format === 'telephone'
      ? fichier.format
      : 'tableur';
  const ouvrir = (f: 'tableur' | 'vcard' | 'google' | 'telephone') =>
    supabase
      .from('contact_imports')
      .insert({
        agency_id: ids.agencyId,
        created_by: ids.profileId,
        nom_fichier: typeof fichier.nom === 'string' ? fichier.nom.slice(0, 200) : '',
        format: f,
      })
      .select('id')
      .single();
  let { data, error } = await ouvrir(format);
  // Base en retard d'une migration : l'origine récente n'y est pas encore admise.
  if (error?.code === '23514' && format !== 'tableur') ({ data, error } = await ouvrir('tableur'));
  if (error || !data) {
    if (!tableImportsAbsente(error)) console.error('[contacts/import] ouverture', error);
    return { id: null };
  }
  return { id: data.id };
}

/** Fiches déjà créées par cet import (lots précédents) : une ligne qui les retrouve est réunie, pas « complétée ». */
async function creesParCetImport(supabase: Client, importId: string | null): Promise<Set<string>> {
  if (!importId) return new Set();
  const { data } = await supabase.from('contacts').select('id').eq('import_id', importId).limit(20_000);
  return new Set((data ?? []).map((r) => r.id));
}

async function insererCreations(
  supabase: Client,
  lignes: readonly { line: number; row: ContactInsert }[],
): Promise<{ created: ContactRow[]; echecs: number[] }> {
  const created: ContactRow[] = [];
  const echecs: number[] = [];
  for (let i = 0; i < lignes.length; i += INSERTIONS_PAR_REQUETE) {
    const lot = lignes.slice(i, i + INSERTIONS_PAR_REQUETE);
    const { data, error } = await insertContactRows(
      supabase,
      lot.map((l) => l.row),
    );
    if (!error && data) {
      created.push(...data);
      continue;
    }
    // Une ligne refusée fait échouer tout le lot : on repasse une à une pour l'isoler.
    console.error('[contacts/import] lot refusé, reprise ligne à ligne', error);
    for (const l of lot) {
      const seul = await insertContactRow(supabase, l.row);
      if (seul.error || !seul.data) echecs.push(l.line);
      else created.push(seul.data);
    }
  }
  return { created, echecs };
}

async function enregistrerLot(
  supabase: Client,
  importId: string,
  lot: { crees: number; completes: number; dejaPresents: number; ecartes: number },
  completions: ContactImportCompletion[],
) {
  const { data: courant, error } = await supabase
    .from('contact_imports')
    .select('crees, completes, deja_presents, ecartes, completions')
    .eq('id', importId)
    .single();
  if (error || !courant) {
    console.error('[contacts/import] compteurs', error);
    return;
  }
  const { error: ecriture } = await supabase
    .from('contact_imports')
    .update({
      crees: courant.crees + lot.crees,
      completes: courant.completes + lot.completes,
      deja_presents: courant.deja_presents + lot.dejaPresents,
      ecartes: courant.ecartes + lot.ecartes,
      completions: [...(courant.completions ?? []), ...completions],
      termine_le: new Date().toISOString(),
    })
    .eq('id', importId);
  if (ecriture) console.error('[contacts/import] compteurs', ecriture);
}

/**
 * Un lot de lignes déjà lues côté navigateur. Le premier lot ouvre l'import,
 * les suivants le prolongent (`importId`). Aucune question : on crée, on
 * complète sans rien écraser, on réunit les doublons.
 */
export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const payload = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const rows = sanitizeRows(payload.rows);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne à importer' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const ouverture = await ouvrirImport(supabase, payload, { agencyId: agency.id, profileId: profile.id });
  if (ouverture.refus) {
    return NextResponse.json({ error: ouverture.refus }, { status: 409 });
  }
  const importId = ouverture.id;

  // Premier lot d'un tableur : on retient son format pour le reconnaître la prochaine fois.
  const format = lireFormatEnvoye(payload.colonnes);
  if (format) after(() => retenirFormat(format.enTetes, format.colonnes));

  const lecture = await lireContacts(supabase);
  if (lecture.error) {
    console.error('[contacts/import] lecture', lecture.error);
    return NextResponse.json({ error: 'Lecture des contacts impossible' }, { status: 500 });
  }

  // On ne complète que ce que l'agent voit : la fiche privée d'un collègue
  // reste à son titulaire, l'agent importe la sienne.
  const lignesParId = new Map(lecture.rows.map((r) => [r.id, r]));
  const visibles = visibleContactsFor(viewerFromProfile(profile), lecture.rows.map(mapDbContactToContact));
  const visiblesParId = new Map(visibles.map((c) => [c.id, c]));
  const dejaCrees = await creesParCetImport(supabase, importId);

  const plan = planContactImport(rows, visibles.map(contactToDuplicateRef));
  const cache = createBanGeocodeCache();
  const meta = { agencyId: agency.id, createdBy: profile.id, source: 'manuel' as const };
  const maintenant = new Date().toISOString();

  const skipped: { line: number; reason: string }[] = [];
  const avertissements: { line: number; message: string }[] = [];
  let reunis = 0;
  for (const item of plan) {
    if (item.action === 'skip') skipped.push({ line: item.line, reason: item.reason });
    else {
      if (item.action === 'merged') reunis += 1;
      for (const message of item.avertissements) avertissements.push({ line: item.line, message });
    }
  }

  const creations = plan.flatMap((p) => (p.action === 'create' ? [p] : []));
  const lignes = await enParallele(creations, GEOCODAGES_SIMULTANES, async (item) => {
    const query = contactGeocodeQuery(item.fields.address, item.fields.secteur, item.fields.postalCodes);
    const geo = query ? await geocodeToColumns(query.adresse, query.codePostal, cache) : {};
    const row: ContactInsert = {
      ...contactFieldsToRow(item.fields, meta),
      last_interaction_at: maintenant,
      ...geo,
      ...(importId ? { import_id: importId } : {}),
    };
    return { line: item.line, row };
  });
  const { created: crees, echecs } = await insererCreations(supabase, lignes);
  for (const line of echecs) skipped.push({ line, reason: 'Écriture impossible' });

  const completed: Contact[] = [];
  const completions: ContactImportCompletion[] = [];
  let dejaPresents = 0;
  const aCompleter = plan.flatMap((p) => (p.action === 'complete' ? [p] : []));
  await enParallele(aCompleter, 6, async (item) => {
    const id = item.duplicate.id;
    const actuel = visiblesParId.get(id);
    const ligne = lignesParId.get(id);
    if (!actuel || !ligne) {
      skipped.push({ line: item.line, reason: 'Fiche introuvable' });
      return;
    }
    const { fields, champs } = completerContact(contactToInput(actuel), item.fields);
    if (champs.length === 0) {
      if (dejaCrees.has(id)) reunis += 1;
      else dejaPresents += 1;
      return;
    }

    const apres = contactFieldsToRow(fields, meta) as unknown as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const colonne of colonnesDesChamps(champs)) patch[colonne] = apres[colonne];
    const lieuComplete = champs.some((c) => c === 'address' || c === 'secteur' || c === 'postalCodes');
    if (lieuComplete && !ligne.ban_id) {
      const query = contactGeocodeQuery(fields.address, fields.secteur, fields.postalCodes);
      if (query) Object.assign(patch, await geocodeToColumns(query.adresse, query.codePostal, cache));
    }

    const { data, error } = await updateContactRow(
      supabase,
      { contactId: id, agencyId: agency.id },
      patch as Partial<ContactRow>,
    );
    if (error || !data) {
      console.error('[contacts/import] complément', error);
      skipped.push({ line: item.line, reason: 'Mise à jour impossible' });
      return;
    }
    completed.push(mapDbContactToContact(data as unknown as ContactRow));
    // Une fiche née d'un lot précédent du même fichier : rien à défaire à part elle.
    if (dejaCrees.has(id)) {
      reunis += 1;
      return;
    }
    const avant: Record<string, unknown> = {};
    for (const colonne of Object.keys(patch)) {
      avant[colonne] = (ligne as unknown as Record<string, unknown>)[colonne] ?? null;
    }
    completions.push({ id, avant, apres: patch });
  });

  if (importId) {
    await enregistrerLot(
      supabase,
      importId,
      {
        crees: crees.length,
        completes: completions.length,
        dejaPresents,
        ecartes: skipped.length,
      },
      completions,
    );
  }

  return NextResponse.json({
    importId,
    created: crees.map(mapDbContactToContact),
    completed,
    completes: completions.length,
    dejaPresents,
    reunis,
    skipped: skipped.sort((a, b) => a.line - b.line),
    avertissements,
  });
}

/** Mes imports encore annulables. */
export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const depuis = new Date(Date.now() - ANNULATION_JOURS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('contact_imports')
    .select('id, nom_fichier, format, crees, completes, created_at, annule_le')
    .eq('agency_id', agency.id)
    .eq('created_by', profile.id)
    .is('annule_le', null)
    .gte('created_at', depuis)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    if (!tableImportsAbsente(error)) console.error('[contacts/import] liste', error);
    return NextResponse.json({ imports: [] });
  }

  return NextResponse.json({
    imports: (data ?? [])
      .filter((row) => importAnnulable(row) && row.crees + row.completes > 0)
      .map((row) => ({
        id: row.id,
        nomFichier: row.nom_fichier,
        crees: row.crees,
        completes: row.completes,
        createdAt: row.created_at,
      })),
  });
}
