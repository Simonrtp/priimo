import { NextResponse } from 'next/server';
import { assignmentMeta, parseAssigneeId } from '@/lib/agency/assignees';
import { canManageContact, canSeeContact, viewerFromProfile } from '@/lib/agency/visibility';
import { getServerUser } from '@/lib/auth/getServerUser';
import { parseContactInput } from '@/lib/contact-input';
import { colonnesDepuisChamps } from '@/lib/contacts/modification';
import { fetchMembersOfMyAgency, memberIdSet } from '@/lib/queries/agency-members';
import { fetchContactById, mapDbContactToContact, updateContactRow } from '@/lib/queries/contacts';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { effacerDicteesDuContact } from '@/lib/rgpd/effacement';
import { notifierContactTransfere } from '@/lib/notifications/evenements';
import type { ContactRow } from '@/types/database';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { contactId } = await ctx.params;
  if (!contactId) return NextResponse.json({ error: 'Contact inconnu' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const existing = await fetchContactById(supabase, contactId);
  const viewer = viewerFromProfile(profile);
  if (!existing || !canSeeContact(viewer, existing)) {
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 });
  }

  return NextResponse.json({ contact: existing });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { contactId } = await ctx.params;
  if (!contactId) return NextResponse.json({ error: 'Contact inconnu' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const existing = await fetchContactById(supabase, contactId);
  const viewer = viewerFromProfile(profile);
  if (!existing || !canSeeContact(viewer, existing)) {
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 });
  }

  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const visibiliteDemandee =
    raw.visibilite === 'privee' || raw.visibilite === 'agence' ? raw.visibilite : null;
  const changeVisibilite = visibiliteDemandee !== null && visibiliteDemandee !== (existing.visibilite ?? 'privee');
  const changeTitulaire =
    Object.prototype.hasOwnProperty.call(raw, 'assignedTo') && (raw.assignedTo ?? null) !== existing.assignedTo;
  // Un collègue complète une fiche partagée ; la rendre privée ou la confier
  // à quelqu'un d'autre reste au titulaire et à la direction.
  if ((changeVisibilite || changeTitulaire) && !canManageContact(viewer, existing)) {
    return NextResponse.json(
      { error: 'Seul le titulaire de la fiche ou la direction peut changer son partage ou son suivi.' },
      { status: 403 },
    );
  }
  const hasCoreFields = 'firstName' in raw || 'lastName' in raw || 'type' in raw;
  const relanceProvided = Object.prototype.hasOwnProperty.call(raw, 'recontacterLe');
  const parsed = hasCoreFields ? parseContactInput(body) : null;
  if (parsed && !parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const membersNeeded =
    typeof raw.assignedTo === 'string' &&
    raw.assignedTo.length > 0 &&
    raw.assignedTo !== profile.id;
  const members = membersNeeded
    ? await fetchMembersOfMyAgency(agency.id, memberships)
    : [];
  const assigned = parseAssigneeId(
    raw.assignedTo,
    membersNeeded ? memberIdSet(members) : new Set([profile.id]),
  );
  if (assigned.provided && 'invalid' in assigned) {
    return NextResponse.json(
      { error: "Cette personne n'appartient pas à l'agence" },
      { status: 400 },
    );
  }

  if (
    !parsed &&
    !(assigned.provided && !('invalid' in assigned)) &&
    !relanceProvided &&
    visibiliteDemandee === null
  ) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const update: Partial<ContactRow> = {};
  if (parsed?.ok) {
    Object.assign(update, await colonnesDepuisChamps(parsed.fields, raw, existing));
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'numeroCommuniqueParLaPersonne')) {
    update.numero_communique_par_la_personne = raw.numeroCommuniqueParLaPersonne === true;
  }
  if (relanceProvided && !parsed) {
    if (raw.recontacterLe === null || raw.recontacterLe === '') {
      update.recontacter_le = null;
    } else if (
      typeof raw.recontacterLe === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(raw.recontacterLe.trim())
    ) {
      update.recontacter_le = raw.recontacterLe.trim();
    } else {
      return NextResponse.json({ error: "La date de relance n'est pas valide" }, { status: 400 });
    }
  }
  if (assigned.provided && !('invalid' in assigned) && changeTitulaire) {
    Object.assign(update, assignmentMeta(assigned.id, profile.id));
  }
  if (visibiliteDemandee !== null) update.visibilite = visibiliteDemandee;

  // Une colonne récente (rôles, numéro communiqué, partage) absente de la base est
  // écartée de l'écriture : le reste de la fiche s'enregistre quand même.
  const { data, error } = await updateContactRow(supabase, { contactId, agencyId: agency.id }, update);

  if (error || !data) {
    console.error('[contacts] mise à jour', error);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  const contact = mapDbContactToContact(data as unknown as ContactRow);
  const nouvelAssigné = assigned.provided && !('invalid' in assigned) ? assigned.id : undefined;
  if (nouvelAssigné && nouvelAssigné !== existing.assignedTo) {
    const nom = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
    void notifierContactTransfere({
      agencyId: agency.id,
      destinataireId: nouvelAssigné,
      actorId: profile.id,
      contactId,
      nom: nom || 'Fiche transmise',
    }).catch((err) => console.error('[notifications] contact_transfere', err));
  }

  return NextResponse.json({ contact });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { contactId } = await ctx.params;
  if (!contactId) return NextResponse.json({ error: 'Contact inconnu' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const existing = await fetchContactById(supabase, contactId);
  const viewer = viewerFromProfile(profile);
  if (!existing || !canSeeContact(viewer, existing)) {
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 });
  }
  if (!canManageContact(viewer, existing)) {
    return NextResponse.json(
      { error: 'Seul le titulaire de la fiche ou la direction peut la supprimer.' },
      { status: 403 },
    );
  }

  // Avant la suppression : ensuite, plus rien ne dit quelles dictées le nommaient.
  try {
    await effacerDicteesDuContact(createSupabaseAdminClient(), agency.id, contactId);
  } catch (err) {
    console.error('[contacts] effacement des dictées', err);
    return NextResponse.json(
      { error: 'Les notes vocales de ce contact n’ont pas pu être effacées. Réessayez.' },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .eq('agency_id', agency.id);

  if (error) {
    console.error('[contacts] suppression', error);
    return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
