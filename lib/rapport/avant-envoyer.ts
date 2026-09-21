import type { EtapeAtelierId } from '@/lib/estimation/etapes';

export type ManqueEnvoiId = 'prix' | 'photos' | 'email' | 'pages';

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
  return out;
}
