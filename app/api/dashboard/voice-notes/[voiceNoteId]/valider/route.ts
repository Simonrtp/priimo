import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assignmentMeta } from '@/lib/agency/assignees';
import { fetchMembersOfMyAgency, memberIdSet } from '@/lib/queries/agency-members';
import { invaliderAccueilEtProspection, invaliderNotesAccueil } from '@/lib/cache/dashboard';
import { creneauAction } from '@/lib/notes/propositions';
import { parseIsoDateOnly } from '@/lib/notes/date-relative';
import { retirerFinDeNote } from '@/lib/voice/fin-de-note';
import { minutesEvitees } from '@/lib/notes/temps-gagne';
import { enregistrerRappel } from '@/lib/notes/rappels';
import type {
  NoteLienConfianceDb,
  NoteLienEntiteDb,
  RendezVousTypeDb,
  VisiteInteretDb,
  VoiceNoteRow,
  VoiceNoteVisibiliteDb,
} from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ENTITES: readonly NoteLienEntiteDb[] = ['contact', 'bien', 'lead', 'immeuble', 'parcelle'];
const CONFIANCES: readonly NoteLienConfianceDb[] = ['certain', 'probable'];
const RDV_TYPES: readonly RendezVousTypeDb[] = ['visite', 'estimation', 'signature', 'autre'];
const INTERETS: readonly VisiteInteretDb[] = ['aucun', 'tiede', 'chaud', 'offre'];
const STATUTS_MANDAT = ['mandat_simple', 'mandat_exclusif', 'compromis', 'vendu'] as const;
const SOURCES = ['proprietaire', 'gardien', 'voisin', 'tiers', 'agent'] as const;

type Obj = Record<string, unknown>;

const str = (v: unknown, max = 500): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
const int = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? Math.round(v) : null;
const liste = (v: unknown): Obj[] =>
  Array.isArray(v) ? v.filter((x): x is Obj => Boolean(x) && typeof x === 'object').slice(0, 20) : [];

/**
 * Valide une dictée en un seul appel : rattachements, actions (promesses,
 * rendez-vous, visites), mises à jour de biens, recherche d'acquéreur, étape du
 * prospect, puis clôture de la revue.
 *
 * Avant, le téléphone enchaînait une dizaine de requêtes : lent en 4G, et un
 * échec au milieu laissait la note à moitié rangée. Ici chaque étape est
 * rejouable — relancer après une coupure ne crée pas de doublon.
 */
