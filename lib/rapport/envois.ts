import type { EstimationRapportEnvoiRow } from '@/types/database';

export type EnvoiRapport = {
  id: string;
  destinataire: string;
  version: number;
  envoyeAt: string;
  premierVuAt: string | null;
};

export function mapEnvoiRapport(row: Pick<
  EstimationRapportEnvoiRow,
  'id' | 'destinataire' | 'version' | 'envoye_at' | 'premier_vu_at'
>): EnvoiRapport {
  return {
    id: row.id,
    destinataire: row.destinataire,
    version: row.version,
    envoyeAt: row.envoye_at,
    premierVuAt: row.premier_vu_at,
  };
}

export function emailDestinataireValide(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
