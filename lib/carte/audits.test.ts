import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { regrouperAudits } from './audits';

describe('regrouperAudits', () => {
  it('fait un audit de ses scénarios : classe actuelle et meilleure classe visée', () => {
    const audits = regrouperAudits([
      { n_audit: 'A1', categorie_scenario: 'état initial', date_etablissement_audit: '2023-10-23', classe_bilan_dpe: 'F', typologie_logement: 'T3', surface_habitable_logement: 62, n_etage_appart: '4', identifiant_ban: 'b1' },
      { n_audit: 'A1', categorie_scenario: 'scénario multi étapes "principal"', date_etablissement_audit: '2023-10-23', classe_bilan_dpe: 'C' },
      { n_audit: 'A1', categorie_scenario: 'scénario en une étape "principal"', date_etablissement_audit: '2023-10-23', classe_bilan_dpe: 'A' },
      { n_audit: 'A2', categorie_scenario: 'état initial', date_etablissement_audit: '2025-02-01', classe_bilan_dpe: 'G', n_etage_appart: '0' },
    ]);
    assert.equal(audits.length, 2);
    assert.equal(audits[0]!.numero, 'A2');
    const a1 = audits[1]!;
    assert.equal(a1.classeActuelle, 'F');
    assert.equal(a1.classeVisee, 'A');
    assert.equal(a1.typologie, 'T3');
    assert.equal(a1.etage, 4);
    assert.equal(audits[0]!.etage, null);
  });

  it('ignore une classe visée qui n’améliore rien', () => {
    const [a] = regrouperAudits([
      { n_audit: 'A3', categorie_scenario: 'état initial', date_etablissement_audit: '2024-01-01', classe_bilan_dpe: 'C' },
      { n_audit: 'A3', categorie_scenario: 'scénario complémentaire 1', date_etablissement_audit: '2024-01-01', classe_bilan_dpe: 'D' },
    ]);
    assert.equal(a!.classeVisee, null);
  });
});