export async function POST(req: Request, ctx: { params: Promise<{ voiceNoteId: string }> }) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { voiceNoteId } = await ctx.params;
  let body: Obj;
  try {
    body = (await req.json()) as Obj;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: note } = await admin
    .from('voice_notes')
    .select('id, agency_id, created_by, transcript, structured')
    .eq('id', voiceNoteId)
    .eq('agency_id', agency.id)
    .maybeSingle();
  if (!note || note.created_by !== profile.id) {
    return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  }

  const members = await fetchMembersOfMyAgency(agency.id, memberships);
  const membres = memberIdSet(members);
  const membre = (v: unknown): string | null => (typeof v === 'string' && membres.has(v) ? v : null);

  // Tout identifiant venu du téléphone est revérifié : client admin, pas de RLS.
  const idsDe = async (table: 'contacts' | 'biens' | 'leads', ids: (string | null)[]) => {
    const uniques = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    if (uniques.length === 0) return new Set<string>();
    const { data } = await admin.from(table).select('id').eq('agency_id', agency.id).in('id', uniques);
    return new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
  };

  const liens = liste(body.liens);
  const actions = liste(body.actions);
  const misesAJour = liste(body.misesAJour);
  const recherche = body.recherche && typeof body.recherche === 'object' ? (body.recherche as Obj) : null;
  const prospect = body.prospect && typeof body.prospect === 'object' ? (body.prospect as Obj) : null;

  const [contactsOk, biensOk, leadsOk] = await Promise.all([
    idsDe('contacts', [
      ...liens.filter((l) => l.entiteType === 'contact').map((l) => str(l.entiteId)),
      ...actions.map((a) => str(a.contactId)),
      recherche ? str(recherche.contactId) : null,
    ]),
    idsDe('biens', [
      ...liens.filter((l) => l.entiteType === 'bien').map((l) => str(l.entiteId)),
      ...actions.map((a) => str(a.bienId)),
      ...misesAJour.map((m) => str(m.bienId)),
    ]),
    idsDe('leads', [
      ...liens.filter((l) => l.entiteType === 'lead').map((l) => str(l.entiteId)),
      prospect ? str(prospect.leadId) : null,
    ]),
  ]);
  const verifie = (type: NoteLienEntiteDb, id: string | null): string | null => {
    if (!id) return null;
    if (type === 'contact') return contactsOk.has(id) ? id : null;
    if (type === 'bien') return biensOk.has(id) ? id : null;
    if (type === 'lead') return leadsOk.has(id) ? id : null;
    return id; // immeuble (BAN) et parcelle : identifiants publics, sans fiche.
  };

  const bilan = { liens: 0, promesses: 0, rendezVous: 0, visites: 0, misesAJour: 0, recherche: false, prospect: false };
  const echecs: string[] = [];

  /* ------------------------------------------------------------ Rattachements */
  let premierContact: string | null = null;
  for (const l of liens) {
    const type = l.entiteType as NoteLienEntiteDb;
    if (!ENTITES.includes(type)) continue;
    const id = verifie(type, str(l.entiteId, 120));
    if (!id) continue;
    const confiance = CONFIANCES.includes(l.confiance as NoteLienConfianceDb)
      ? (l.confiance as NoteLienConfianceDb)
      : 'certain';
    const { error } = await admin.from('note_liens').upsert(
      {
        note_id: voiceNoteId,
        agency_id: agency.id,
        entite_type: type,
        entite_id: id,
        confiance,
        cree_par: 'agent',
      },
      { onConflict: 'note_id,entite_type,entite_id' },
    );
    if (error) echecs.push('lien');
    else {
      bilan.liens += 1;
      if (type === 'contact' && !premierContact) premierContact = id;
    }
  }

  /* ------------------------------------------------------------------ Actions */
  for (const a of actions) {
    const type = str(a.type, 20);
    const intitule = str(a.intitule, 200);
    const date = parseIsoDateOnly(a.date);
    if (!type || !intitule || !date) continue;
    const contactId = verifie('contact', str(a.contactId));
    const assignee = membre(a.assignedTo) ?? profile.id;

    if (type === 'rappel' || type === 'tache') {
      try {
        await enregistrerRappel(admin, agency.id, voiceNoteId, {
          intitule,
          date,
          heure: str(a.heure, 5),
          contactId,
          profileId: assignee,
        });
        // Déjà créé par la lecture automatique : il compte quand même dans le bilan.
        bilan.promesses += 1;
      } catch {
        echecs.push('promesse');
      }
    } else if (type === 'rdv') {
      const { debut, fin } = creneauAction({ date, heure: str(a.heure, 5) });
      const { data: deja } = await admin
        .from('rendez_vous')
        .select('id')
        .eq('agency_id', agency.id)
        .eq('profile_id', assignee)
        .eq('debut', debut)
        .eq('cree_par', 'dictee')
        .maybeSingle();
      if (deja) continue;
      const rdvType = RDV_TYPES.includes(a.rdvType as RendezVousTypeDb) ? (a.rdvType as RendezVousTypeDb) : 'autre';
      const { error } = await admin.from('rendez_vous').insert({
        agency_id: agency.id,
        profile_id: assignee,
        contact_id: contactId,
        bien_id: verifie('bien', str(a.bienId)),
        debut,
        fin,
        type: rdvType,
        lieu: str(a.lieu, 200) ?? intitule,
        cree_par: 'dictee',
      });
      if (error) echecs.push('rendez-vous');
      else bilan.rendezVous += 1;
    } else if (type === 'visite_faite') {
      const bienId = verifie('bien', str(a.bienId));
      // Une visite se range sous un bien : sans bien, elle reste dans la note.
      if (!bienId) continue;
      const { debut } = creneauAction({ date, heure: str(a.heure, 5) });
      const { error } = await admin.from('visites').insert({
        agency_id: agency.id,
        bien_id: bienId,
        contact_id: contactId,
        profile_id: profile.id,
        date_visite: debut,
        retour: str(a.retour, 2000),
        interet: INTERETS.includes(a.interet as VisiteInteretDb) ? (a.interet as VisiteInteretDb) : null,
      });
      if (error) echecs.push('visite');
      else bilan.visites += 1;
    }
  }

  /* ------------------------------------------------------- Mises à jour biens */
  for (const m of misesAJour) {
    const bienId = verifie('bien', str(m.bienId));
    if (!bienId) continue;
    if (m.champ === 'prix') {
      const prix = int(m.valeur, 100_000_000);
      if (!prix) continue;
      const { data: bien } = await admin
        .from('biens')
        .select('price, prix_initial')
        .eq('id', bienId)
        .eq('agency_id', agency.id)
        .maybeSingle();
      const avant = bien?.price != null ? Number(bien.price) : null;
      const { error } = await admin
        .from('biens')
        .update({
          price: prix,
          // Le premier prix affiché est gardé : c'est lui qui mesure les baisses.
          ...(bien && bien.prix_initial == null && avant != null ? { prix_initial: avant } : {}),
          ...(avant != null && prix < avant
            ? { derniere_baisse_le: new Date().toISOString().slice(0, 10) }
            : {}),
        })
        .eq('id', bienId)
        .eq('agency_id', agency.id);
      if (error) echecs.push('prix');
      else bilan.misesAJour += 1;
    } else if (m.champ === 'statut_mandat') {
      const statut = STATUTS_MANDAT.find((s) => s === m.valeur);
      if (!statut) continue;
      const signe = statut === 'mandat_simple' || statut === 'mandat_exclusif';
      const { error } = await admin
        .from('biens')
        .update({
          mandat_statut: statut,
          ...(signe
            ? {
                mandat_type: statut === 'mandat_exclusif' ? 'exclusif' : 'simple',
                mandat_signe_le: new Date().toISOString().slice(0, 10),
              }
            : {}),
        })
        .eq('id', bienId)
        .eq('agency_id', agency.id);
      if (error) echecs.push('mandat');
      else bilan.misesAJour += 1;
    }
  }

  /* ------------------------------------------------- Recherche d'un acquéreur */
  if (recherche) {
    const contactId = verifie('contact', str(recherche.contactId));
    if (contactId) {
      const codes = Array.isArray(recherche.codesPostaux)
        ? recherche.codesPostaux.filter((c): c is string => typeof c === 'string' && /^\d{5}$/.test(c))
        : [];
      const { data: actuel } = await admin
        .from('contacts')
        .select('contact_type, postal_codes')
        .eq('id', contactId)
        .maybeSingle();
      const connus = Array.isArray(actuel?.postal_codes) ? (actuel!.postal_codes as string[]) : [];
      const patch = {
        ...(int(recherche.budgetMin, 100_000_000) ? { budget_min: int(recherche.budgetMin, 100_000_000) } : {}),
        ...(int(recherche.budgetMax, 100_000_000) ? { budget_max: int(recherche.budgetMax, 100_000_000) } : {}),
        ...(int(recherche.surfaceMin, 100_000) ? { surface_min: int(recherche.surfaceMin, 100_000) } : {}),
        ...(int(recherche.roomsMin, 50) ? { rooms_min: int(recherche.roomsMin, 50) } : {}),
        ...(codes.length ? { postal_codes: [...new Set([...connus, ...codes])] } : {}),
        ...(actuel?.contact_type === 'autre' ? { contact_type: 'acquereur' as const } : {}),
      };
      if (Object.keys(patch).length > 0) {
        const { error } = await admin.from('contacts').update(patch).eq('id', contactId).eq('agency_id', agency.id);
        if (error) echecs.push('recherche');
        else bilan.recherche = true;
      }
    }
  }

  /* ------------------------------------------------------------ Prospect DPE */
  if (prospect) {
    const leadId = verifie('lead', str(prospect.leadId));
    const stageId = str(prospect.stageId, 64);
    if (leadId && stageId) {
      const { data: etape } = await admin
        .from('lead_stages')
        .select('id, type')
        .eq('id', stageId)
        .eq('agency_id', agency.id)
        .maybeSingle();
      if (etape) {
        const motif = str(prospect.motif, 200);
        const { error } = await admin
          .from('leads')
          .update({
            stage_id: etape.id,
            stage_changed_at: new Date().toISOString(),
            ...(etape.type === 'perdu' ? { lost_reason: motif ?? 'Dicté sur le terrain' } : { lost_reason: null }),
          })
          .eq('id', leadId)
          .eq('agency_id', agency.id);
        if (error) echecs.push('prospect');
        else {
          bilan.prospect = true;
          await admin.from('note_liens').upsert(
            {
              note_id: voiceNoteId,
              agency_id: agency.id,
              entite_type: 'lead',
              entite_id: leadId,
              confiance: 'certain',
              cree_par: 'agent',
            },
            { onConflict: 'note_id,entite_type,entite_id' },
          );
        }
      }
    }
  }

  /* ------------------------------------------------------- Clôture de la note */
  const texte = typeof body.transcript === 'string' ? retirerFinDeNote(body.transcript) : null;
  const actuel = typeof note.transcript === 'string' ? note.transcript : '';
  const assignee = membre(body.assignedTo);
  const cloture: Partial<VoiceNoteRow> = {
    statut: 'revue',
    ...(body.visibilite === 'privee' || body.visibilite === 'agence'
      ? { visibilite: body.visibilite as VoiceNoteVisibiliteDb }
      : {}),
    ...(body.sourceInfo === null
      ? { source_info: null }
      : SOURCES.includes(body.sourceInfo as (typeof SOURCES)[number])
        ? { source_info: body.sourceInfo as (typeof SOURCES)[number] }
        : {}),
    ...(texte !== null && texte !== actuel ? { transcript: texte || null } : {}),
    ...(premierContact ? { contact_id: premierContact } : {}),
    ...(assignee ? assignmentMeta(assignee, profile.id) : {}),
  };
  let { error: clotureError } = await admin
    .from('voice_notes')
    .update(texte !== null && texte !== actuel && actuel ? { ...cloture, transcript_original: actuel } : cloture)
    .eq('id', voiceNoteId)
    .eq('agency_id', agency.id);
  if (clotureError) {
    // Base sans `transcript_original` (20260834) : on clôt quand même.
    ({ error: clotureError } = await admin
      .from('voice_notes')
      .update(cloture)
      .eq('id', voiceNoteId)
      .eq('agency_id', agency.id));
  }
  if (clotureError) {
    console.error('[voice] clôture', clotureError.message);
    return NextResponse.json({ error: "La note n'a pas pu être rangée", bilan }, { status: 500 });
  }

  invaliderNotesAccueil();
  if (bilan.promesses || bilan.rendezVous || bilan.prospect || bilan.misesAJour) invaliderAccueilEtProspection();

  const minutes = minutesEvitees({
    caracteres: (texte ?? actuel).length,
    contacts: liens.filter((l) => l.entiteType === 'contact').length + Number(body.contactsCrees ?? 0),
    actions: bilan.promesses + bilan.rendezVous + bilan.visites,
    misesAJour: bilan.misesAJour + Number(bilan.recherche) + Number(bilan.prospect),
  });

  return NextResponse.json({ ok: echecs.length === 0, bilan, echecs, minutesEvitees: minutes });
}
