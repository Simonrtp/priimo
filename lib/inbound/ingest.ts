/**
 * Ingestion d'un lead portail : contact acquéreur + rattachement bien + Accueil.
 * Ne stocke jamais le corps email.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { findDuplicates } from '@/lib/contacts/duplicates';
import { parsePortailEmail, type IncomingEmail, type ParsedPortailLead } from './parsers';

function splitNom(nom: string | null): { firstName: string; lastName: string } {
  const parts = (nom ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Acquéreur', lastName: 'Portail' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function sourceFromPortail(portail: string): string {
  switch (portail) {
    case 'seloger':
      return 'seloger';
    case 'bienici':
      return 'bienici';
    case 'logicimmo':
      return 'logicimmo';
    case 'leboncoin':
      return 'leboncoin';
    default:
      return 'portail';
  }
}

export type IngestResult = {
  leadPortailId: string;
  contactId: string | null;
  bienId: string | null;
  statut: string;
  rapprochementsHint: boolean;
};

export async function ingestPortailEmail(args: {
  admin: SupabaseClient;
  agencyId: string;
  email: IncomingEmail;
  /** Domaines déjà filtrés côté appelant (liste blanche). */
}): Promise<IngestResult> {
  const { admin, agencyId, email } = args;

  const { data: existing } = await admin
    .from('leads_portail')
    .select('id, contact_id, bien_id, statut')
    .eq('agency_id', agencyId)
    .eq('gmail_message_id', email.gmailMessageId)
    .maybeSingle();

  if (existing) {
    return {
      leadPortailId: existing.id,
      contactId: existing.contact_id,
      bienId: existing.bien_id,
      statut: existing.statut,
      rapprochementsHint: false,
    };
  }

  const parsed = parsePortailEmail(email);

  if (!parsed.ok) {
    const { data: row, error } = await admin
      .from('leads_portail')
      .insert({
        agency_id: agencyId,
        portail: parsed.portail === 'inconnu' ? 'autre' : parsed.portail,
        gmail_message_id: email.gmailMessageId,
        statut: 'a_traiter_main',
        parse_erreur: parsed.detail,
        demande_at: email.receivedAt,
      })
      .select('id')
      .single();
    if (error || !row) throw new Error(error?.message ?? 'insert leads_portail failed');
    await admin.from('diffusion_evenements').insert({
      agency_id: agencyId,
      sens: 'entree',
      kind: 'parse_echec',
      message: parsed.detail,
      payload: { gmail_message_id: email.gmailMessageId },
    });
    return {
      leadPortailId: row.id,
      contactId: null,
      bienId: null,
      statut: 'a_traiter_main',
      rapprochementsHint: false,
    };
  }

  const lead = parsed.lead;
  const { bienId, annonceId } = await resolveBienFromReference(admin, agencyId, lead);

  const { firstName, lastName } = splitNom(lead.nom);
  const contactId = await upsertAcquereur(admin, {
    agencyId,
    firstName,
    lastName,
    phone: lead.telephone,
    email: lead.email,
    summary: lead.message,
    source: sourceFromPortail(lead.portail),
    collecteProvenance: `email:${lead.portail}`,
    bienId,
  });

  const { data: row, error } = await admin
    .from('leads_portail')
    .insert({
      agency_id: agencyId,
      portail: lead.portail,
      gmail_message_id: email.gmailMessageId,
      contact_id: contactId,
      bien_id: bienId,
      annonce_id: annonceId,
      statut: 'importe',
      nom: lead.nom,
      telephone: lead.telephone,
      email: lead.email,
      reference_annonce: lead.referenceAnnonce,
      type_demande: lead.typeDemande,
      message_extrait: lead.message,
      demande_at: lead.demandeAt ?? email.receivedAt,
    })
    .select('id')
    .single();

  if (error || !row) throw new Error(error?.message ?? 'insert leads_portail failed');

  await admin.from('diffusion_evenements').insert({
    agency_id: agencyId,
    bien_id: bienId,
    annonce_id: annonceId,
    portail: lead.portail,
    sens: 'entree',
    kind: 'lead_importe',
    message: `Demande ${lead.portail} importée`,
    payload: {
      contact_id: contactId,
      reference: lead.referenceAnnonce,
      gmail_message_id: email.gmailMessageId,
    },
  });

  return {
    leadPortailId: row.id,
    contactId,
    bienId,
    statut: 'importe',
    rapprochementsHint: true,
  };
}

