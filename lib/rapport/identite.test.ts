import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  construirePied,
  joindreSansVide,
  ligneAgentPied,
  ligneBienPied,
  nomAgentAffiche,
  nomCommercialAgence,
} from './identite';

describe('pied de rapport — aucun libellé orphelin', () => {
  it('n’écrit pas une ligne d’agent si tout manque', () => {
    assert.equal(ligneAgentPied({ nom: null, email: null, telephone: null, photoUrl: null }), null);
    assert.equal(ligneAgentPied({ nom: '  ', email: '', telephone: null, photoUrl: null }), null);
  });

  it('n’aligne que les champs présents', () => {
    assert.equal(
      ligneAgentPied({ nom: 'Marie Durand', email: null, telephone: '06 12 34 56 78', photoUrl: null }),
      'Marie Durand · 06 12 34 56 78',
    );
    assert.equal(
      ligneAgentPied({ nom: null, email: 'marie@agence.fr', telephone: null, photoUrl: null }),
      'marie@agence.fr',
    );
  });

  it('n’écrit jamais « Propriété de , »', () => {
    assert.equal(ligneBienPied({ adresse: null, ville: null }), null);
    assert.equal(ligneBienPied({ adresse: '  ', ville: '' }), null);
    assert.equal(ligneBienPied({ adresse: null, ville: 'Nantes' }), 'Nantes');
    assert.equal(ligneBienPied({ adresse: '12 rue de la Paix', ville: 'Nantes' }), '12 rue de la Paix, Nantes');
    assert.doesNotMatch(ligneBienPied({ adresse: '', ville: 'Nantes' }) ?? '', /Propriété/);
    assert.doesNotMatch(joindreSansVide(['', null, 'Nantes'], ', ') ?? '', /^,/);
  });

  it('construit un pied sans trous', () => {
    const pied = construirePied({
      agent: { nom: 'Marie Durand', email: null, telephone: null, photoUrl: null },
      bien: { adresse: null, ville: null },
      dateIso: '2026-09-19',
      page: 2,
      pages: 5,
      maintenant: new Date('2026-09-19T10:00:00Z'),
    });
    assert.equal(pied.agent, 'Marie Durand');
    assert.equal(pied.bien, null);
    assert.ok(pied.date);
    assert.equal(pied.page, '2 / 5');
  });

  it('prend le nom commercial s’il existe', () => {
    assert.equal(nomCommercialAgence('SARL Dupont', 'Agence Dupont'), 'Agence Dupont');
    assert.equal(nomCommercialAgence('SARL Dupont', null), 'SARL Dupont');
    assert.equal(nomAgentAffiche('Marie', 'Durand'), 'Marie Durand');
    assert.equal(nomAgentAffiche(null, 'Durand'), 'Durand');
  });
});
