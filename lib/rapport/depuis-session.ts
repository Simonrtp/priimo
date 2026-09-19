import type { AgencyRow, ContextualProfile } from '@/types/database';
import { formatPhoneDisplay } from '@/lib/import/normalize';
import {
  nomAgentAffiche,
  nomCommercialAgence,
  type IdentiteAgenceRapport,
  type IdentiteAgentRapport,
  type PiedBienRapport,
} from '@/lib/rapport/identite';
import { signerCheminRapport } from '@/lib/rapport/storage';

export async function identiteAgenceDepuisRow(
  agency: AgencyRow,
): Promise<IdentiteAgenceRapport> {
  return {
    nom: agency.name,
    nomCommercial: nomCommercialAgence(agency.name, agency.nom_commercial),
    adresse: agency.address?.trim() || null,
    telephone: agency.phone ? formatPhoneDisplay(agency.phone) : null,
    email: agency.email?.trim() || null,
    siteWeb: agency.site_web?.trim() || null,
    logoUrl: await signerCheminRapport(agency.logo_path),
  };
}

export function identiteAgentDepuisProfil(
  profile: ContextualProfile,
  loginEmail: string,
): IdentiteAgentRapport {
  const email = profile.email_pro?.trim() || loginEmail.trim() || null;
  return {
    nom: nomAgentAffiche(profile.first_name, profile.last_name),
    email,
    telephone: profile.phone ? formatPhoneDisplay(profile.phone) : null,
    photoUrl: profile.avatar_url ?? null,
  };
}

export function piedBienDepuisEstimation(e: {
  address: string | null;
  city: string | null;
}): PiedBienRapport {
  return {
    adresse: e.address?.trim() || null,
    ville: e.city?.trim() || null,
  };
}
