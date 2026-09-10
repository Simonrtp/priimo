import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CYCLE_DEFAUT_JOURS,
  classerFraicheur,
  correspondFraicheur,
  cycleObserveJours,
  dernierPassageParAdresse,
  mentionDernierPassage,
  parseNiveauFraicheur,
  seuilRevoirJours,
} from './fraicheur';

const MOI = 'moi';
const LUNDI = new Date('2026-09-07T10:00:00Z');

function p(banId: string, jour: string, profileId = MOI) {
  return { banId, jour, profileId };
}

describe('cycle observé', () => {
  it('reprend le repli tant qu’il n’y a pas trois intervalles', () => {
    const c = cycleObserveJours(
      [p('a', '2026-01-01'), p('a', '2026-03-01'), p('b', '2026-02-01')],
      MOI,
    );
    assert.equal(c.observe, false);
    assert.equal(c.jours, CYCLE_DEFAUT_JOURS);
  });

  it('prend la médiane des intervalles dès trois retours', () => {
    // 28, 56, 84 jours → médiane 56.
    const c = cycleObserveJours(
      [
        p('a', '2026-01-01'),
        p('a', '2026-01-29'),
        p('b', '2026-01-01'),
        p('b', '2026-02-26'),
        p('c', '2026-01-01'),
        p('c', '2026-03-26'),
      ],
      MOI,
    );
    assert.equal(c.observe, true);
    assert.equal(c.jours, 56);
  });

  it('ignore les passages d’un collègue', () => {
    const c = cycleObserveJours(
      [
        p('a', '2026-01-01', 'autre'),
        p('a', '2026-01-29', 'autre'),
        p('b', '2026-01-01', 'autre'),
        p('b', '2026-02-26', 'autre'),
        p('c', '2026-01-01', 'autre'),
        p('c', '2026-03-26', 'autre'),
      ],
      MOI,
    );
    assert.equal(c.observe, false);
  });
});

describe('classement de fraîcheur', () => {
  it('classe jamais / semaine / cycle / à revoir', () => {
    assert.equal(classerFraicheur(null, LUNDI, 56), 'jamais');
    assert.equal(classerFraicheur('2026-09-04', LUNDI, 56), 'semaine');
    assert.equal(classerFraicheur('2026-08-01', LUNDI, 56), 'cycle');
    assert.equal(classerFraicheur('2026-06-01', LUNDI, 56), 'revoir');
  });

  it('place le seuil à une fois et demie le cycle', () => {
    assert.equal(seuilRevoirJours(56), 84);
  });
});

describe('dernier passage', () => {
  it('garde le plus récent par immeuble', () => {
    const m = dernierPassageParAdresse(
      [p('a', '2026-01-01'), p('a', '2026-03-01'), p('b', '2026-02-01')],
      MOI,
    );
    assert.equal(m.get('a'), '2026-03-01');
    assert.equal(m.get('b'), '2026-02-01');
  });
});

describe('mention de passage', () => {
  it('reste muette sans date ou trop récente', () => {
    assert.equal(mentionDernierPassage(null, LUNDI), null);
    assert.equal(mentionDernierPassage('2026-09-04', LUNDI), null);
  });

  it('écrit le nombre de semaines', () => {
    assert.equal(mentionDernierPassage('2026-06-01', LUNDI), 'Dernier passage il y a 14 semaines');
  });
});

describe('filtre de fraîcheur', () => {
  it('lit le paramètre et regroupe à revoir', () => {
    assert.equal(parseNiveauFraicheur('revoir'), 'revoir');
    assert.equal(parseNiveauFraicheur('autre'), null);
    assert.equal(correspondFraicheur('jamais', 'a-revoir'), true);
    assert.equal(correspondFraicheur('semaine', 'a-revoir'), false);
  });
});