async function resolveBienFromReference(
  admin: SupabaseClient,
  agencyId: string,
  lead: ParsedPortailLead,
): Promise<{ bienId: string | null; annonceId: string | null }> {
  const ref = lead.referenceAnnonce?.trim();
  if (!ref) return { bienId: null, annonceId: null };

  const { data: byPortailRef } = await admin
    .from('diffusion_annonces')
    .select('id, bien_id')
    .eq('agency_id', agencyId)
    .eq('reference_portail', ref)
    .maybeSingle();

  if (byPortailRef) {
    return { bienId: byPortailRef.bien_id, annonceId: byPortailRef.id };
  }

  // Référence = id bien Priimo (export / noop).
  const { data: bien } = await admin
    .from('biens')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('id', ref)
    .maybeSingle();

  if (bien) return { bienId: bien.id, annonceId: null };
  return { bienId: null, annonceId: null };
}

async function upsertAcquereur(
  admin: SupabaseClient,
  args: {
    agencyId: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    summary: string | null;
    source: string;
    collecteProvenance: string;
    bienId: string | null;
  },
): Promise<string> {
  const { data: existingContacts } = await admin
    .from('contacts')
    .select('id, first_name, last_name, phone, email, doublon_de')
    .eq('agency_id', args.agencyId)
    .limit(500);

  const mapped = (existingContacts ?? []).map((c) => ({
    id: c.id,
    firstName: c.first_name ?? '',
    lastName: c.last_name ?? '',
    fullName: [c.first_name, c.last_name].filter(Boolean).join(' '),
    phone: c.phone,
    email: c.email,
  }));

  const dups = findDuplicates(
    {
      id: 'new',
      firstName: args.firstName,
      lastName: args.lastName,
      fullName: `${args.firstName} ${args.lastName}`.trim(),
      phone: args.phone,
      email: args.email,
    },
    mapped,
  );

  let assignedTo: string | null = null;
  if (args.bienId) {
    const { data: bien } = await admin
      .from('biens')
      .select('assigned_to, created_by')
      .eq('id', args.bienId)
      .maybeSingle();
    assignedTo = bien?.assigned_to ?? bien?.created_by ?? null;
  }

  const strong = dups.find((d) => d.strength === 'strong');
  if (strong) {
    await admin
      .from('contacts')
      .update({
        last_interaction_at: new Date().toISOString(),
        summary: args.summary,
        assigned_to: assignedTo,
        collecte_provenance: args.collecteProvenance,
        collecte_at: new Date().toISOString(),
      })
      .eq('id', strong.other.id);
    return strong.other.id;
  }

  const { data: inserted, error } = await admin
    .from('contacts')
    .insert({
      agency_id: args.agencyId,
      first_name: args.firstName,
      last_name: args.lastName || null,
      contact_type: 'acquereur',
      phone: args.phone,
      email: args.email,
      summary: args.summary,
      source: args.source,
      assigned_to: assignedTo,
      assigned_at: assignedTo ? new Date().toISOString() : null,
      last_interaction_at: new Date().toISOString(),
      collecte_provenance: args.collecteProvenance,
      collecte_at: new Date().toISOString(),
      collecte_base_legale: null,
      doublon_de: dups[0]?.other.id ?? null,
    })
    .select('id')
    .single();

  if (error || !inserted) throw new Error(error?.message ?? 'insert contact failed');
  return inserted.id;
}
