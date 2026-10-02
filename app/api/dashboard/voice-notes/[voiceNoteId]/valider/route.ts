import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assignmentMeta } from '@/lib/agency/assignees';
import { fetchMembersOfMyAgency, memberIdSet } from '@/lib/queries/agency-members';
import { invaliderAccueilEtProspection, invaliderNotesAccueil } from '@/lib/cache/dashboard';
import { creneauAction } from '@/lib/notes/propositions';
import { parseIsoDateOnly } from '@/lib/notes/date-relative';
import { retirerFinDeNote } from '@/lib/voice/fin-de-note';
import { minutesEvitees } from '@/lib/notes/temps-gagne';
import { enregistrerRappel } from '@/lib/notes/rappels';
import { creerContact } from '@/lib/contacts/creation';
import { colonnesDepuisChamps, completerContact } from '@/lib/contacts/modification';
import { parseContactInput } from '@/lib/contact-input';
import { canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { fetchContactById, fetchContactsDuplicateLite, updateContactRow } from '@/lib/queries/contacts';
import type { ContactType } from '@/types/contact';
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
const objet = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const ids = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, 64)).filter((x): x is string => Boolean(x)).slice(0, 5) : [];
const ROLES: readonly ContactType[] = ['vendeur', 'acquereur', 'locataire', 'gardien', 'commercant'];

