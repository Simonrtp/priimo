import { formatPct, formatSurface } from '@/lib/rapport/genere/format';

export function phraseSecteur(input: {
  commune: string | null;
  partAppartements: number | null;
  piecesDominant: number | null;
  epoque: string | null;
  partProprietaires: number | null;
  partLocataires: number | null;
}): string | null {
  const bits: string[] = [];
  if (input.partAppartements != null) {
    bits.push(`${formatPct(input.partAppartements)} d’appartements`);
  }
  if (input.piecesDominant != null) {
    bits.push(
      `les logements de ${input.piecesDominant} pièce${input.piecesDominant > 1 ? 's' : ''} y sont les plus fréquents`,
    );
  }
  if (input.epoque) {
    bits.push(`construits pour l’essentiel entre ${input.epoque}`);
  }
  if (bits.length === 0) return null;
  const lieu = input.commune?.trim() ? `Dans ce secteur de ${input.commune.trim()}, ` : 'Dans ce secteur, ';
  let texte = `${lieu}${bits[0]}`;
  if (bits[1]) texte += `, ${bits[1]}`;
  if (bits[2]) texte += `, ${bits[2]}`;
  texte += '.';
  if (input.partProprietaires != null && input.partLocataires != null) {
    texte += ` ${formatPct(input.partProprietaires)} des ménages sont propriétaires, ${formatPct(input.partLocataires)} locataires.`;
  } else if (input.partProprietaires != null) {
    texte += ` ${formatPct(input.partProprietaires)} des ménages sont propriétaires.`;
  } else if (input.partLocataires != null) {
    texte += ` ${formatPct(input.partLocataires)} des ménages sont locataires.`;
  }
  return texte;
}

export function phrasePointsInteret(input: {
  categories: Array<{ categorie: string; count: number; plusProcheM: number }>;
}): string | null {
  if (input.categories.length === 0) return null;
  const lib: Record<string, string> = {
    administration: 'administratifs',
    enseignement: 'd’enseignement',
    transports: 'de transport',
    sante: 'de santé',
  };
  const parts = input.categories.map((c) => {
    const nom = lib[c.categorie] ?? c.categorie;
    return `${c.count} équipement${c.count > 1 ? 's' : ''} ${nom} (le plus proche à ${c.plusProcheM} m)`;
  });
  if (parts.length === 1) return `À proximité : ${parts[0]}.`;
  return `À proximité : ${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}.`;
}

export function phraseComparaisonSecteur(input: {
  typeMajoritaire: string | null;
  piecesDominant: number | null;
  epoque: string | null;
}): string | null {
  const bits: string[] = [];
  if (input.typeMajoritaire) bits.push(`le type majoritaire est le ${input.typeMajoritaire.toLowerCase()}`);
  if (input.piecesDominant != null) {
    bits.push(`${input.piecesDominant} pièce${input.piecesDominant > 1 ? 's' : ''}`);
  }
  if (input.epoque) bits.push(`époque ${input.epoque}`);
  if (bits.length === 0) return null;
  return `Dans le secteur, ${bits.join(', ')}.`;
}

export function phraseCriteresConcurrentiels(input: {
  propertyType: 'appartement' | 'maison' | null;
  postalCode: string | null;
}): string | null {
  const bits: string[] = [];
  if (input.postalCode?.trim()) bits.push(`code postal ${input.postalCode.trim()}`);
  if (input.propertyType === 'maison') bits.push('maisons');
  if (input.propertyType === 'appartement') bits.push('appartements');
  if (bits.length === 0) return null;
  return `Critères retenus : annonces actives, ${bits.join(', ')}.`;
}

export function phrasePerimetreConcurrentiel(input: {
  count: number;
  surfaceMoyenne: number | null;
  prixMoyen: number | null;
}): string {
  const n = `${input.count} annonce${input.count > 1 ? 's' : ''} active${input.count > 1 ? 's' : ''}`;
  const extra: string[] = [];
  if (input.surfaceMoyenne != null) extra.push(`surface moyenne ${formatSurface(input.surfaceMoyenne)}`);
  if (input.prixMoyen != null) {
    extra.push(
      `prix moyen ${input.prixMoyen.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`,
    );
  }
  return extra.length > 0 ? `${n} retenues — ${extra.join(', ')}.` : `${n} retenues.`;
}

export function phraseEffortAchat(input: {
  secteur: number;
  departement: number | null;
  france: number | null;
}): string {
  let t = `Il faut ${input.secteur.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} années de revenu médian pour acheter un bien médian dans ce secteur`;
  if (input.departement != null) {
    t += `, contre ${input.departement.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} dans le département`;
  }
  if (input.france != null) {
    t += ` et ${input.france.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} en France`;
  }
  return `${t}.`;
}
