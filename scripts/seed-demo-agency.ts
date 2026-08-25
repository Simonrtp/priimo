/**
 * Jeu de données scénarisé — agence test 75020 uniquement.
 *
 *   npx tsx scripts/seed-demo-agency.ts
 *   npx tsx scripts/seed-demo-agency.ts --purge
 *
 * Prérequis : migration 20260827_demo_flag.sql appliquée.
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEMO_AGENCY_ID,
  DEMO_DIRECTOR_PROFILE_ID,
  DEMO_NEGOTIATORS,
  DEMO_PASSWORD,
  FICTION_PHONES,
  FIRST_NAMES,
  LAST_NAMES,
  NOTE_TRANSCRIPTS,
  PROTECTED_AGENCY_PREFIXES,
  type DemoNegotiatorKey,
} from '../lib/demo/constants';
import {
  cetApresMidiParis,
  daysAgoGlissant,
  isoDateDays,
  isoDaysHours,
  mandatSignePourExpirationDans,
  priceFromSurfaceM2,
  isoDateFromBase,
} from '../lib/demo/dates';
import { createSupabaseAdminClient } from '../lib/supabase/admin';

const BATCH = 200;
const SOURCES = ['proprietaire', 'gardien', 'voisin', 'tiers', 'agent'] as const;

type LeadRow = {
  id: string;
  address: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  ban_id: string | null;
  adresse_normalisee: string | null;
  status: string;
  delivered_at: string | null;
  created_at: string;
  assigned_to: string | null;
};

type NegotiatorIds = Record<DemoNegotiatorKey, string>;

type HotBuilding = {
  banId: string;
  address: string;
  entities: number;
};

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i === -1) continue;
      const key = line.slice(0, i);
      const val = line.slice(i + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

function assertTargetAgency(agencyId: string) {
  if (agencyId !== DEMO_AGENCY_ID) {
    throw new Error(`Refus : agency_id ${agencyId} ≠ agence test ${DEMO_AGENCY_ID}`);
  }
  for (const prefix of PROTECTED_AGENCY_PREFIXES) {
    if (agencyId.startsWith(prefix) && agencyId !== DEMO_AGENCY_ID) {
      throw new Error(`Refus : agence protégée (préfixe ${prefix})`);
    }
  }
}

async function assertMigrationApplied(admin: SupabaseClient) {
  const probe = await admin.from('contacts').select('is_demo').limit(1);
  if (probe.error?.code === 'PGRST204' || probe.error?.message?.includes('is_demo')) {
    throw new Error(
      'Colonne is_demo absente — appliquez supabase/migrations/20260827_demo_flag.sql avant le seed.',
    );
  }
}

async function insertBatches(
  admin: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<number> {
  if (rows.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await admin.from(table).insert(chunk);
    if (error) {
      console.error(`Échec insert ${table} (lot ${Math.floor(i / BATCH) + 1}) :`, error.message);
      throw error;
    }
    inserted += chunk.length;
    await new Promise((r) => setTimeout(r, 40));
  }
  const { count, error: countErr } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('agency_id', DEMO_AGENCY_ID)
    .eq('is_demo', true);
  if (countErr) console.warn(`  count ${table} :`, countErr.message);
  else console.log(`  ${table} : ${inserted} insérés (total démo en base ≈ ${count ?? '?'})`);
  return inserted;
}

async function purgeDemo(admin: SupabaseClient) {
  console.log('Purge des données démo existantes…');

  const { data: snaps } = await admin
    .from('demo_lead_snapshots')
    .select('lead_id, snapshot')
    .eq('agency_id', DEMO_AGENCY_ID);
  let restored = 0;
  for (const row of snaps ?? []) {
    const { error } = await admin
      .from('leads')
      .update(row.snapshot as Record<string, unknown>)
      .eq('id', row.lead_id);
    if (!error) restored += 1;
  }
  await admin.from('demo_lead_snapshots').delete().eq('agency_id', DEMO_AGENCY_ID);
  console.log(`  leads restaurés : ${restored}`);

  const order = [
    'note_liens',
    'agency_alerts',
    'contact_interactions',
    'voice_notes',
    'rendez_vous',
    'promesses',
    'offres',
    'visites',
    'biens',
    'contacts',
  ] as const;

  for (const table of order) {
    const { data, error } = await admin
      .from(table)
      .delete()
      .eq('agency_id', DEMO_AGENCY_ID)
      .eq('is_demo', true)
      .select('id');
    if (error) console.warn(`  purge ${table} :`, error.message);
    else console.log(`  ${table} : ${data?.length ?? 0} supprimés`);
  }

  const { data: profiles } = await admin.from('profiles').select('id').eq('is_demo', true);
  let users = 0;
  for (const p of profiles ?? []) {
    const { data: links } = await admin
      .from('profile_agencies')
      .select('agency_id')
      .eq('profile_id', p.id)
      .eq('agency_id', DEMO_AGENCY_ID);
    if (!links?.length) continue;
    await admin.auth.admin.deleteUser(p.id);
    users += 1;
  }
  console.log(`  profils démo supprimés : ${users}`);
}

async function ensureNegotiator(
  admin: SupabaseClient,
  spec: (typeof DEMO_NEGOTIATORS)[number],
): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const users = (list?.users ?? []) as Array<{ id: string; email?: string }>;
  const found = users.find((u) => u.email === spec.email);
  let userId = found?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { is_demo: true, demo_role: spec.key },
    });
    if (error) throw new Error(`auth ${spec.email}: ${error.message}`);
    userId = data.user.id;
  }

  await admin.from('profiles').upsert(
    {
      id: userId,
      first_name: spec.firstName,
      last_name: spec.lastName,
      phone: spec.phone,
      active_agency_id: null,
      is_demo: true,
    },
    { onConflict: 'id' },
  );

  await admin.from('profile_agencies').upsert(
    { profile_id: userId, agency_id: DEMO_AGENCY_ID, role: 'collaborateur' },
    { onConflict: 'profile_id,agency_id' },
  );

  await admin.from('profiles').update({ active_agency_id: DEMO_AGENCY_ID }).eq('id', userId);

  return userId;
}

async function ensureTeam(admin: SupabaseClient): Promise<NegotiatorIds> {
  const ids = {} as NegotiatorIds;
  for (const spec of DEMO_NEGOTIATORS) {
    ids[spec.key] = await ensureNegotiator(admin, spec);
  }
  return ids;
}

async function verifyDirector(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('profile_agencies')
    .select('role')
    .eq('profile_id', DEMO_DIRECTOR_PROFILE_ID)
    .eq('agency_id', DEMO_AGENCY_ID)
    .maybeSingle();
  if (error || !data) {
    throw new Error(
      `Profil directeur ${DEMO_DIRECTOR_PROFILE_ID} introuvable sur l'agence test.`,
    );
  }
}

function pickName(i: number) {
  return {
    first: FIRST_NAMES[i % FIRST_NAMES.length]!,
    last: LAST_NAMES[(i * 7) % LAST_NAMES.length]!,
  };
}

function pickPhone(i: number) {
  return FICTION_PHONES[i % FICTION_PHONES.length]!;
}

function pickNoteAuthor(i: number, team: NegotiatorIds): string {
  const r = i % 100;
  if (r < 40) return team.camille;
  if (r < 65) return team.thomas;
  if (r < 83) return team.lea;
  if (r < 93) return team.bruno;
  return DEMO_DIRECTOR_PROFILE_ID;
}

function leadGeoFields(lead: LeadRow | undefined) {
  return {
    lead_id: lead?.id ?? null,
    ban_id: lead?.ban_id ?? null,
    latitude: lead?.latitude ?? null,
    longitude: lead?.longitude ?? null,
    adresse_normalisee: lead?.adresse_normalisee ?? lead?.address ?? null,
  };
}

function bienTimestamps(now: Date, daysAgo: number) {
  const ts = isoDaysHours(now, -daysAgo);
  return { created_at: ts, updated_at: ts };
}

async function fetchLeads(admin: SupabaseClient): Promise<LeadRow[]> {
  const { data, error } = await admin
    .from('leads')
    .select(
      'id, address, postal_code, latitude, longitude, ban_id, adresse_normalisee, status, delivered_at, created_at, assigned_to',
    )
    .eq('agency_id', DEMO_AGENCY_ID)
    .not('ban_id', 'is', null)
    .not('latitude', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadRow[];
}

async function snapshotLead(
  admin: SupabaseClient,
  lead: LeadRow,
  patch: Record<string, unknown>,
) {
  await admin.from('demo_lead_snapshots').upsert({
    lead_id: lead.id,
    agency_id: DEMO_AGENCY_ID,
    snapshot: {
      status: lead.status,
      delivered_at: lead.delivered_at,
      assigned_to: lead.assigned_to,
    },
  });
  await admin.from('leads').update(patch).eq('id', lead.id).eq('agency_id', DEMO_AGENCY_ID);
}

function pickHotBuildings(leads: LeadRow[], n = 8): LeadRow[] {
  const byBan = new Map<string, LeadRow>();
  for (const l of leads) {
    if (l.ban_id && !byBan.has(l.ban_id)) byBan.set(l.ban_id, l);
  }
  return Array.from(byBan.values()).slice(0, n);
}

function closestLeadPair(pool: LeadRow[]): LeadRow[] {
  let bestI = 0;
  let bestJ = 1;
  let bestD = Infinity;
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const a = pool[i]!;
      const b = pool[j]!;
      if (a.latitude == null || b.latitude == null) continue;
      const d =
        (a.latitude - b.latitude) ** 2 +
        (a.longitude! - b.longitude!) ** 2;
      if (d < bestD) {
        bestD = d;
        bestI = i;
        bestJ = j;
      }
    }
  }
  return [pool[bestI]!, pool[bestJ]!];
}

async function main() {
  loadEnvLocal();
  assertTargetAgency(DEMO_AGENCY_ID);
  const doPurge = process.argv.includes('--purge');
  const admin = createSupabaseAdminClient();
  await assertMigrationApplied(admin);
  const now = new Date();

  if (doPurge) await purgeDemo(admin);

  await verifyDirector(admin);
  const team = await ensureTeam(admin);
  console.log('Équipe fictive prête.');

  const leads = await fetchLeads(admin);
  if (leads.length < 20) {
    throw new Error(`Pas assez de leads géolocalisés (${leads.length}) sur l'agence test.`);
  }
  console.log(`Socle : ${leads.length} leads avec ban_id.`);

  const hotBuildings = pickHotBuildings(leads, 8);
  const sciBanLead = hotBuildings[7] ?? hotBuildings[0]!;
  const hotEntityCounts = new Map<string, number>(
    hotBuildings.map((h) => [h.ban_id!, 0]),
  );

  const counts: Record<string, number> = {};

  // --- Contacts 140 ---
  const contactRows: Record<string, unknown>[] = [];
  const acquereurIds: string[] = [];
  const vendeurIds: string[] = [];
  const typePlan: Array<[string, number]> = [
    ['acquereur', 55],
    ['vendeur', 50],
    ['locataire', 20],
    ['autre', 15],
  ];
  let ci = 0;
  for (const [type, count] of typePlan) {
    for (let i = 0; i < count; i += 1) {
      const { first, last } = pickName(ci);
      const negotiator = DEMO_NEGOTIATORS[ci % DEMO_NEGOTIATORS.length]!;
      const daysAgo = daysAgoGlissant(now, i / count);
      const id = randomUUID();
      const budgetMin = type === 'acquereur' ? 280_000 + (i % 8) * 35_000 : null;
      const budgetMax = type === 'acquereur' ? 380_000 + (i % 7) * 50_000 : null;
      contactRows.push({
        id,
        agency_id: DEMO_AGENCY_ID,
        created_by: team[negotiator.key],
        first_name: first,
        last_name: last,
        contact_type: type,
        phone: pickPhone(ci),
        email: `${first.toLowerCase().replace(/[^a-z]/g, '')}.${last.toLowerCase()}${ci}@example.com`,
        secteur: negotiator.secteurLabels[i % negotiator.secteurLabels.length],
        postal_codes: type === 'acquereur' ? ['75020'] : ['75020'],
        budget_min: budgetMin,
        budget_max: budgetMax && budgetMin ? Math.min(750_000, Math.max(budgetMax, budgetMin + 50_000)) : budgetMax,
        surface_min: type === 'acquereur' ? 25 + (i % 4) * 10 : null,
        surface_max: type === 'acquereur' ? 55 + (i % 5) * 8 : null,
        rooms_min: type === 'acquereur' ? 1 + (i % 4) : null,
        last_interaction_at: isoDaysHours(now, -daysAgo),
        created_at: isoDaysHours(now, -daysAgo),
        source: i % 3 === 0 ? 'vocal' : 'manuel',
        is_demo: true,
      });
      if (type === 'acquereur') acquereurIds.push(id);
      if (type === 'vendeur') vendeurIds.push(id);
      ci += 1;
    }
  }
  counts.contacts = await insertBatches(admin, 'contacts', contactRows);
  const allContactIds: string[] = contactRows.map((c) => c.id as string);

  // SCI propriétaire
  const sciOwnerId = vendeurIds[0]!;
  await admin
    .from('contacts')
    .update({
      summary: 'SCI Les Lilas du 20e — 3 lots',
      last_name: 'SCI Les Lilas du 20e',
      first_name: '',
    })
    .eq('id', sciOwnerId);

  // --- Biens scénarisés + bulk ---
  const bienRows: Record<string, unknown>[] = [];
  const burnLead = hotBuildings[0]!;
  const matchLead = hotBuildings[1]!;
  const staleLead = hotBuildings[2]!;

  const burnBienId = randomUUID();
  bienRows.push({
    id: burnBienId,
    agency_id: DEMO_AGENCY_ID,
    created_by: team.camille,
    address: burnLead.address,
    city: 'Paris',
    postal_code: '75020',
    property_type: 'Appartement',
    surface_m2: 68,
    rooms: 3,
    price: 620_000,
    prix_initial: 650_000,
    mandat_statut: 'mandat_exclusif',
    mandat_type: 'exclusif',
    mandat_signe_le: mandatSignePourExpirationDans(now, 4, 3),
    mandat_duree_mois: 3,
    proprietaire_contact_id: vendeurIds[1],
    ...bienTimestamps(now, 90),
    updated_at: isoDaysHours(now, -35),
    is_demo: true,
    ...leadGeoFields(burnLead),
  });
  hotEntityCounts.set(burnLead.ban_id!, (hotEntityCounts.get(burnLead.ban_id!) ?? 0) + 1);

  const matchBienId = randomUUID();
  bienRows.push({
    id: matchBienId,
    agency_id: DEMO_AGENCY_ID,
    created_by: team.thomas,
    address: matchLead.address,
    city: 'Paris',
    postal_code: '75020',
    property_type: 'Appartement',
    surface_m2: 58,
    rooms: 3,
    price: 485_000,
    prix_initial: 495_000,
    mandat_statut: 'mandat_simple',
    mandat_type: 'simple',
    mandat_signe_le: isoDateDays(now, -3),
    mandat_duree_mois: 3,
    proprietaire_contact_id: vendeurIds[2],
    ...bienTimestamps(now, 3),
    is_demo: true,
    ...leadGeoFields(matchLead),
  });
  hotEntityCounts.set(matchLead.ban_id!, (hotEntityCounts.get(matchLead.ban_id!) ?? 0) + 1);

  const matchAcquereurId = randomUUID();
  await admin.from('contacts').insert({
    id: matchAcquereurId,
    agency_id: DEMO_AGENCY_ID,
    created_by: team.lea,
    first_name: 'Sandrine',
    last_name: 'Moreau',
    contact_type: 'acquereur',
    phone: '0639981515',
    email: 'sandrine.moreau@example.com',
    postal_codes: ['75020'],
    budget_min: 450_000,
    budget_max: 520_000,
    surface_min: 50,
    surface_max: 65,
    rooms_min: 3,
    last_interaction_at: isoDaysHours(now, -2),
    is_demo: true,
  });
  counts.contacts += 1;
  allContactIds.push(matchAcquereurId);
  acquereurIds.unshift(matchAcquereurId);

  const staleMandatId = randomUUID();
  bienRows.push({
    id: staleMandatId,
    agency_id: DEMO_AGENCY_ID,
    created_by: team.camille,
    address: staleLead.address,
    city: 'Paris',
    postal_code: '75020',
    property_type: 'Appartement',
    surface_m2: 42,
    rooms: 2,
    price: 395_000,
    mandat_statut: 'mandat_simple',
    mandat_type: 'simple',
    mandat_signe_le: isoDateDays(now, -24),
    mandat_duree_mois: 3,
    proprietaire_contact_id: vendeurIds[3],
    ...bienTimestamps(now, 24),
    is_demo: true,
    ...leadGeoFields(staleLead),
  });

  const relanceVendeurId = randomUUID();
  await admin.from('contacts').insert({
    id: relanceVendeurId,
    agency_id: DEMO_AGENCY_ID,
    created_by: team.thomas,
    first_name: 'Henri',
    last_name: 'Girard',
    contact_type: 'vendeur',
    phone: '0639981616',
    email: 'henri.girard@example.com',
    secteur: 'Charonne',
    postal_codes: ['75020'],
    last_interaction_at: isoDaysHours(now, -120),
    created_at: isoDaysHours(now, -120),
    is_demo: true,
  });
  counts.contacts += 1;
  allContactIds.push(relanceVendeurId);

  const ferrandId = randomUUID();
  await admin.from('contacts').insert({
    id: ferrandId,
    agency_id: DEMO_AGENCY_ID,
    created_by: team.camille,
    first_name: 'Michel',
    last_name: 'Ferrand',
    contact_type: 'acquereur',
    phone: '0639981717',
    email: 'michel.ferrand@example.com',
    postal_codes: ['75020'],
    is_demo: true,
  });
  counts.contacts += 1;
  allContactIds.push(ferrandId);

  // SCI — 3 lots même immeuble
  for (let s = 0; s < 3; s += 1) {
    const surface = 38 + s * 14;
    bienRows.push({
      id: randomUUID(),
      agency_id: DEMO_AGENCY_ID,
      created_by: team.thomas,
      address: sciBanLead.address,
      city: 'Paris',
      postal_code: '75020',
      property_type: 'Appartement',
      surface_m2: surface,
      rooms: 2 + s,
      price: priceFromSurfaceM2(surface, s + 10),
      mandat_statut: s === 2 ? 'vendu' : 'mandat_exclusif',
      mandat_type: 'exclusif',
      mandat_signe_le: isoDateDays(now, -200 - s * 40),
      mandat_duree_mois: 3,
      proprietaire_contact_id: sciOwnerId,
      ...bienTimestamps(now, 200 + s * 40),
      is_demo: true,
      ban_id: sciBanLead.ban_id,
      latitude: sciBanLead.latitude,
      longitude: sciBanLead.longitude,
      adresse_normalisee: sciBanLead.adresse_normalisee ?? sciBanLead.address,
    });
    hotEntityCounts.set(sciBanLead.ban_id!, (hotEntityCounts.get(sciBanLead.ban_id!) ?? 0) + 1);
  }

  const statutMix: Array<'mandat_simple' | 'mandat_exclusif' | 'vendu' | 'archive'> = [
    'mandat_simple', 'mandat_exclusif', 'vendu', 'archive',
  ];
  let leadIdx = 3;
  while (bienRows.length < 45) {
    const lead = leads[leadIdx % leads.length]!;
    leadIdx += 1;
    const b = bienRows.length;
    const surface = 32 + (b % 9) * 7;
    const statut = statutMix[b % statutMix.length]!;
    const daysAgo = daysAgoGlissant(now, b / 45);
    const needsBaisse = b % 11 === 0;
    const prix = priceFromSurfaceM2(surface, b);
    bienRows.push({
      id: randomUUID(),
      agency_id: DEMO_AGENCY_ID,
      created_by: team[b % 2 === 0 ? 'camille' : 'lea'],
      address: lead.address,
      city: 'Paris',
      postal_code: lead.postal_code ?? '75020',
      property_type: b % 6 === 0 ? 'Maison' : 'Appartement',
      surface_m2: surface,
      rooms: 2 + (b % 4),
      price: needsBaisse ? Math.round(prix * 0.94) : prix,
      prix_initial: prix,
      derniere_baisse_le: needsBaisse ? isoDateDays(now, -14) : null,
      mandat_statut: statut,
      mandat_type: statut === 'mandat_exclusif' ? 'exclusif' : statut === 'mandat_simple' ? 'simple' : null,
      mandat_signe_le: statut === 'archive' ? null : isoDateDays(now, -daysAgo),
      mandat_duree_mois: 3,
      proprietaire_contact_id: vendeurIds[b % vendeurIds.length],
      updated_at: b >= 43 ? isoDaysHours(now, -38 - (b - 43)) : isoDaysHours(now, -daysAgo / 2),
      ...bienTimestamps(now, daysAgo),
      is_demo: true,
      ...leadGeoFields(lead),
    });
  }
  counts.biens = await insertBatches(admin, 'biens', bienRows);
  const bienIds = bienRows.map((r) => r.id as string);

  // --- Visites 180 ---
  const visiteRows: Record<string, unknown>[] = [];
  const scenarioVisiteId = randomUUID();
  visiteRows.push({
    id: scenarioVisiteId,
    agency_id: DEMO_AGENCY_ID,
    bien_id: matchBienId,
    contact_id: matchAcquereurId,
    profile_id: DEMO_DIRECTOR_PROFILE_ID,
    date_visite: isoDaysHours(now, -1, -2),
    compte_rendu_acquereur_fait_le: null,
    compte_rendu_vendeur_fait_le: null,
    is_demo: true,
  });

  let vCount = 1;
  for (const bienId of bienIds) {
    if (bienId === burnBienId) continue;
    const n = 3 + (vCount % 6);
    for (let v = 0; v < n && vCount < 180; v += 1) {
      const forgotCr = vCount % 10 < 3;
      const daysAgo = 5 + (vCount % 90);
      visiteRows.push({
        id: randomUUID(),
        agency_id: DEMO_AGENCY_ID,
        bien_id: bienId,
        contact_id: acquereurIds[vCount % acquereurIds.length],
        profile_id: pickNoteAuthor(vCount, team),
        date_visite: isoDaysHours(now, -daysAgo, 10 + (vCount % 6)),
        compte_rendu_acquereur_fait_le: forgotCr ? null : isoDaysHours(now, -daysAgo + 1),
        compte_rendu_vendeur_fait_le: forgotCr ? null : isoDaysHours(now, -daysAgo + 1),
        is_demo: true,
      });
      vCount += 1;
    }
  }
  const soldBiens = bienRows.filter((b) => b.mandat_statut === 'vendu');
  for (const bien of soldBiens) {
    for (let v = 0; v < 3; v += 1) {
      visiteRows.push({
        id: randomUUID(),
        agency_id: DEMO_AGENCY_ID,
        bien_id: bien.id,
        contact_id: acquereurIds[v % acquereurIds.length],
        profile_id: team.camille,
        date_visite: isoDaysHours(now, -90 - v * 10),
        compte_rendu_acquereur_fait_le: isoDaysHours(now, -89 - v * 10),
        compte_rendu_vendeur_fait_le: isoDaysHours(now, -89 - v * 10),
        is_demo: true,
      });
    }
  }

  counts.visites = await insertBatches(admin, 'visites', visiteRows.slice(0, 180));

  // --- Offres 22 ---
  const offreRows: Record<string, unknown>[] = [];
  for (let i = 0; i < soldBiens.length && i < 12; i += 1) {
    const bien = soldBiens[i]!;
    const soumise = isoDateDays(now, -120 - i * 15);
    const delay = 5 + (i % 16);
    offreRows.push({
      id: randomUUID(),
      agency_id: DEMO_AGENCY_ID,
      bien_id: bien.id,
      contact_id: acquereurIds[i % acquereurIds.length],
      montant: (bien.price as number) * 0.97,
      soumise_le: soumise,
      statut: 'acceptee',
      compromis_signe_le: isoDateFromBase(new Date(`${soumise}T12:00:00.000Z`), delay),
      is_demo: true,
    });
  }
  while (offreRows.length < 22) {
    const bienId = bienIds[offreRows.length % bienIds.length]!;
    offreRows.push({
      id: randomUUID(),
      agency_id: DEMO_AGENCY_ID,
      bien_id: bienId,
      montant: 410_000 + offreRows.length * 8000,
      statut: 'en_attente',
      soumise_le: isoDateDays(now, -7),
      validite_jusqu_au: isoDateDays(now, 4 + (offreRows.length % 3)),
      is_demo: true,
    });
  }
  counts.offres = await insertBatches(admin, 'offres', offreRows.slice(0, 22));

  // --- Promesses 30 (1 scénario directeur) ---
  const promesseRows: Record<string, unknown>[] = [
    {
      id: randomUUID(),
      agency_id: DEMO_AGENCY_ID,
      profile_id: DEMO_DIRECTOR_PROFILE_ID,
      contact_id: ferrandId,
      intitule: 'Rappeler M. Ferrand pour le financement',
      echeance: isoDateDays(now, -2),
      statut: 'a_faire',
      cree_par: 'dictee',
      is_demo: true,
    },
  ];
  for (let p = promesseRows.length; p < 30; p += 1) {
    promesseRows.push({
      id: randomUUID(),
      agency_id: DEMO_AGENCY_ID,
      profile_id: p % 3 === 0 ? DEMO_DIRECTOR_PROFILE_ID : team[p % 2 === 0 ? 'camille' : 'thomas'],
      contact_id: acquereurIds[p % acquereurIds.length],
      intitule: `Suivi dossier ${p + 1}`,
      echeance: isoDateDays(now, 5 + p),
      statut: p % 4 === 0 ? 'faite' : 'a_faire',
      cree_par: p % 5 === 0 ? 'dictee' : 'manuel',
      is_demo: true,
    });
  }
  counts.promesses = await insertBatches(admin, 'promesses', promesseRows);

  // --- Rendez-vous 25 ---
  const rdvRows: Record<string, unknown>[] = [];
  const apm = cetApresMidiParis(now);
  rdvRows.push({
    id: randomUUID(),
    agency_id: DEMO_AGENCY_ID,
    profile_id: DEMO_DIRECTOR_PROFILE_ID,
    contact_id: matchAcquereurId,
    bien_id: matchBienId,
    debut: apm.debut,
    fin: apm.fin,
    type: 'visite',
    lieu: matchLead.address,
    is_demo: true,
  });
  for (let r = rdvRows.length; r < 25; r += 1) {
    rdvRows.push({
      id: randomUUID(),
      agency_id: DEMO_AGENCY_ID,
      profile_id: r % 2 === 0 ? team.lea : team.thomas,
      contact_id: acquereurIds[r % acquereurIds.length],
      debut: isoDaysHours(now, 1 + (r % 8), 9 + (r % 4)),
      fin: isoDaysHours(now, 1 + (r % 8), 10 + (r % 4)),
      type: r % 3 === 0 ? 'estimation' : 'visite',
      is_demo: true,
    });
  }
  counts.rendez_vous = await insertBatches(admin, 'rendez_vous', rdvRows);

  // --- Voice notes 110 + note_liens 200 ---
  const noteRows: Record<string, unknown>[] = [];
  const lienRows: Record<string, unknown>[] = [];
  const noteIds: string[] = [];
  const lienKeys = new Set<string>();

  function pushLien(row: Record<string, unknown>) {
    const key = `${row.note_id}:${row.entite_type}:${row.entite_id}`;
    if (lienKeys.has(key)) return;
    lienKeys.add(key);
    lienRows.push(row);
  }

  for (const hot of hotBuildings) {
    const nNotes = 4 + (hotBuildings.indexOf(hot) % 4);
    for (let n = 0; n < nNotes; n += 1) {
      const noteId = randomUUID();
      noteIds.push(noteId);
      const author = pickNoteAuthor(hotBuildings.indexOf(hot) * 10 + n, team);
      let daysAgo = 540 - n * 45;
      if (author === team.bruno) daysAgo = Math.max(daysAgo, 25);
      const transcript = NOTE_TRANSCRIPTS[(n + hotBuildings.indexOf(hot)) % NOTE_TRANSCRIPTS.length]!;
      noteRows.push({
        id: noteId,
        agency_id: DEMO_AGENCY_ID,
        created_by: author,
        storage_path: `demo/seed/${noteId}.webm`,
        duration_seconds: 35 + n * 8,
        transcript,
        status: 'valide',
        statut: 'revue',
        visibilite: 'agence',
        source_info: SOURCES[n % SOURCES.length],
        ban_id: hot.ban_id,
        latitude: hot.latitude,
        longitude: hot.longitude,
        adresse_normalisee: hot.adresse_normalisee ?? hot.address,
        created_at: isoDaysHours(now, -daysAgo),
        is_demo: true,
      });
      hotEntityCounts.set(hot.ban_id!, (hotEntityCounts.get(hot.ban_id!) ?? 0) + 1);
      if (n % 2 === 0) {
        pushLien({
          id: randomUUID(),
          note_id: noteId,
          agency_id: DEMO_AGENCY_ID,
          entite_type: 'immeuble',
          entite_id: hot.ban_id!,
          confiance: 'certain',
          cree_par: 'agent',
          is_demo: true,
        });
      }
    }
  }

  // Narratif gardien → vacance (immeuble 0)
  if (hotBuildings[0]?.ban_id) {
    const oldId = randomUUID();
    const newId = randomUUID();
    noteIds.push(oldId, newId);
    noteRows.push(
      {
        id: oldId,
        agency_id: DEMO_AGENCY_ID,
        created_by: team.thomas,
        storage_path: `demo/seed/${oldId}.webm`,
        transcript: 'Croisé la gardienne du 14, elle dit que le 3e droite se vide en septembre',
        status: 'valide',
        statut: 'revue',
        visibilite: 'agence',
        source_info: 'gardien',
        ban_id: hotBuildings[0].ban_id,
        latitude: hotBuildings[0].latitude,
        longitude: hotBuildings[0].longitude,
        adresse_normalisee: hotBuildings[0].address,
        created_at: isoDaysHours(now, -540),
        is_demo: true,
      },
      {
        id: newId,
        agency_id: DEMO_AGENCY_ID,
        created_by: team.camille,
        storage_path: `demo/seed/${newId}.webm`,
        transcript: 'Le 3e droite est vide depuis deux mois, pas de panneau',
        status: 'valide',
        statut: 'revue',
        visibilite: 'agence',
        source_info: 'voisin',
        ban_id: hotBuildings[0].ban_id,
        latitude: hotBuildings[0].latitude,
        longitude: hotBuildings[0].longitude,
        adresse_normalisee: hotBuildings[0].address,
        created_at: isoDaysHours(now, -55),
        is_demo: true,
      },
    );
    for (const nid of [oldId, newId]) {
      pushLien({
        id: randomUUID(),
        note_id: nid,
        agency_id: DEMO_AGENCY_ID,
        entite_type: 'immeuble',
        entite_id: hotBuildings[0].ban_id!,
        confiance: 'certain',
        cree_par: 'agent',
        is_demo: true,
      });
    }
  }

  while (noteRows.length < 110) {
    const noteId = randomUUID();
    noteIds.push(noteId);
    const idx = noteRows.length;
    const author = pickNoteAuthor(idx, team);
    let daysAgo = daysAgoGlissant(now, idx / 110);
    if (author === team.bruno) daysAgo = Math.max(daysAgo, 22);
    const linkKind = idx % 100;
    noteRows.push({
      id: noteId,
      agency_id: DEMO_AGENCY_ID,
      created_by: author,
      storage_path: `demo/seed/${noteId}.webm`,
      duration_seconds: 30 + (idx % 40),
      transcript: NOTE_TRANSCRIPTS[idx % NOTE_TRANSCRIPTS.length],
      status: 'valide',
      statut: 'revue',
      visibilite: 'agence',
      source_info: SOURCES[idx % SOURCES.length],
      created_at: isoDaysHours(now, -daysAgo),
      is_demo: true,
    });
  }

  counts.voice_notes = await insertBatches(admin, 'voice_notes', noteRows);

  // Liens : 40% contact, 25% immeuble, reste orphelin
  let lienAttempts = 0;
  while (lienRows.length < 200 && lienAttempts < 400) {
    lienAttempts += 1;
    const i = lienRows.length;
    const noteId = noteIds[(lienAttempts + i) % noteIds.length]!;
    if (i % 100 < 40) {
      pushLien({
        id: randomUUID(),
        note_id: noteId,
        agency_id: DEMO_AGENCY_ID,
        entite_type: 'contact',
        entite_id: acquereurIds[(i + lienAttempts) % acquereurIds.length]!,
        confiance: i % 3 === 0 ? 'certain' : 'probable',
        cree_par: i % 2 === 0 ? 'extraction' : 'agent',
        is_demo: true,
      });
    } else if (i % 100 < 65) {
      const hot = hotBuildings[(i + lienAttempts) % hotBuildings.length]!;
      pushLien({
        id: randomUUID(),
        note_id: noteId,
        agency_id: DEMO_AGENCY_ID,
        entite_type: 'immeuble',
        entite_id: hot.ban_id!,
        confiance: 'probable',
        cree_par: 'reconciliation',
        is_demo: true,
      });
    } else {
      pushLien({
        id: randomUUID(),
        note_id: noteId,
        agency_id: DEMO_AGENCY_ID,
        entite_type: 'contact',
        entite_id: vendeurIds[(i + lienAttempts) % vendeurIds.length]!,
        confiance: 'probable',
        cree_par: 'extraction',
        is_demo: true,
      });
    }
  }
  counts.note_liens = await insertBatches(admin, 'note_liens', lienRows.slice(0, 200));

  // --- Interactions 380 ---
  const interactionRows: Record<string, unknown>[] = [];
  for (let i = 0; i < 380; i += 1) {
    interactionRows.push({
      id: randomUUID(),
      agency_id: DEMO_AGENCY_ID,
      contact_id: allContactIds[i % allContactIds.length]!,
      author_id: pickNoteAuthor(i, team),
      kind: i % 4 === 0 ? 'appel' : 'note',
      body: i % 7 === 0 ? 'Rappel promis la semaine prochaine' : `Échange ${i + 1}`,
      occurred_at: isoDaysHours(now, -Math.floor(i / 1.8)),
      is_demo: true,
    });
  }
  counts.contact_interactions = await insertBatches(admin, 'contact_interactions', interactionRows);

  // --- Pile Aujourd'hui + vue directeur ---
  const workLeads = leads.filter(
    (l) => !['mandat_signe', 'pas_interesse', 'vendeur_ailleurs'].includes(l.status),
  );
  const [closeA, closeB] = closestLeadPair(workLeads.slice(0, 40));
  const tourSet = new Set([closeA.id, closeB.id]);
  let tourIdx = 0;
  for (const lead of workLeads) {
    if (tourIdx >= 4) break;
    if (tourIdx >= 2 && !tourSet.has(lead.id)) continue;
    await snapshotLead(admin, lead, {
      status: 'nouveau',
      delivered_at: isoDaysHours(now, -tourIdx),
      assigned_to: DEMO_DIRECTOR_PROFILE_ID,
    });
    tourIdx += 1;
  }

  const unassigned = leads.filter((l) => !l.assigned_to).slice(0, 3);
  for (const lead of (unassigned.length >= 3 ? unassigned : leads.slice(10, 13))) {
    await snapshotLead(admin, lead, {
      assigned_to: null,
      delivered_at: isoDaysHours(now, -18),
      status: lead.status === 'mandat_signe' ? lead.status : 'nouveau',
    });
  }

  // Secteur 75019 endormi : aucune note récente avec ce CP (activité limitée au 75020)
  console.log('Scénario Aujourd\'hui branché sur', DEMO_DIRECTOR_PROFILE_ID);

  // --- Récap ---
  console.log('\n=== Seed démo terminé ===');
  console.log('Volumes créés :');
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(22)} ${n}`);
  }
  console.log('\nImmeubles chauds (ban_id · adresse · entités) :');
  const recap: HotBuilding[] = hotBuildings.map((h) => ({
    banId: h.ban_id!,
    address: h.address,
    entities: hotEntityCounts.get(h.ban_id!) ?? 0,
  }));
  for (const row of recap) {
    console.log(`  ${row.banId} · ${row.address} · ${row.entities}`);
  }
  console.log(`\nConnexion directeur : profil ${DEMO_DIRECTOR_PROFILE_ID}`);
  console.log(`Négociateurs fictifs : ${DEMO_NEGOTIATORS.map((n) => n.email).join(', ')}`);
  console.log(`Mot de passe démo : ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
