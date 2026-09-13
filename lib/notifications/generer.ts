import type { SupabaseClient } from '@supabase/supabase-js';
import { dateKeyParis } from '@/lib/today/calendar';
import { isSignedMandat, PORTFOLIO_STALE_MANDAT_DAYS } from '@/lib/today/portfolio';
import { mondayOf, previousMonday } from '@/lib/today/weekly-snapshot';
import { fetchAnniversairesDuJour } from '@/lib/queries/birthdays';
import { fetchZonesPourAgence } from '@/lib/queries/zones';
import { zoneDuLead, type LeadSituable } from '@/lib/zones/leads';
import type { Database } from '@/types/database';
import { ecrireNotification, notificationDejaEmise, purgerNotificationsLues } from './ecrire';
import { lienNotification } from './liens';
import {
  corpsLeadsLivresDirecteur,
  corpsLeadsLivresNego,
  titreAnniversaire,
  titreLeadsLivresDirecteur,
  titreLeadsLivresNego,
  titreMandat60Jours,
  titreNegociateurSansActivite,
  titreZoneNonTravaillee,
} from './textes';

type Admin = SupabaseClient<Database>;

const JOUR_MS = 86_400_000;

async function membresAgence(
  admin: Admin,
  agencyId: string,
): Promise<{ id: string; firstName: string; role: string }[]> {
  const { data: links, error } = await admin
    .from('profile_agencies')
    .select('profile_id, role')
    .eq('agency_id', agencyId);
  if (error || !links?.length) return [];

  const ids = links.map((l) => l.profile_id);
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, first_name')
    .in('id', ids);

  const prenom = new Map((profiles ?? []).map((p) => [p.id, (p.first_name ?? '').trim()]));
  return links.map((l) => ({
    id: l.profile_id,
    firstName: prenom.get(l.profile_id) || 'un collègue',
    role: l.role,
  }));
}

function debutJourParisIso(now: Date): string {
  const key = dateKeyParis(now);
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, 0, 0)).toISOString();
}

function versLeadSituable(row: {
  id: string;
  address: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  assigned_to: string | null;
  stage_id: string | null;
  delivered_at: string | null;
  created_at: string;
  taken_at?: string | null;
  stage_changed_at?: string | null;
}): LeadSituable & { takenAt: string | null; stageChangedAt: string | null } {
  return {
    id: row.id,
    address: row.address,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    assignedTo: row.assigned_to,
    stageId: row.stage_id,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    takenAt: row.taken_at ?? null,
    stageChangedAt: row.stage_changed_at ?? null,
  };
}

/** Lundi : une ligne par négociateur (sa zone) + une pour chaque directeur. */
export async function genererLeadsLivres(
  admin: Admin,
  agencyId: string,
  now = new Date(),
): Promise<number> {
  const weekStart = mondayOf(now);
  const depuis = previousMonday(now);
  const groupeCle = `leads_livres:${weekStart}`;
  const depuisIso = debutJourParisIso(now);

  const [membres, zones, leadsRes] = await Promise.all([
    membresAgence(admin, agencyId),
    fetchZonesPourAgence(admin, agencyId),
    admin
      .from('leads')
      .select(
        'id, address, postal_code, latitude, longitude, assigned_to, stage_id, delivered_at, created_at',
      )
      .eq('agency_id', agencyId)
      .gte('delivered_at', depuis),
  ]);

  if (leadsRes.error) {
    console.error('[notifications] leads livrés', leadsRes.error.message);
    return 0;
  }

  const lots = ((leadsRes.data ?? []) as Parameters<typeof versLeadSituable>[0][]).map(
    versLeadSituable,
  );
  if (lots.length === 0) return 0;

  const parTitulaire = new Map<string, number>();
  const zonesTouchees = new Set<string>();
  for (const lead of lots) {
    const zone = zoneDuLead(lead, zones);
    if (!zone?.assignedTo) continue;
    zonesTouchees.add(zone.id);
    parTitulaire.set(zone.assignedTo, (parTitulaire.get(zone.assignedTo) ?? 0) + 1);
  }

  let ecrites = 0;
  for (const membre of membres) {
    if (membre.role === 'directeur') continue;
    const n = parTitulaire.get(membre.id) ?? 0;
    if (n === 0) continue;
    if (await notificationDejaEmise(admin, { agencyId, profileId: membre.id, groupeCle, depuisIso })) {
      continue;
    }
    const ok = await ecrireNotification(admin, {
      agencyId,
      profileId: membre.id,
      type: 'leads_livres',
      titre: titreLeadsLivresNego(n),
      corps: corpsLeadsLivresNego(),
      lien: lienNotification('leads_livres'),
      groupeCle,
    });
    if (ok) ecrites += 1;
  }

  const total = lots.length;
  const secteurs = zonesTouchees.size;
  for (const directeur of membres.filter((m) => m.role === 'directeur')) {
    if (await notificationDejaEmise(admin, { agencyId, profileId: directeur.id, groupeCle, depuisIso })) {
      continue;
    }
    const ok = await ecrireNotification(admin, {
      agencyId,
      profileId: directeur.id,
      type: 'leads_livres',
      titre: titreLeadsLivresDirecteur(total),
      corps: corpsLeadsLivresDirecteur(secteurs),
      lien: lienNotification('leads_livres'),
      groupeCle,
    });
    if (ok) ecrites += 1;
  }

  return ecrites;
}

