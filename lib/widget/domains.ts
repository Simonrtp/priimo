/**
 * Liste blanche des domaines autorisés à embarquer le widget d'une agence.
 *
 * Le contrôle qui compte est côté serveur, sur l'origine réelle de la requête
 * (en-tête Origin, à défaut Referer) : le paramètre envoyé par le script
 * d'intégration est déclaratif et ne prouve rien.
 */

/**
 * Ramène une saisie utilisateur à un hôte comparable :
 * « https://www.Agence.fr/estimation » → « agence.fr ».
 * Renvoie null si rien d'exploitable ne subsiste.
 */
export function normalizeDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.split(/[/?#]/, 1)[0] ?? '';
  value = value.replace(/^www\./, '');
  // Port : « agence.fr:3000 » → « agence.fr ». Les IPv6 littérales sont refusées.
  value = value.replace(/:\d+$/, '');
  value = value.replace(/\.$/, '');

  if (!value) return null;
  if (value === 'localhost') return 'localhost';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return value;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)) {
    return null;
  }
  return value;
}

/** Nettoie une liste saisie dans les paramètres : dédoublonnée, triée, sans vide. */
export function normalizeDomainList(raw: readonly string[]): string[] {
  const out = new Set<string>();
  for (const item of raw) {
    const domain = normalizeDomain(item);
    if (domain) out.add(domain);
  }
  return [...out].sort();
}

/** Hôte d'une URL d'origine (Origin, Referer). Null si l'URL est inexploitable. */
export function hostFromOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;
  const trimmed = origin.trim();
  if (!trimmed || trimmed === 'null') return null;
  try {
    return normalizeDomain(new URL(trimmed).host);
  } catch {
    return normalizeDomain(trimmed);
  }
}

/**
 * Un hôte est autorisé s'il figure dans la liste, ou s'il en est un
 * sous-domaine. « agence.fr » couvre « www.agence.fr » et « immo.agence.fr »,
 * jamais « agence.fr.pirate.com ».
 */
export function isDomainAllowed(
  host: string | null,
  allowed: readonly string[],
): boolean {
  if (!host || allowed.length === 0) return false;
  const normalizedHost = normalizeDomain(host);
  if (!normalizedHost) return false;
  return allowed.some((entry) => {
    const domain = normalizeDomain(entry);
    if (!domain) return false;
    return normalizedHost === domain || normalizedHost.endsWith(`.${domain}`);
  });
}

/**
 * Valeur de `frame-ancestors` : les domaines autorisés, en https, avec leurs
 * sous-domaines. Une liste vide donne 'none' — le widget n'est cadré nulle part.
 */
export function frameAncestorsValue(allowed: readonly string[]): string {
  const sources = new Set<string>();
  for (const entry of allowed) {
    const domain = normalizeDomain(entry);
    if (!domain) continue;
    if (domain === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) {
      sources.add(`http://${domain}:*`);
      sources.add(`https://${domain}:*`);
      continue;
    }
    sources.add(`https://${domain}`);
    sources.add(`https://*.${domain}`);
  }
  return sources.size === 0 ? "'none'" : [...sources].join(' ');
}
