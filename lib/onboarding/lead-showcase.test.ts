import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isOnboardingShowcaseLead,
  leadShowcasePourOnboarding,
  ONBOARDING_SHOWCASE_ID,
} from './lead-showcase';

describe('leadShowcasePourOnboarding', () => {
  it('retourne une fiche chargée même sans lead réel', () => {
    const [lead] = leadShowcasePourOnboarding(['75020']);
    assert.ok(lead);
    assert.equal(lead.score, 93);
    assert.equal(lead.horsMarche, true);
    assert.ok(lead.faits.length >= 5);
    assert.match(lead.address, /75020/);
    assert.match(lead.accroche ?? '', /SCI Fradan/i);
    assert.equal(lead.id, ONBOARDING_SHOWCASE_ID);
  });

  it('réutilise l’id d’un lead libre mais garde les signaux showcase', () => {
    const [lead] = leadShowcasePourOnboarding(['75020'], [
      {
        id: 'real-lead-1',
        address: '51 rue Paul Meurice 75020 Paris',
        city: 'Paris',
        postalCode: '75020',
        score: 81,
        assignedTo: null,
        stageId: null,
        mainSignalLabel: 'dissolution',
        propertyType: 'Appartement',
        surfaceM2: 65,
      } as never,
    ]);
    assert.equal(lead.id, 'real-lead-1');
    assert.equal(lead.address, '51 rue Paul Meurice 75020 Paris');
    assert.equal(lead.score, 93);
    assert.ok(lead.faits.some((f) => /Succession/i.test(f)));
    assert.ok(!lead.faits.some((f) => /dissolution/i.test(f)));
  });
});

describe('isOnboardingShowcaseLead', () => {
  it('détecte les ids synthétiques', () => {
    assert.equal(isOnboardingShowcaseLead(ONBOARDING_SHOWCASE_ID), true);
    assert.equal(isOnboardingShowcaseLead(`${ONBOARDING_SHOWCASE_ID}-1`), true);
    assert.equal(isOnboardingShowcaseLead('real-lead-1'), false);
  });
});