async function idsActifs7j(admin: Admin, agencyId: string, aujourdHui: string): Promise<Set<string>> {
  const [y, m, d] = aujourdHui.split('-').map(Number);
  const debut = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - 7, 0, 0, 0));
  const depuisIso = debut.toISOString();
  const jourDepuis = dateKeyParis(debut);
  const actifs = new Set<string>();

  const [sorties, notes, interactions] = await Promise.all([
    admin
      .from('sortie_events')
      .select('profile_id')
      .eq('agency_id', agencyId)
      .gte('day', jourDepuis),
    admin
      .from('voice_notes')
      .select('created_by')
      .eq('agency_id', agencyId)
      .gte('created_at', depuisIso),
    admin
      .from('contact_interactions')
      .select('author_id')
      .eq('agency_id', agencyId)
      .gte('occurred_at', depuisIso),
  ]);

  for (const row of sorties.data ?? []) {
    if (row.profile_id) actifs.add(row.profile_id);
  }
  for (const row of notes.data ?? []) {
    if (row.created_by) actifs.add(row.created_by);
  }
  for (const row of interactions.data ?? []) {
    if (row.author_id) actifs.add(row.author_id);
  }
  return actifs;
}

export async function genererAlertesDirecteur(
  admin: Admin,
  agencyId: string,
  now = new Date(),
): Promise<number> {
  const membres = await membresAgence(admin, agencyId);
  const directeurs = membres.filter((m) => m.role === 'directeur');
  if (directeurs.length === 0) return 0;

  const aujourdHui = dateKeyParis(now);
  const depuisIso = debutJourParisIso(now);
  const negociateurs = membres.filter((m) => m.role !== 'directeur');
  const actifs = await idsActifs7j(admin, agencyId, aujourdHui);
  let ecrites = 0;

  for (const nego of negociateurs) {
    if (actifs.has(nego.id)) continue;
    const groupeCle = `negociateur_sans_activite:${nego.id}:${aujourdHui}`;
    for (const directeur of directeurs) {
      if (
        await notificationDejaEmise(admin, {
          agencyId,
          profileId: directeur.id,
          groupeCle,
          depuisIso,
        })
      ) {
        continue;
      }
      const ok = await ecrireNotification(admin, {
        agencyId,
        profileId: directeur.id,
        type: 'negociateur_sans_activite',
        titre: titreNegociateurSansActivite(nego.firstName),
        corps: 'Aucune action observée cette semaine.',
        lien: lienNotification('negociateur_sans_activite', nego.id),
        entiteType: 'profil',
        entiteId: nego.id,
        groupeCle,
      });
      if (ok) ecrites += 1;
    }
  }

  const [zones, leadsRes] = await Promise.all([
    fetchZonesPourAgence(admin, agencyId),
    admin
      .from('leads')
      .select(
        'id, address, postal_code, latitude, longitude, assigned_to, stage_id, delivered_at, created_at, taken_at, stage_changed_at',
      )
      .eq('agency_id', agencyId),
  ]);

  const leads = ((leadsRes.data ?? []) as Parameters<typeof versLeadSituable>[0][]).map(
    versLeadSituable,
  );
  const seuil = now.getTime() - 7 * JOUR_MS;

  for (const zone of zones.filter((z) => z.actif && z.assignedTo)) {
    const titulaire = zone.assignedTo;
    if (!titulaire || !actifs.has(titulaire)) continue;
    const duSecteur = leads.filter((l) => zoneDuLead(l, [zone])?.id === zone.id);
    if (duSecteur.length === 0) continue;
    const travaillee = duSecteur.some((l) => {
      const t = Date.parse(l.takenAt ?? l.stageChangedAt ?? '');
      return Number.isFinite(t) && t >= seuil;
    });
    if (travaillee) continue;
    const nonPris = duSecteur.some((l) => l.stageId == null);
    if (!nonPris) continue;

    const groupeCle = `zone_non_travaillee:${zone.id}:${aujourdHui}`;
    for (const directeur of directeurs) {
      if (
        await notificationDejaEmise(admin, {
          agencyId,
          profileId: directeur.id,
          groupeCle,
          depuisIso,
        })
      ) {
        continue;
      }
      const ok = await ecrireNotification(admin, {
        agencyId,
        profileId: directeur.id,
        type: 'zone_non_travaillee',
        titre: titreZoneNonTravaillee(zone.nom),
        corps: 'Des adresses livrées n’ont pas été prises.',
        lien: lienNotification('zone_non_travaillee', zone.id),
        entiteType: 'zone',
        entiteId: zone.id,
        groupeCle,
      });
      if (ok) ecrites += 1;
    }
  }

  const { data: biens } = await admin
    .from('biens')
    .select('id, mandat_statut, mandat_date')
    .eq('agency_id', agencyId);

  const cutoffMandat = now.getTime() - PORTFOLIO_STALE_MANDAT_DAYS * JOUR_MS;
  const mandatsVieux = (biens ?? []).filter((b) => {
    if (!isSignedMandat(b.mandat_statut ?? '')) return false;
    const t = Date.parse(b.mandat_date ?? '');
    return Number.isFinite(t) && t <= cutoffMandat;
  }).length;

  if (mandatsVieux > 0) {
    const groupeCle = `mandat_60_jours:${aujourdHui}`;
    for (const directeur of directeurs) {
      if (
        await notificationDejaEmise(admin, {
          agencyId,
          profileId: directeur.id,
          groupeCle,
          depuisIso,
        })
      ) {
        continue;
      }
      const ok = await ecrireNotification(admin, {
        agencyId,
        profileId: directeur.id,
        type: 'mandat_60_jours',
        titre: titreMandat60Jours(mandatsVieux),
        corps: 'Télémétrie — les échéances restent sur l’Accueil.',
        lien: lienNotification('mandat_60_jours'),
        groupeCle,
      });
      if (ok) ecrites += 1;
    }
  }

  return ecrites;
}

