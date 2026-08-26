import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PARCELLE_READ_QUERIES } from './parcelle';

const LIVE_SCHEMA: Record<string, readonly string[]> = {
  parcelle_adresses: ['parcelle_id', 'ban_id', 'source', 'created_at'],
  buildings: ['id', 'ban_id', 'adresse', 'adresse_normalisee', 'code_postal', 'commune', 'lat', 'lng', 'parcelle_id', 'updated_at'],
  building_transactions: [
    'id',
    'parcelle_id',
    'ban_id',
    'date_mutation',
    'valeur_fonciere',
    'surface_reelle_bati',
    'nombre_pieces',
    'type_local',
    'prix_m2',
    'source',
    'id_mutation',
    'created_at',
  ],
  building_dpe: [
    'id',
    'ban_id',
    'date_dpe',
    'etiquette_dpe',
    'etiquette_ges',
    'conso_kwh_m2_an',
    'surface',
    'etage',
    'source',
    'numero_dpe',
    'created_at',
  ],
  building_copro: [
    'id',
    'ban_id',
    'numero_immatriculation',
    'nombre_lots',
    'periode_construction',
    'procedure_en_cours',
    'date_maj',
    'source',
    'created_at',
  ],
  building_activity: [
    'ban_id',
    'nb_transactions_3ans',
    'nb_transactions_total',
    'derniere_transaction_le',
    'prix_m2_median',
    'nb_dpe_total',
    'dernier_dpe_le',
    'nb_passoires',
    'nb_lots',
    'procedure_copro',
    'activite_score',
    'calcule_le',
    'etiquette_dpe',
    'dernier_prix',
    'code_postal',
  ],
};

describe('PARCELLE_READ_QUERIES', () => {
  it('ne cible que des tables et colonnes du schéma live', () => {
    for (const spec of Object.values(PARCELLE_READ_QUERIES)) {
      const live = LIVE_SCHEMA[spec.table];
      assert.ok(live, `table inconnue ${spec.table}`);
      for (const col of spec.columns) {
        assert.ok(live.includes(col), `${spec.table}.${col} n'existe pas en base`);
      }
      assert.equal(
        spec.columns.includes('idu' as never),
        false,
        `${spec.table} ne doit pas lire idu`,
      );
    }
  });

  it('réserve les tables de détail à la fiche, pas à la couche', () => {
    assert.equal(PARCELLE_READ_QUERIES.dpe.when, 'fiche');
    assert.equal(PARCELLE_READ_QUERIES.transactions.when, 'fiche');
    assert.equal(PARCELLE_READ_QUERIES.copro.when, 'fiche');
    assert.equal(PARCELLE_READ_QUERIES.activity.when, 'couche');
  });
});
