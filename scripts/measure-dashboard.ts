/**
 * Mesure le chemin APRÈS optimisation (même helpers que page.tsx).
 *   npx tsx scripts/measure-dashboard.ts
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { viewerFromProfile } from '../lib/agency/visibility';
import { visibleContactsFor, visibleLeadsFor } from '../lib/agency/scope-records';
import { fetchMembersOfMyAgency, memberNamesById } from '../lib/queries/agency-members';
import { fetchLeads } from '../lib/queries/leads';
import { fetchContactsSafe, fetchVoiceNotesSafe } from '../lib/queries/contacts';
import { fetchBiensSafe } from '../lib/queries/biens';
import { fetchTodayDismissals } from '../lib/queries/today';
import { fetchAssignmentsToMe } from '../lib/queries/assignments';
import { fetchAgencyAlerts } from '../lib/queries/alerts';
import { fetchAgencyOverview } from '../lib/queries/agency-overview';
import { buildTodayCards } from '../lib/today/cards';
import { fetchFieldWeek } from '../lib/queries/field-week';
import { fetchTodayMetierSafe } from '../lib/queries/metier-today';
import { rapprocherTousLesBiens } from '../lib/matching/rapprochement';
import { bienIsActive } from '../types/bien';
import {
  buildAgencyMemberships,
  resolveActiveAgencyId,
  resolveActiveRole,
} from '../lib/auth/active-agency';
import type { ProfileRow } from '../types/database';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i === -1) continue;
  const key = line.slice(0, i);
  if (!process.env[key]) process.env[key] = line.slice(i + 1);
}

async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const value = await fn();
  const dur = Math.round(performance.now() - t0);
  console.info(`${String(dur).padStart(5)}ms  ${name}`);
  return value;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const pingT0 = performance.now();
  const ping = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon } });
  const pingMs = Math.round(performance.now() - pingT0);
  const cfRay = ping.headers.get('cf-ray') ?? '';
  console.info(`\n=== Réseau Supabase ===`);
  console.info(`${String(pingMs).padStart(5)}ms  GET /auth/v1/health  cf-ray=${cfRay}`);

  const admin = createClient(url, service);
  const directorLink = (
    await admin
      .from('profile_agencies')
      .select('profile_id, agency_id, role')
      .eq('role', 'directeur')
      .eq('agency_id', '34fca84a-797f-4827-8cfe-d10af156620e')
      .limit(1)
      .maybeSingle()
  ).data;
  const profileId = directorLink?.profile_id;
  if (!profileId) throw new Error('Aucun directeur');

  const tAll = performance.now();

  console.info(`\n=== getServerUser (profil + memberships en parallèle) ===`);
  await timed('auth.getUser', async () => {
    const { error } = await admin.auth.admin.getUserById(profileId);
    if (error) throw error;
  });

  const [profile, membershipRows] = await Promise.all([
    timed('profiles.select', async () => {
      const { data, error } = await admin
        .from('profiles')
        .select(
          'id, active_agency_id, first_name, last_name, phone, preferences, leads_last_seen_at, onboarding_completed_at, created_at, updated_at',
        )
        .eq('id', profileId)
        .single();
      if (error || !data) throw error ?? new Error('profile');
      return data;
    }),
    timed('profile_agencies.select', async () => {
      const { data, error } = await admin
        .from('profile_agencies')
        .select('agency_id, role')
        .eq('profile_id', profileId);
      if (error) throw error;
      return data ?? [];
    }),
  ]);

  const agencies = await timed('agencies.select (colonnes)', async () => {
    const { data, error } = await admin
      .from('agencies')
      .select(
        'id, name, address, phone, email, plan, codes_postaux, latitude, longitude, stripe_customer_id, created_at, updated_at',
      )
      .in(
        'id',
        membershipRows.map((r) => r.agency_id),
      );
    if (error) throw error;
    return data ?? [];
  });

  const memberships = buildAgencyMemberships(membershipRows, agencies);
  const agencyId = resolveActiveAgencyId(profile as ProfileRow, memberships)!;
  const role = resolveActiveRole(memberships, agencyId)!;
  const agency = agencies.find((a) => a.id === agencyId)!;
  const viewer = viewerFromProfile({ id: profile.id, role });
  const supabase = admin;

  console.info(`\n=== Vague unique (leads/contacts/biens/metier/notes/members) ===`);
  const wave1T0 = performance.now();
  const [leads, contacts, biens, dismissals, members, metier, notes] = await Promise.all([
    timed('fetchLeads', () => fetchLeads(supabase)),
    timed('fetchContactsSafe', () => fetchContactsSafe(supabase)),
    timed('fetchBiensSafe', () => fetchBiensSafe(supabase)),
    timed('fetchTodayDismissals', () => fetchTodayDismissals(supabase, profileId)),
    timed('fetchMembersOfMyAgency', () => fetchMembersOfMyAgency(agencyId, memberships)),
    timed('fetchTodayMetierSafe', () => fetchTodayMetierSafe(supabase, profileId)),
    timed('fetchVoiceNotesSafe', () => fetchVoiceNotesSafe(supabase)),
  ]);
  console.info(`${String(Math.round(performance.now() - wave1T0)).padStart(5)}ms  vague1 wall-clock\n`);

  const names = memberNamesById(members);
  const visibleContacts = visibleContactsFor(viewer, contacts);
  const visibleLeads = visibleLeadsFor(viewer, leads);

  console.info(`=== Vague 2 (assignments + field week + overview sans re-fetch) ===`);
  const wave2T0 = performance.now();
  const rapprochementsP = timed('rapprocherTousLesBiens', async () =>
    rapprocherTousLesBiens(
      biens.filter((b) => bienIsActive(b.mandatStatut)).map((b) => ({
        id: b.id,
        address: b.address,
        postalCode: b.postalCode,
        price: b.price,
        surfaceM2: b.surfaceM2,
        rooms: b.rooms,
        latitude: b.latitude,
        longitude: b.longitude,
      })),
      visibleContacts,
    ),
  );

  const [assignments, alerts, week, rapprochements] = await Promise.all([
    timed('fetchAssignmentsToMe', () => fetchAssignmentsToMe(supabase, profileId, names)),
    timed('fetchAgencyAlerts', () => fetchAgencyAlerts(supabase, names)),
    timed('fetchFieldWeek', () =>
      fetchFieldWeek({
        supabase,
        profileId,
        contacts: visibleContacts,
        leads: visibleLeads,
      }),
    ),
    rapprochementsP,
  ]);
  console.info(`${String(Math.round(performance.now() - wave2T0)).padStart(5)}ms  first-paint wall-clock (sans overview)`);

  const overview = await timed('fetchAgencyOverview(prefetched, streamé)', () =>
    fetchAgencyOverview({
      supabase,
      agencyId,
      memberships,
      role,
      agencyPostalCodes: agency.codes_postaux ?? [],
      prefetched: {
        members: members.map((m) => ({ id: m.id, fullName: m.fullName })),
        leads,
        contacts,
        biens,
        notes,
      },
    }),
  );
  void assignments;
  void alerts;
  void week;
  void overview;

  const cardsT0 = performance.now();
  buildTodayCards({
    leads: visibleLeads,
    contacts: visibleContacts,
    rapprochements,
    dismissals,
    assignments,
    alerts,
    ...metier,
  });
  console.info(`${String(Math.round(performance.now() - cardsT0)).padStart(5)}ms  buildTodayCards (CPU)`);

  console.info(
    `\n${String(Math.round(performance.now() - tAll)).padStart(5)}ms  TOTAL chemin page (service_role, sans middleware/RSC)`,
  );
  console.info(`Leads=${leads.length} contacts=${contacts.length} biens=${biens.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