export async function genererAnniversaires(
  admin: Admin,
  agencyId: string,
  now = new Date(),
): Promise<number> {
  const [anniversaires, membres] = await Promise.all([
    fetchAnniversairesDuJour(admin, agencyId, now),
    membresAgence(admin, agencyId),
  ]);
  if (anniversaires.length === 0) return 0;

  const aujourdHui = dateKeyParis(now);
  const depuisIso = debutJourParisIso(now);
  let ecrites = 0;

  for (const fete of anniversaires) {
    const groupeCle = `anniversaire:${aujourdHui}:${fete.profileId}`;
    for (const membre of membres) {
      if (membre.id === fete.profileId) continue;
      if (
        await notificationDejaEmise(admin, {
          agencyId,
          profileId: membre.id,
          groupeCle,
          depuisIso,
        })
      ) {
        continue;
      }
      const ok = await ecrireNotification(admin, {
        agencyId,
        profileId: membre.id,
        type: 'anniversaire',
        titre: titreAnniversaire(fete.firstName),
        corps: 'Visible uniquement parce que la date a été partagée.',
        lien: lienNotification('anniversaire', fete.profileId),
        entiteType: 'profil',
        entiteId: fete.profileId,
        groupeCle,
      });
      if (ok) ecrites += 1;
    }
  }

  return ecrites;
}

export async function genererNotificationsQuotidiennes(
  admin: Admin,
  now = new Date(),
): Promise<{ purgees: number; ecrites: number }> {
  const purgees = await purgerNotificationsLues(admin, now);
  const { data: agencies, error } = await admin.from('agencies').select('id');
  if (error) {
    console.error('[notifications] agences', error.message);
    return { purgees, ecrites: 0 };
  }

  const lundi = dateKeyParis(now) === mondayOf(now);
  let ecrites = 0;
  for (const agency of agencies ?? []) {
    const agencyId = agency.id as string;
    if (lundi) ecrites += await genererLeadsLivres(admin, agencyId, now);
    ecrites += await genererAnniversaires(admin, agencyId, now);
    ecrites += await genererAlertesDirecteur(admin, agencyId, now);
  }
  return { purgees, ecrites };
}
