import type { AgencyRapportPageRow, EstimationRapportPageInsert } from '@/types/database';
import { estDisposition, normaliserContenu } from '@/lib/rapport/modele';
import { LIBELLE_KIND_GENEREE, type SlotModele } from '@/lib/rapport/modele-defaut';

export function lignesDepuisModele(input: {
  slots: readonly SlotModele[];
  biblio: readonly AgencyRapportPageRow[];
  estimationId: string;
  agencyId: string;
}): EstimationRapportPageInsert[] {
  const parId = new Map(input.biblio.map((p) => [p.id, p]));
  const out: EstimationRapportPageInsert[] = [];
  let position = 0;

  for (const slot of input.slots) {
    if (slot.source === 'generee') {
      out.push({
        estimation_id: input.estimationId,
        agency_id: input.agencyId,
        source: 'generee',
        bibliotheque_id: null,
        nom: LIBELLE_KIND_GENEREE[slot.kindGeneree],
        kind: 'generee',
        storage_path: null,
        mime_type: null,
        page_index: 0,
        position,
        disposition: null,
        contenu: { kind: slot.kindGeneree },
      });
      position += 1;
      continue;
    }

    const source = parId.get(slot.bibliothequeId);
    if (!source) continue;
    const modele = source.kind === 'modele';
    const count = Math.max(1, source.page_count);
    for (let i = 0; i < count; i += 1) {
      out.push({
        estimation_id: input.estimationId,
        agency_id: input.agencyId,
        source: 'bibliotheque',
        bibliotheque_id: source.id,
        nom: count > 1 ? `${source.nom} (${i + 1})` : source.nom,
        kind: source.kind,
        storage_path: source.storage_path,
        mime_type: source.mime_type,
        page_index: i,
        position,
        disposition: modele && estDisposition(source.disposition) ? source.disposition : null,
        contenu: modele ? normaliserContenu(source.contenu) : null,
      });
      position += 1;
    }
  }

  return out;
}
