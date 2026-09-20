import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { timed } from '@/lib/perf/timing';
import {
  buildAgencyMemberships,
  resolveActiveAgencyId,
  resolveActiveRole,
  type ProfileAgencyMembership,
} from '@/lib/auth/active-agency';
import type { AgencyRow, ContextualProfile, ProfileRow } from '@/types/database';

export interface ServerUser {
  user: { id: string; email: string } | null;
  profile: ContextualProfile | null;
  agency: AgencyRow | null;
  memberships: ProfileAgencyMembership[];
}

const AGENCIES_SELECT_BASE =
  'id, name, address, phone, email, plan, codes_postaux, latitude, longitude, stripe_customer_id, stripe_subscription_id, statut_abonnement, essai_fin_le, sieges_inclus, prix_base, prix_siege_supplementaire, demande_decision, frequence_passage_jours, created_at, updated_at';

/** Colonnes 20260930 — logo et identité de rapport. */
const AGENCIES_SELECT_EXTRAS = 'logo_path, nom_commercial, site_web';

/** Colonne 20260931 — accent du gabarit. */
const AGENCIES_SELECT_COULEUR = 'couleur_principale';

const AGENCIES_SELECT = `${AGENCIES_SELECT_BASE}, ${AGENCIES_SELECT_EXTRAS}, ${AGENCIES_SELECT_COULEUR}`;

const PROFILE_SELECT_BASE =
  'id, active_agency_id, first_name, last_name, phone, preferences, leads_last_seen_at, onboarding_completed_at, created_at, updated_at';

/** Colonnes 20260847 + 20260930 — chargées en best-effort (le login ne doit pas dépendre d’elles). */
const PROFILE_SELECT_EXTRAS =
  'birthday_month, birthday_day, birthday_visible_team, avatar_url, email_pro';

async function getServerUserUncached(): Promise<ServerUser> {
  return timed('getServerUser', async () => {
  const supabase = await timed('createSupabaseServerClient', () => createSupabaseServerClient());
  const {
    data: { user },
  } = await timed('auth.getUser', () => supabase.auth.getUser());
  if (!user) return { user: null, profile: null, agency: null, memberships: [] };

  const [profileRes, membershipRes] = await Promise.all([
    timed('profiles.select', async () => {
      const withExtras = await supabase
        .from('profiles')
        .select(`${PROFILE_SELECT_BASE}, ${PROFILE_SELECT_EXTRAS}`)
        .eq('id', user.id)
        .maybeSingle();
      // Migration 20260847 absente : la select complète échoue → profil de base seul.
      if (withExtras.error) {
        return supabase
          .from('profiles')
          .select(PROFILE_SELECT_BASE)
          .eq('id', user.id)
          .maybeSingle();
      }
      return withExtras;
    }),
    timed('profile_agencies.select', async () =>
      supabase.from('profile_agencies').select('agency_id, role').eq('profile_id', user.id),
    ),
  ]);

  const profile = profileRes.data;
  if (!profile) {
    return { user: { id: user.id, email: user.email ?? '' }, profile: null, agency: null, memberships: [] };
  }

  const rows = membershipRes.data ?? [];
  if (rows.length === 0) {
    return {
      user: { id: user.id, email: user.email ?? '' },
      profile: null,
      agency: null,
      memberships: [],
    };
  }

  const agencyIds = rows.map((r) => r.agency_id);
  const { data: agencies } = await timed('agencies.select', async () => {
    const withBilling = await supabase.from('agencies').select(AGENCIES_SELECT).in('id', agencyIds);
    if (withBilling.error) {
      console.error('[getServerUser] agencies.select', withBilling.error.message);
      const sansCouleur = await supabase
        .from('agencies')
        .select(`${AGENCIES_SELECT_BASE}, ${AGENCIES_SELECT_EXTRAS}`)
        .in('id', agencyIds);
      if (!sansCouleur.error) return sansCouleur;
      const sansRapport = await supabase
        .from('agencies')
        .select(AGENCIES_SELECT_BASE)
        .in('id', agencyIds);
      if (!sansRapport.error) return sansRapport;
      return supabase
        .from('agencies')
        .select(
          'id, name, address, phone, email, plan, codes_postaux, latitude, longitude, stripe_customer_id, created_at, updated_at',
        )
        .in('id', agencyIds);
    }
    return withBilling;
  });
  const agencyList = agencies ?? [];

  const memberships = buildAgencyMemberships(rows, agencyList);
  const activeAgencyId = resolveActiveAgencyId(profile as ProfileRow, memberships);
  const activeRole = activeAgencyId ? resolveActiveRole(memberships, activeAgencyId) : null;

  if (!activeAgencyId || !activeRole) {
    return {
      user: { id: user.id, email: user.email ?? '' },
      profile: null,
      agency: null,
      memberships,
    };
  }

  const agency = agencyList.find((a) => a.id === activeAgencyId) ?? null;
  const contextualProfile: ContextualProfile = {
    ...(profile as ProfileRow),
    role: activeRole,
  };

  return {
    user: { id: user.id, email: user.email ?? '' },
    profile: contextualProfile,
    agency,
    memberships,
  };
  });
}

/** Une fois par requête RSC : layout et page partagent le même résultat. */
export const getServerUser = cache(getServerUserUncached);
