/** Affichage propriétaire / société — casse normale, anti-doublon, rôles raccourcis. */

const LEGAL_FORMS =
  /\b(sci|sas|sarl|sa|eurl|sasu|snc|sc|sccv|selarl|selas|scop|scm)\b/gi;

/** Met en casse titre française (mots et tirets), sans forcer les capitales. */
export function toDisplayPersonName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split('-')
        .map((part) => {
          if (!part) return part;
          return part.charAt(0).toLocaleUpperCase('fr') + part.slice(1).toLocaleLowerCase('fr');
        })
        .join('-'),
    )
    .join(' ');
}

/** Ensemble de tokens normalisés (accents, majuscules, formes juridiques retirées). */
export function normalizeNameTokenSet(raw: string): Set<string> {
  const cleaned = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(LEGAL_FORMS, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  return new Set(cleaned.split(/\s+/).filter(Boolean));
}

/** Vrai si les deux chaînes se ramènent au même ensemble de mots (ordre libre). */
export function namesShareSameTokenSet(a: string, b: string): boolean {
  const sa = normalizeNameTokenSet(a);
  const sb = normalizeNameTokenSet(b);
  if (sa.size === 0 || sb.size === 0 || sa.size !== sb.size) return false;
  for (const t of sa) {
    if (!sb.has(t)) return false;
  }
  return true;
}

/**
 * Raccourcit les libellés bruts Pappers pour l’affichage agent.
 * « Chef d'entreprise » est conservé tel quel.
 */
export function shortenOwnerRole(roleRaw: string): string {
  const role = roleRaw.trim();
  if (!role) return '';
  const lower = role.toLocaleLowerCase('fr');
  if (lower.includes('gérant') && (lower.includes('associé') || lower.includes('responsable'))) {
    return 'Gérante';
  }
  if (lower === "chef d'entreprise" || lower === 'chef d’entreprise') {
    return "Chef d'entreprise";
  }
  return toDisplayPersonName(role);
}

export type CallTarget = {
  /** Libellé principal (nom). */
  label: string;
  /** Étiquette courte (catégorie / rôle), optionnelle. */
  tag?: string;
  phone: string;
};

/** Numéros appelables pour la barre d’action (propriétaire + immeuble + société). */
export function collectLeadCallTargets(lead: {
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerCompany?: string | null;
  companyName?: string | null;
  companyPhone?: string | null;
  companyDirector?: string | null;
  contactsImmeuble?: Array<{
    companyName: string;
    phone: string;
    categorie: string;
  }>;
}): CallTarget[] {
  const targets: CallTarget[] = [];
  const seen = new Set<string>();

  const push = (phone: string | null | undefined, label: string, tag?: string) => {
    const p = phone?.trim();
    if (!p) return;
    const key = p.replace(/\s+/g, '');
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({ phone: p, label, tag });
  };

  const ownerLabel =
    (lead.ownerName?.trim() && toDisplayPersonName(lead.ownerName)) ||
    lead.ownerCompany?.trim() ||
    'Propriétaire';
  push(lead.ownerPhone, ownerLabel, 'Propriétaire');

  push(
    lead.companyPhone,
    (lead.companyDirector?.trim() && toDisplayPersonName(lead.companyDirector)) ||
      lead.companyName?.trim() ||
      'Société',
    'Société',
  );

  for (const c of lead.contactsImmeuble ?? []) {
    const cat =
      c.categorie === 'commerce'
        ? 'Commerce'
        : c.categorie === 'domicile_pro'
          ? 'Résident'
          : 'Société';
    push(c.phone, c.companyName, cat);
  }

  return targets;
}
