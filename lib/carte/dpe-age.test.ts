import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_DPE_AGE_BUCKETS,
  dpeAgeBucketOf,
  dpeDetailQueryRange,
  dpeMatchesSelectedAges,
  isFreshMapDpe,
  needsDpeDetailRows,
  parseDpeAgeBuckets,
  parseDpeAgeParam,
  dpeAgeBucketsInSpan,
  dpeAgeIndexFromRatio,
  dpeAgeNearerHandle,
  dpeAgeRangePhrase,
  dpeAgeSpan,
  toDateParam,
} from './dpe-age';

describe('ancienneté DPE carte', () => {
  const now = new Date('2026-09-15T12:00:00.000Z');

  it('découpe toute la plage sans trou ni chevauchement', () => {
    assert.equal(dpeAgeBucketOf('2026-09-15', now), 'jours');
    assert.equal(dpeAgeBucketOf('2026-09-12', now), 'jours');
    assert.equal(dpeAgeBucketOf('2027-01-01', now), null);
    assert.equal(dpeAgeBucketOf('2026-09-10', now), 'semaine');
    assert.equal(dpeAgeBucketOf('2026-09-01', now), 'mois');
    assert.equal(dpeAgeBucketOf('2026-06-01', now), '1-6');
    assert.equal(dpeAgeBucketOf('2026-01-15', now), '6-12');
    assert.equal(dpeAgeBucketOf('2024-09-15', now), '1-3');
    assert.equal(dpeAgeBucketOf('2022-01-01', now), '3+');
  });

  it('classe un diagnostic du jour et des 3 derniers jours à part', () => {
    assert.equal(dpeAgeBucketOf('2026-09-15', now), 'jours');
    assert.equal(dpeAgeBucketOf('2026-09-13', now), 'jours');
    assert.equal(dpeAgeBucketOf('2026-09-11', now), 'semaine');
  });

  it('un diagnostic de moins de 6 mois est un point adresse', () => {
    assert.equal(isFreshMapDpe('2026-09-15', now), true);
    assert.equal(isFreshMapDpe('2026-04-01', now), true);
    assert.equal(isFreshMapDpe('2026-02-01', now), false);
    assert.equal(isFreshMapDpe(null, now), false);
  });

  it('filtre selon les cases cochées', () => {
    assert.equal(dpeMatchesSelectedAges('2026-09-14', ['jours'], now), true);
    assert.equal(dpeMatchesSelectedAges('2026-09-14', ['semaine'], now), false);
    assert.equal(dpeMatchesSelectedAges('2026-09-10', ['semaine'], now), true);
    assert.equal(dpeMatchesSelectedAges('2026-09-14', ['1-3'], now), false);
    assert.equal(dpeMatchesSelectedAges('2024-09-15', ['semaine', '1-3'], now), true);
    assert.equal(dpeMatchesSelectedAges('2026-09-14', [], now), false);
    assert.equal(dpeMatchesSelectedAges('2025-07-22', ['semaine'], now), false);
  });

  it('ne lit building_dpe que pour les cases hors agrégat 12 mois+', () => {
    assert.equal(needsDpeDetailRows(['1-3', '3+']), false);
    assert.equal(needsDpeDetailRows(['jours']), true);
    assert.equal(needsDpeDetailRows(['semaine']), true);
    assert.equal(needsDpeDetailRows(['6-12']), true);
  });

  it('borne la requête détail à la plus vieille case demandée', () => {
    const range = dpeDetailQueryRange(['semaine', '1-6'], now);
    assert.ok(range);
    const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 183);
    assert.equal(toDateParam(range.from), toDateParam(expected));
    assert.equal(needsDpeDetailRows(['3+']), false);
    assert.equal(dpeDetailQueryRange(['3+'], now), null);
  });

  it('convertit un curseur en cases continues', () => {
    assert.deepEqual(dpeAgeBucketsInSpan(0, 2), ['jours', 'semaine', 'mois']);
    assert.deepEqual(dpeAgeSpan(['mois', '6-12']), { from: 2, to: 4 });
    assert.deepEqual(dpeAgeSpan([]), { from: 0, to: 6 });
  });

  it('dit la plage en français', () => {
    assert.equal(dpeAgeRangePhrase(0, 6), 'Tous les DPE');
    assert.equal(dpeAgeRangePhrase(0, 0), '1 à 3 jours');
    assert.equal(dpeAgeRangePhrase(0, 3), '1 à 3 jours → 1 à 6 mois');
  });

  it('accroche le curseur le plus proche', () => {
    assert.equal(dpeAgeNearerHandle(0, 2, 5), 'from');
    assert.equal(dpeAgeNearerHandle(6, 2, 5), 'to');
    assert.equal(dpeAgeNearerHandle(3, 2, 5), 'from');
    assert.equal(dpeAgeNearerHandle(4, 2, 5), 'to');
    assert.equal(dpeAgeNearerHandle(2, 0, 0), 'to');
    assert.equal(dpeAgeIndexFromRatio(0), 0);
    assert.equal(dpeAgeIndexFromRatio(1), 6);
    assert.equal(dpeAgeIndexFromRatio(0.5), 3);
  });

  it('reprend toutes les cases si le stockage est vide', () => {
    assert.deepEqual(parseDpeAgeBuckets(undefined), [...DEFAULT_DPE_AGE_BUCKETS]);
    assert.deepEqual(parseDpeAgeParam('semaine,6-12'), ['semaine', '6-12']);
    assert.deepEqual(parseDpeAgeParam(''), []);
    assert.deepEqual(parseDpeAgeParam(null), [...DEFAULT_DPE_AGE_BUCKETS]);
    assert.deepEqual(parseDpeAgeBuckets(['nope', 'mois', 'mois']), ['mois']);
  });

  it('glisse l’ancienne plage complète vers la case 1–3 jours', () => {
    assert.deepEqual(
      parseDpeAgeBuckets(['semaine', 'mois', '1-6', '6-12', '1-3', '3+']),
      [...DEFAULT_DPE_AGE_BUCKETS],
    );
  });
});
