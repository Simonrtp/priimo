import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mapDbContactToContact, updateContactRow, withContactsSelect } from '@/lib/queries/contacts';
import { importAnnulable, intactesDepuisImport, retablissement } from '@/lib/import/annulation';
import type { Contact } from '@/types/contact';
import type { ContactRow, Database } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Client = SupabaseClient<Database>;
type RouteParams = { params: Promise<{ importId: string }> };

const PAR_REQUETE = 200;

/** Tout ce qui peut pointer vers une fiche : une fiche utilisée n'est jamais retirée. */
const REFERENCES: readonly { table: string; colonne: string; filtre?: [string, string] }[] = [
  { table: 'contact_interactions', colonne: 'contact_id' },
  { table: 'voice_notes', colonne: 'contact_id' },
  { table: 'note_liens', colonne: 'entite_id', filtre: ['entite_type', 'contact'] },
  { table: 'biens', colonne: 'proprietaire_contact_id' },
  { table: 'visites', colonne: 'contact_id' },
  { table: 'offres', colonne: 'contact_id' },
  { table: 'promesses', colonne: 'contact_id' },
  { table: 'rendez_vous', colonne: 'contact_id' },
  { table: 'agency_estimations', colonne: 'contact_id' },
  { table: 'agency_alerts', colonne: 'contact_id' },
  { table: 'leads_portail', colonne: 'contact_id' },
];

function paquets<T>(items: readonly T[], taille = PAR_REQUETE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += taille) out.push(items.slice(i, i + taille));
  return out;
}

async function fichesUtilisees(supabase: Client, ids: readonly string[]): Promise<Set<string>> {
  const utilisees = new Set<string>();
  // Client non typé : ces tables ne sont pas toutes décrites dans `Database`.
  const db = supabase as unknown as SupabaseClient;
  for (const ref of REFERENCES) {
    for (const paquet of paquets(ids)) {
      let requete = db.from(ref.table).select(ref.colonne).in(ref.colonne, paquet);
      if (ref.filtre) requete = requete.eq(ref.filtre[0], ref.filtre[1]);
      const { data, error } = await requete;
      // Table absente d'une base en retard : rien n'y pointe.
      if (error) continue;
      for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
        const id = row[ref.colonne];
        if (id) utilisees.add(id);
      }
    }
  }
  return utilisees;
}

/**
 * Annuler un import : retirer les fiches créées que personne n'a touchées,
 * remettre les fiches complétées comme avant. Ce qui a servi depuis reste.
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { importId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: imp, error } = await supabase
    .from('contact_imports')
    .select('id, created_at, termine_le, annule_le, completions')
    .eq('id', importId)
    .eq('agency_id', agency.id)
    .eq('created_by', profile.id)
    .maybeSingle();

  if (error || !imp) {
    return NextResponse.json({ error: 'Import introuvable' }, { status: 404 });
  }
  if (imp.annule_le) {
    return NextResponse.json({ error: 'Cet import est déjà annulé' }, { status: 409 });
  }
  if (!importAnnulable(imp)) {
    return NextResponse.json({ error: 'Un import ne s’annule que pendant 7 jours' }, { status: 410 });
  }

  // Fermé d'abord : un lot encore en route ne peut plus s'y ajouter.
  await supabase.from('contact_imports').update({ annule_le: new Date().toISOString() }).eq('id', importId);

  const { data: creesRows, error: lectureError } = await supabase
    .from('contacts')
    .select('id, updated_at')
    .eq('agency_id', agency.id)
    .eq('import_id', importId)
    .limit(20_000);
  if (lectureError) {
    console.error('[contacts/import] annulation, lecture', lectureError);
    await supabase.from('contact_imports').update({ annule_le: null }).eq('id', importId);
    return NextResponse.json({ error: 'Annulation impossible' }, { status: 500 });
  }

  const crees = (creesRows ?? []) as { id: string; updated_at: string }[];
  const intactes = intactesDepuisImport(crees, imp.termine_le);
  const utilisees = await fichesUtilisees(supabase, intactes);
  const aRetirer = intactes.filter((id) => !utilisees.has(id));

  const supprimes: string[] = [];
  for (const paquet of paquets(aRetirer)) {
    const { error: suppression } = await supabase
      .from('contacts')
      .delete()
      .in('id', paquet)
      .eq('agency_id', agency.id)
      .eq('import_id', importId);
    if (suppression) console.error('[contacts/import] annulation, suppression', suppression);
    else supprimes.push(...paquet);
  }

  const retablis: Contact[] = [];
  const completions = imp.completions ?? [];
  for (const paquet of paquets(completions)) {
    const { data } = await withContactsSelect((sel) =>
      supabase
        .from('contacts')
        .select(sel)
        .in(
          'id',
          paquet.map((c) => c.id),
        ),
    );
    const actuels = new Map(((data ?? []) as unknown as ContactRow[]).map((r) => [r.id, r]));
    for (const completion of paquet) {
      const actuel = actuels.get(completion.id);
      if (!actuel) continue;
      const patch = retablissement(actuel as unknown as Record<string, unknown>, completion);
      if (!patch) continue;
      const { data: remis, error: ecriture } = await updateContactRow(
        supabase,
        { contactId: completion.id, agencyId: agency.id },
        patch as Partial<ContactRow>,
      );
      if (ecriture || !remis) {
        console.error('[contacts/import] annulation, rétablissement', ecriture);
        continue;
      }
      retablis.push(mapDbContactToContact(remis as unknown as ContactRow));
    }
  }

  return NextResponse.json({
    supprimes,
    conserves: crees.length - supprimes.length,
    retablis,
  });
}
