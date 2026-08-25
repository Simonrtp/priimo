/**
 * Rendu structuré des lignes collectées. Sert de repli si la reformulation
 * échoue ou dépasse 8 secondes : les données existent, le style est un confort.
 */

import type { CollecteLigne, CollecteResult } from './collecte';

function ligneBrute(l: CollecteLigne): string {
  const bits: string[] = [];
  const faits = l.faits;
  for (const [k, v] of Object.entries(faits)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      bits.push(`${k} : ${v.map(String).join(', ')}`);
    } else {
      bits.push(`${k} : ${String(v)}`);
    }
  }
  const tete = [l.kind, l.date, l.auteur].filter(Boolean).join(' · ');
  return bits.length ? `${tete}\n${bits.join('\n')}` : tete;
}

export function formatBrut(result: CollecteResult): string {
  const parts: string[] = [];
  if (result.rechercheParTexte) {
    parts.push(
      "Recherche effectuée sur le texte de l'adresse, pas sur l'identifiant d'immeuble.",
    );
  }
  if (result.agregats) {
    const a = result.agregats;
    parts.push(
      `Période : ${a.periode_jours} jours. Contacts créés : ${a.contacts_crees}. Échanges : ${a.echanges}. Notes vocales : ${a.notes_vocales}. Biens créés : ${a.biens_crees}. Prospects détectés : ${a.leads_detectes}.`,
    );
  }
  for (const ligne of result.lignes) {
    parts.push(ligneBrute(ligne));
  }
  return parts.join('\n\n');
}
