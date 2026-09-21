import type { EtapeAtelierId } from '@/lib/estimation/etapes';
import type { KindGeneree } from '@/lib/rapport/modele-defaut';
import { LIBELLE_KIND_GENEREE } from '@/lib/rapport/modele-defaut';
import type { ContradictionRapport } from '@/lib/rapport/genere/contradictions';

export type ManqueEnvoiId = string;

export type ManqueEnvoi = {
  id: ManqueEnvoiId;
  label: string;
  etape: EtapeAtelierId;
};

export function manquesAvantEnvoi(input: {
  priceValue: number | null;
  photos: number;
  contactEmail: string | null;
  pages: number;
  pagesIncompletes?: Array<{ kind: KindGeneree; manques: string[] }>;
  contradictions?: ContradictionRapport[];
}): ManqueEnvoi[] {
  const out: ManqueEnvoi[] = [];
  if (input.priceValue == null) {
    out.push({ id: 'prix', label: 'Prix non renseigné', etape: 'estimation' });
  }
  if (input.photos < 1) {
    out.push({ id: 'photos', label: 'Aucune photo du bien', etape: 'bien' });
  }
  if (!input.contactEmail?.trim()) {
    out.push({ id: 'email', label: 'Pas d’e-mail client', etape: 'client' });
  }
  if (input.pages < 1) {
    out.push({ id: 'pages', label: 'Rapport sans page', etape: 'rapport' });
  }
  for (const p of input.pagesIncompletes ?? []) {
    out.push({
      id: `page:${p.kind}`,
      label: `${LIBELLE_KIND_GENEREE[p.kind]} incomplète — ${p.manques.join(', ')}`,
      etape: etapePourKind(p.kind),
    });
  }
  for (const c of input.contradictions ?? []) {
    out.push({ id: `contradiction:${c.id}`, label: c.label, etape: 'bien' });
  }
  return out;
}

function etapePourKind(kind: KindGeneree): EtapeAtelierId {
  if (kind === 'votre_bien') return 'client';
  if (kind === 'prix' || kind === 'comparables' || kind === 'concurrentiel') return 'estimation';
  if (kind === 'description' || kind === 'immeuble_appartement' || kind === 'couverture') return 'bien';
  return 'rapport';
}
