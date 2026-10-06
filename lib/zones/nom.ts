/**
 * Le nom d'un secteur dit d'abord à qui il est : « Secteur de Camille ».
 * Trié par nom, l'écran des secteurs se range alors par négociateur, et le
 * directeur s'y retrouve sans ouvrir chaque zone.
 */

const SANS_TITULAIRE = 'Nouveau secteur';
const PRENOM_MAX = 40;

export function prenomDuMembre(
  membre: { firstName?: string | null; fullName?: string | null } | null | undefined,
): string | null {
  const prenom =
    membre?.firstName?.trim() || membre?.fullName?.trim().split(/\s+/)[0] || '';
  return prenom ? prenom.slice(0, PRENOM_MAX) : null;
}

function base(prenom: string | null): string {
  return prenom ? `Secteur de ${prenom}` : SANS_TITULAIRE;
}

function cle(nom: string): string {
  return nom.trim().toLocaleLowerCase('fr');
}

/** « Secteur de Camille », puis « Secteur de Camille 2 » si le nom est pris. */
export function nomSecteurParDefaut(prenom: string | null, nomsPris: readonly string[]): string {
  const pris = new Set(nomsPris.map(cle));
  const racine = base(prenom);
  if (!pris.has(cle(racine))) return racine;
  for (let i = 2; ; i += 1) {
    const candidat = `${racine} ${i}`;
    if (!pris.has(cle(candidat))) return candidat;
  }
}

/** Vrai tant que personne n'a retouché le nom donné d'office. */
export function estNomParDefaut(nom: string, prenom: string | null): boolean {
  const racine = cle(base(prenom));
  const n = cle(nom);
  if (n === racine) return true;
  if (!n.startsWith(`${racine} `)) return false;
  return /^\d+$/.test(n.slice(racine.length + 1));
}

/** Mes secteurs d'abord, puis l'ordre alphabétique (donc par négociateur). */
export function trierSecteurs<T extends { nom: string; assignedTo: string | null }>(
  zones: readonly T[],
  profileId: string,
): T[] {
  return [...zones].sort((a, b) => {
    const aMien = a.assignedTo === profileId ? 0 : 1;
    const bMien = b.assignedTo === profileId ? 0 : 1;
    if (aMien !== bMien) return aMien - bMien;
    return a.nom.localeCompare(b.nom, 'fr', { numeric: true, sensitivity: 'base' });
  });
}