/**
 * Range une dictée en un seul appel : contacts (création ou rattachement),
 * rattachements, actions (promesses, rendez-vous, visites), mises à jour de
 * biens, recherche d'acquéreur, étape du prospect, puis clôture.
 *
 * Le téléphone n'attend pas cette réponse : la fenêtre se ferme dès que
 * l'agent touche « Ranger », l'appel part en arrière-plan. Chaque étape est
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
  const personnes = liste(body.personnes);
  const aCreer = personnes.filter((p) => p.creer && typeof p.creer === 'object');
  const [{ data: note }, members, supabase] = await Promise.all([
    admin
      .from('voice_notes')
      .select('id, agency_id, created_by, transcript, structured')
      .eq('id', voiceNoteId)
      .eq('agency_id', agency.id)
      .maybeSingle(),
    fetchMembersOfMyAgency(agency.id, memberships),
    createSupabaseServerClient(),
  ]);
  if (!note || note.created_by !== profile.id) {
    return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  }

  const membres = memberIdSet(members);
  const membre = (v: unknown): string | null => (typeof v === 'string' && membres.has(v) ? v : null);
  const echecs: string[] = [];

  /* ---------------------------------------------------------------- Contacts */
  // Les personnes nouvelles d'abord : les actions et la recherche s'y rattachent.
  const contactParRef = new Map<string, string>();
  const existants = aCreer.length ? await fetchContactsDuplicateLite(supabase) : undefined;
  let contactsCrees = 0;
  for (const p of aCreer) {
    const ref = str(p.ref, 40);
    const r = await creerContact(
      { supabase, profile, agencyId: agency.id, memberships, existants },
      { ...(p.creer as Obj), source: 'vocal', voiceNoteId },
    );
    if (r.ok) {
      if (ref) contactParRef.set(ref, r.contact.id);
      if (!r.reused) contactsCrees += 1;
      else {
        // Une fiche identique existait : elle reçoit ce que la note apprend.
        const c = p.creer as Obj;
        const roles = [c.type, ...(Array.isArray(c.autresTypes) ? c.autresTypes : [])].filter(
          (x): x is ContactType => ROLES.includes(x as ContactType),
        );
        await completerContact(
          supabase,
          { contactId: r.contact.id, agencyId: agency.id },
          { roles, phone: str(c.phone, 40), email: str(c.email, 160), address: str(c.address, 240), banId: str(c.banId, 120) },
        ).catch(() => echecs.push('fiche'));
      }
    } else {
      echecs.push('contact');
    }
  }

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

  for (const p of personnes) {
    const ref = str(p.ref, 40);
    const id = str(p.contactId, 64);
    if (ref && id && !contactParRef.has(ref)) contactParRef.set(ref, id);
  }
  const contactDe = (o: Obj): string | null => {
    const ref = str(o.personneRef, 40);
    return (ref && contactParRef.get(ref)) || str(o.contactId, 64);
  };

  const [contactsOk, biensOk, leadsOk] = await Promise.all([
    idsDe('contacts', [
      ...contactParRef.values(),
      ...liens.filter((l) => l.entiteType === 'contact').map((l) => str(l.entiteId)),
      ...actions.map(contactDe),
      recherche ? contactDe(recherche) : null,
    ]),
    idsDe('biens', [
      ...liens.filter((l) => l.entiteType === 'bien').map((l) => str(l.entiteId)),
      ...actions.map((a) => str(a.bienId)),
      ...misesAJour.map((m) => str(m.bienId)),
      ...personnes.flatMap((p) => ids(p.proprietaireDe)),
    ]),
    idsDe('leads', [
      ...liens.filter((l) => l.entiteType === 'lead').map((l) => str(l.entiteId)),
      prospect ? str(prospect.leadId) : null,
      ...personnes.map((p) => str(p.leadId, 64)),
    ]),
  ]);
  const verifie = (type: NoteLienEntiteDb, id: string | null): string | null => {
    if (!id) return null;
    if (type === 'contact') return contactsOk.has(id) ? id : null;
    if (type === 'bien') return biensOk.has(id) ? id : null;
    if (type === 'lead') return leadsOk.has(id) ? id : null;
    return id; // immeuble (BAN) et parcelle : identifiants publics, sans fiche.
  };

  const bilan = {
    contacts: contactsCrees,
    liens: 0,
    promesses: 0,
    rendezVous: 0,
    visites: 0,
    misesAJour: 0,
    recherche: false,
    prospect: false,
  };

  /* ------------------------------------------------------------ Rattachements */
  // Les contacts existants reconnus dans la note, puis le reste, en une écriture.
  const lignes = new Map<string, { entite_type: NoteLienEntiteDb; entite_id: string; confiance: NoteLienConfianceDb }>();
  for (const p of personnes) {
    const id = verifie('contact', str(p.contactId, 64));
    if (id) {
      const confiance = p.confiance === 'probable' ? 'probable' : 'certain';
      lignes.set(`contact:${id}`, { entite_type: 'contact', entite_id: id, confiance });
    }
  }
  for (const l of liens) {
    const type = l.entiteType as NoteLienEntiteDb;
    if (!ENTITES.includes(type)) continue;
    const id = verifie(type, str(l.entiteId, 120));
    if (!id) continue;
    const confiance = CONFIANCES.includes(l.confiance as NoteLienConfianceDb)
      ? (l.confiance as NoteLienConfianceDb)
      : 'certain';
    lignes.set(`${type}:${id}`, { entite_type: type, entite_id: id, confiance });
  }
  if (lignes.size > 0) {
    const { error } = await admin.from('note_liens').upsert(
      [...lignes.values()].map((l) => ({
        ...l,
        note_id: voiceNoteId,
        agency_id: agency.id,
        cree_par: 'agent' as const,
      })),
      { onConflict: 'note_id,entite_type,entite_id' },
    );
    if (error) echecs.push('rattachement');
    else bilan.liens = lignes.size;
  }
  const premierContact =
    [...contactParRef.values()].find((id) => contactsOk.has(id)) ??
    [...lignes.values()].find((l) => l.entite_type === 'contact')?.entite_id ??
    null;

  /* ------------------------------------------------- Actions, fiches, prospect */
  const taches: Promise<void>[] = [];
  const viewer = viewerFromProfile(profile);

  // Les fiches que la note touche : corrigées par l'agent (maj) ou complétées
  // de ce que la dictée a appris (ajouts), puis leurs liens propres.
  for (const p of personnes) {
    const ref = str(p.ref, 40);
    const contactId = verifie('contact', (ref && contactParRef.get(ref)) || str(p.contactId, 64));
    if (!contactId) continue;
    const ficheIds = { contactId, agencyId: agency.id };
    const maj = objet(p.maj);
    const ajouts = objet(p.ajouts);

    if (maj && str(p.contactId, 64)) {
      taches.push(
        (async () => {
          const existing = await fetchContactById(supabase, contactId);
          if (!existing || !canSeeOwnedRecord(viewer, { assignedTo: existing.assignedTo, createdBy: existing.createdBy })) {
            return;
          }
          const parsed = parseContactInput(maj);
          if (!parsed.ok) {
            echecs.push('fiche');
            return;
          }
          const update = await colonnesDepuisChamps(parsed.fields, maj, existing);
          update.numero_communique_par_la_personne = parsed.fields.numeroCommuniqueParLaPersonne;
          const assigne = membre(maj.assignedTo);
          if (assigne && assigne !== existing.assignedTo) Object.assign(update, assignmentMeta(assigne, profile.id));
          const { error } = await updateContactRow(supabase, ficheIds, update);
          if (error) echecs.push('fiche');
        })(),
      );
    } else if (ajouts && str(p.contactId, 64)) {
      const roles = Array.isArray(ajouts.roles)
        ? ajouts.roles.filter((r): r is ContactType => ROLES.includes(r as ContactType))
        : [];
      taches.push(
        completerContact(supabase, ficheIds, {
          roles,
          phone: str(ajouts.phone, 40),
          email: str(ajouts.email, 160),
          address: str(ajouts.address, 240),
          banId: str(ajouts.banId, 120),
        }).then(
          () => undefined,
          () => {
            echecs.push('fiche');
          },
        ),
      );
    }

    // Un vendeur et le bien de la note : il en devient le propriétaire, si
    // personne ne l'est encore. On n'écrase jamais un propriétaire connu.
    for (const bienId of ids(p.proprietaireDe).map((b) => verifie('bien', b)).filter((b): b is string => Boolean(b))) {
      taches.push(
        (async () => {
          const { error } = await admin
            .from('biens')
            .update({ proprietaire_contact_id: contactId })
            .eq('id', bienId)
            .eq('agency_id', agency.id)
            .is('proprietaire_contact_id', null);
          if (error) echecs.push('proprietaire');
        })(),
      );
    }
    const leadId = verifie('lead', str(p.leadId, 64));
    if (leadId) {
      taches.push(
        (async () => {
          const { error } = await admin
            .from('contacts')
            .update({ lead_id: leadId })
            .eq('id', contactId)
            .eq('agency_id', agency.id)
            .is('lead_id', null);
          if (error) echecs.push('prospect');
        })(),
      );
    }
  }

  for (const a of actions) {
    const type = str(a.type, 20);
    const intitule = str(a.intitule, 200);
    const date = parseIsoDateOnly(a.date);
    if (!type || !intitule || !date) continue;
    const contactId = verifie('contact', contactDe(a)) ?? (type === 'rdv' ? null : premierContact);
    const assignee = membre(a.assignedTo) ?? profile.id;

    if (type === 'rappel' || type === 'tache') {
      taches.push(
        enregistrerRappel(admin, agency.id, voiceNoteId, {
          intitule,
          date,
          heure: str(a.heure, 5),
          contactId,
          profileId: assignee,
        }).then(
          () => {
            bilan.promesses += 1;
          },
          () => {
            echecs.push('rappel');
          },
        ),
      );
    } else if (type === 'rdv') {
      taches.push(
        (async () => {
          const { debut, fin } = creneauAction({ date, heure: str(a.heure, 5) });
          const { data: deja } = await admin
            .from('rendez_vous')
            .select('id')
            .eq('agency_id', agency.id)
            .eq('profile_id', assignee)
            .eq('debut', debut)
            .eq('cree_par', 'dictee')
            .maybeSingle();
          if (deja) return;
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
        })(),
      );
    } else if (type === 'visite_faite') {
      const bienId = verifie('bien', str(a.bienId));
      // Une visite se range sous un bien : sans bien, elle reste dans la note.
      if (!bienId) continue;
      taches.push(
        (async () => {
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
        })(),
      );
    }
  }

  for (const m of misesAJour) {
    const bienId = verifie('bien', str(m.bienId));
    if (!bienId) continue;
    if (m.champ === 'prix') {
      const prix = int(m.valeur, 100_000_000);
      if (!prix) continue;
      taches.push(
        (async () => {
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
              ...(avant != null && prix < avant ? { derniere_baisse_le: new Date().toISOString().slice(0, 10) } : {}),
            })
            .eq('id', bienId)
            .eq('agency_id', agency.id);
          if (error) echecs.push('prix');
          else bilan.misesAJour += 1;
        })(),
      );
    } else if (m.champ === 'statut_mandat') {
      const statut = STATUTS_MANDAT.find((s) => s === m.valeur);
      if (!statut) continue;
      const signe = statut === 'mandat_simple' || statut === 'mandat_exclusif';
      taches.push(
        (async () => {
          const { error } = await admin
            .from('biens')
            .update({
              mandat_statut: statut,
              ...(signe
                ? {
                    mandat_type: statut === 'mandat_exclusif' ? ('exclusif' as const) : ('simple' as const),
                    mandat_signe_le: new Date().toISOString().slice(0, 10),
                  }
                : {}),
            })
            .eq('id', bienId)
            .eq('agency_id', agency.id);
          if (error) echecs.push('mandat');
          else bilan.misesAJour += 1;
        })(),
      );
    }
  }

  // Recherche d'un acquéreur déjà connu (un contact créé l'a reçue à sa création).
  if (recherche) {
    const contactId = verifie('contact', contactDe(recherche));
    if (contactId) {
      taches.push(
        (async () => {
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
          if (Object.keys(patch).length === 0) return;
          const { error } = await admin.from('contacts').update(patch).eq('id', contactId).eq('agency_id', agency.id);
          if (error) echecs.push('recherche');
          else bilan.recherche = true;
        })(),
      );
    }
  }

  if (prospect) {
    const leadId = verifie('lead', str(prospect.leadId));
    const stageId = str(prospect.stageId, 64);
    if (leadId && stageId) {
      taches.push(
        (async () => {
          const { data: etape } = await admin
            .from('lead_stages')
            .select('id, type')
            .eq('id', stageId)
            .eq('agency_id', agency.id)
            .maybeSingle();
          if (!etape) return;
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
          if (error) {
            echecs.push('prospect');
            return;
          }
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
        })(),
      );
    }
  }

  await Promise.all(taches);

  /* ------------------------------------------------------- Clôture de la note */
  const texte = typeof body.transcript === 'string' ? retirerFinDeNote(body.transcript) : null;
  const actuel = typeof note.transcript === 'string' ? note.transcript : '';
  const assignee = membre(body.assignedTo);
  // Les constats gardés par l'agent restent avec la note : ils décrivent l'adresse.
  const observations = Array.isArray(body.observations)
    ? body.observations.map((o) => str(o, 140)).filter((o): o is string => Boolean(o)).slice(0, 6)
    : null;
  const structured = objet(note.structured) ?? {};
  const cloture: Partial<VoiceNoteRow> = {
    statut: 'revue',
    ...(observations ? { structured: { ...structured, observations } } : {}),
    ...(body.visibilite === 'privee' || body.visibilite === 'agence'
      ? { visibilite: body.visibilite as VoiceNoteVisibiliteDb }
      : {}),
    ...(body.sourceInfo === null
      ? { source_info: null }
      : SOURCES.includes(body.sourceInfo as (typeof SOURCES)[number])
        ? { source_info: body.sourceInfo as (typeof SOURCES)[number] }
        : {}),
    ...(texte && texte !== actuel ? { transcript: texte } : {}),
    ...(premierContact ? { contact_id: premierContact } : {}),
    ...(assignee ? assignmentMeta(assignee, profile.id) : {}),
  };
  let { error: clotureError } = await admin
    .from('voice_notes')
    .update(texte && texte !== actuel && actuel ? { ...cloture, transcript_original: actuel } : cloture)
    .eq('id', voiceNoteId)
    .eq('agency_id', agency.id);
  if (clotureError) {
    // Base sans `transcript_original` (20260834) : on clôt quand même.
    ({ error: clotureError } = await admin.from('voice_notes').update(cloture).eq('id', voiceNoteId).eq('agency_id', agency.id));
  }
  if (clotureError) {
    console.error('[voice] clôture', clotureError.message);
    return NextResponse.json({ error: "La note n'a pas pu être rangée", bilan }, { status: 500 });
  }

  // Un collègue cité reprend la main : la note s'ajoute à l'historique du contact
  // existant (un contact créé l'a déjà reçue à sa création).
  if (assignee && premierContact && contactsCrees === 0 && (texte || actuel)) {
    const { error } = await supabase.from('contact_interactions').insert({
      agency_id: agency.id,
      contact_id: premierContact,
      author_id: profile.id,
      kind: 'vocal',
      body: texte || actuel,
      voice_note_id: voiceNoteId,
      ...assignmentMeta(assignee, profile.id),
    });
    if (error) console.error('[voice] historique du contact', error.message);
  }

  invaliderNotesAccueil();
  if (bilan.promesses || bilan.rendezVous || bilan.prospect || bilan.misesAJour || contactsCrees) {
    invaliderAccueilEtProspection();
  }

  const minutes = minutesEvitees({
    caracteres: (texte ?? actuel).length,
    contacts: personnes.length,
    actions: bilan.promesses + bilan.rendezVous + bilan.visites,
    misesAJour: bilan.misesAJour + Number(bilan.recherche) + Number(bilan.prospect),
  });

  return NextResponse.json({ ok: echecs.length === 0, bilan, echecs, minutesEvitees: minutes, contactId: premierContact });
}
