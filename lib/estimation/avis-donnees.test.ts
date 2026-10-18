import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { codeCommuneInsee } from '@/lib/rapport/code-commune';
import { estFourchetteInventee, fourchetteReelle } from '@/lib/rapport/genere/fourchette';
import { classerElement, noteProximite } from '@/lib/rapport/services-osm';
import { confianceComparables } from './confiance-comparables';
import { expliquerHorsCouverture, raisonHorsCouverture } from './couverture-secteur';
import { libelleOrigineDpe, origineDpe } from './dpe-origine';
import { parsePrestations, prestationsRenseignees } from './prestations';

describe('couverture du moteur', () => {
  it('explique un département non chargé et un département absent du DVF', () => {
    assert.equal(raisonHorsCouverture('75020'), null);
    assert.equal(raisonHorsCouverture('33000'), 'non_charge');
    assert.match(expliquerHorsCouverture('33000').texte, /non chargé|pas encore chargées/i);
    assert.equal(raisonHorsCouverture('67000'), 'absent_dvf');
    assert.match(expliquerHorsCouverture('67000').texte, /Alsace-Moselle/);
    assert.equal(raisonHorsCouverture('97600'), 'absent_dvf');
  });
});

describe('confiance des comparables', () => {
  it('dit quand les ventes sont peu nombreuses', () => {
    const c = confianceComparables([400000, 420000]);
    assert.ok(c);
    assert.equal(c!.niveau, 'faible');
    assert.match(c!.message, /Peu de ventes/);
    assert.equal(c!.dispersion, null);
  });

  it('signale des prix peu comparables', () => {
    const c = confianceComparables([200000, 210000, 220000, 900000, 950000, 980000]);
    assert.ok(c);
    assert.ok(c!.dispersion != null && c!.dispersion >= 0.35);
    assert.match(c!.message, /peu comparables/);
  });
});

describe('DPE réel ou estimé', () => {
  it('ne prend pas le DPE d’immeuble pour un appartement', () => {
    assert.equal(
      origineDpe({
        dpeClass: 'D',
        propertyType: 'appartement',
        declaree: null,
        sourceContexte: 'ademe',
      }),
      'estime',
    );
    assert.equal(
      origineDpe({
        dpeClass: 'D',
        propertyType: 'maison',
        declaree: null,
        sourceContexte: 'ademe',
      }),
      'reel',
    );
    assert.equal(libelleOrigineDpe('reel'), 'DPE réel, trouvé à l’adresse');
    assert.equal(libelleOrigineDpe('estime'), 'DPE estimé');
  });
});

describe('prestations', () => {
  it('ignore une qualité inconnue et ne retient que les postes saisis', () => {
    const saisie = parsePrestations({
      cuisine: { qualite: 'Soignée', etat: 'Bon' },
      sol: { qualite: 'inventé', etat: 'Moyen' },
    });
    const lignes = prestationsRenseignees(saisie);
    assert.equal(lignes.length, 2);
    assert.equal(saisie.cuisine.qualite, 'Soignée');
    assert.equal(saisie.sol.qualite, null);
    assert.equal(saisie.sol.etat, 'Moyen');
  });
});

describe('fourchette réelle', () => {
  it('refuse le ±8 % posé à la place des ventes', () => {
    assert.equal(estFourchetteInventee(500000, 460000, 540000), true);
    assert.equal(fourchetteReelle(500000, 460000, 540000), null);
    assert.equal(fourchetteReelle(546000, 502320, 589680), null);
    assert.deepEqual(fourchetteReelle(500000, 450000, 560000), { low: 450000, high: 560000 });
    assert.equal(fourchetteReelle(500000, null, 560000), null);
  });
});

describe('code commune INSEE', () => {
  it('prend l’arrondissement dans les 5 premiers caractères de la parcelle', () => {
    assert.equal(codeCommuneInsee({ parcelleId: '75120000AB0001' }), '75120');
    assert.equal(codeCommuneInsee({ parcelleId: null, postalCode: '75020' }), '75120');
    assert.equal(codeCommuneInsee({ parcelleId: '2A004000AB', postalCode: '20000' }), '2A004');
  });
});

describe('note des services OSM', () => {
  it('note le plus proche selon les seuils écrits', () => {
    assert.equal(noteProximite(180), 5);
    assert.equal(noteProximite(400), 4);
    assert.equal(noteProximite(701), 2);
    assert.equal(noteProximite(null), null);
    assert.equal(classerElement({ shop: 'bakery' }), 'commerces');
    assert.equal(classerElement({ amenity: 'pharmacy' }), 'sante');
    assert.equal(classerElement({ amenity: 'school' }), 'education');
    assert.equal(classerElement({ amenity: 'restaurant' }), 'restaurants');
    assert.equal(classerElement({ leisure: 'park' }), 'loisirs');
    assert.equal(classerElement({ amenity: 'bench' }), null);
  });
});
