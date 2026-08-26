/**
 * Liste blanche domaines + garde-fou confidentialité Gmail.
 * Priimo ne lit JAMAIS un message hors de cette liste.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { domainFromAddress } from './parsers';

export async function loadAllowedDomains(
  admin: SupabaseClient,
  agencyId: string,
): Promise<Set<string>> {
  const { data } = await admin
    .from('portail_email_domaines')
    .select('domaine, agency_id')
    .eq('actif', true)
    .or(`agency_id.is.null,agency_id.eq.${agencyId}`);

  const set = new Set<string>();
  for (const row of data ?? []) {
    const d = (row.domaine ?? '').trim().toLowerCase();
    if (d) set.add(d);
  }
  return set;
}

export function isSenderAllowed(fromAddress: string, allowed: Set<string>): boolean {
  const domain = domainFromAddress(fromAddress);
  if (!domain) return false;
  if (allowed.has(domain)) return true;
  // sous-domaine : mail.seloger.com si seloger.com est whitelisté
  for (const d of allowed) {
    if (domain === d || domain.endsWith(`.${d}`)) return true;
  }
  return false;
}

/**
 * Filtre une notification Gmail : si l'expéditeur n'est pas whitelisté,
 * on jette sans lire le corps (l'appelant ne doit pas fetch le message).
 */
export function assertWhitelistedOrDrop(
  fromAddress: string,
  allowed: Set<string>,
): { allowed: true; domain: string } | { allowed: false } {
  const domain = domainFromAddress(fromAddress);
  if (!domain || !isSenderAllowed(fromAddress, allowed)) {
    return { allowed: false };
  }
  return { allowed: true, domain };
}
