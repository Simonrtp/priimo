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

/** Colonne 20260931 — accent du rapport. */
const AGENCIES_SELECT_COULEUR = 'couleur_principale';

/** Colonne 20260939 — seconde couleur de l’avis. */
const AGENCIES_SELECT_COULEUR2 = 'couleur_secondaire';

/** Colonne 20260953 — mention légale de l’avis (texte avocat). */
const AGENCIES_SELECT_MENTION = 'avis_mention_legale';

const AGENCIES_SELECT = `${AGENCIES_SELECT_BASE}, ${AGENCIES_SELECT_EXTRAS}, ${AGENCIES_SELECT_COULEUR}, ${AGENCIES_SELECT_COULEUR2}, ${AGENCIES_SELECT_MENTION}`;
const AGENCIES_SELECT_SANS_SECONDAIRE = `${AGENCIES_SELECT_BASE}, ${AGENCIES_SELECT_EXTRAS}, ${AGENCIES_SELECT_COULEUR}`;

/** La colonne 20260939 peut manquer tant que la migration n’est pas passée. */
let agenciesSelectAvecSecondaire = true;

const PROFILE_SELECT_BASE =
  'id, active_agency_id, first_name, last_name, phone, preferences, leads_last_seen_at, onboarding_completed_at, created_at, updated_at';

/** Colonnes 20260847 + 20260930 — chargées en best-effort (le login ne doit pas dépendre d’elles). */
const PROFILE_SELECT_EXTRAS =
  'birthday_month, birthday_day, birthday_visible_team, avatar_url, email_pro';

async function getServerUserUncached(): Promise<ServerUser> {
  return timed('getServerUser', async () => {
  const supabase = await timed('createSupabaseServerClient', () => createSupabaseServerClient());
  // Jeton vérifié en local (clés ES256 en cache) : pas d'aller-retour vers le
  // serveur d'auth. Le middleware a déjà rafraîchi la session.
  const { data: claimsData } = await timed('auth.getClaims', () => supabase.auth.getClaims());
  const claims = claimsData?.claims;
  if (!claims?.sub) return { user: null, profile: null, agency: null, memberships: [] };
  const user = { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' };

  // Les trois lectures partent ensemble. Les agences ne sont pas filtrées par
  // identifiant : la RLS ne rend que celles dont l'utilisateur est membre, et
  // seules les agences des rattachements sont retenues ensuite.
  const [profileRes, membershipRes, { data: agencies }] = await Promise.all([
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
    timed('agencies.select', async () => {
      const withBilling = await supabase
        .from('agencies')
        .select(
          (agenciesSelectAvecSecondaire
            ? AGENCIES_SELECT
            : AGENCIES_SELECT_SANS_SECONDAIRE) as typeof AGENCIES_SELECT_SANS_SECONDAIRE,
        );
      if (withBilling.error) {
        if (/couleur_secondaire|avis_mention_legale/.test(withBilling.error.message)) {
          agenciesSelectAvecSecondaire = false;
          const sansSecondaire = await supabase.from('agencies').select(AGENCIES_SELECT_SANS_SECONDAIRE);
          if (!sansSecondaire.error) return sansSecondaire;
        }
        console.error('[getServerUser] agencies.select', withBilling.error.message);
        const sansCouleur = await supabase
          .from('agencies')
          .select(`${AGENCIES_SELECT_BASE}, ${AGENCIES_SELECT_EXTRAS}`);
        if (!sansCouleur.error) return sansCouleur;
        const sansRapport = await supabase.from('agencies').select(AGENCIES_SELECT_BASE);
        if (!sansRapport.error) return sansRapport;
        return supabase
          .from('agencies')
          .select(
            'id, name, address, phone, email, plan, codes_postaux, latitude, longitude, stripe_customer_id, created_at, updated_at',
          );
      }
      return withBilling;
    }),
  ]);

  const profile = profileRes.data;
  if (!profile) {
    return { user, profile: null, agency: null, memberships: [] };
  }

  const rows = membershipRes.data ?? [];
  if (rows.length === 0) {
    return { user, profile: null, agency: null, memberships: [] };
  }

  const agencyList = (agencies ?? []) as AgencyRow[];

  const memberships = buildAgencyMemberships(rows, agencyList);
  const activeAgencyId = resolveActiveAgencyId(profile as ProfileRow, memberships);
  const activeRole = activeAgencyId ? resolveActiveRole(memberships, activeAgencyId) : null;

  if (!activeAgencyId || !activeRole) {
    return {
      user,
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
    user,
    profile: contextualProfile,
    agency,
    memberships,
  };
  });
}

/** Une fois par requête RSC : layout et page partagent le même résultat. */
export const getServerUser = cache(getServerUserUncached);
