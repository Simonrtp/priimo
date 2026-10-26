import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cibleAffichee, diametreCiblePx, hrefCarte, lireCibleUrl, ZOOM_NOM_CIBLE, type CibleCarte } from './cible';
import { ressembleAdresse, ressembleQuestion } from '@/lib/assistant/intention-recherche';

describe('aller sur la carte', () => {
  it('l’adresse voyage dans l’URL de la carte et se relit', () => {
    const href = hrefCarte({ latitude: 48.872345, longitude: 2.383921, libelle: '148 Rue de Belleville', banId: '75120_0835_00148' });
    const url = new URL(href, 'http://x');
    assert.equal(url.pathname, '/dashboard/prospection');
    assert.equal(url.searchParams.get('vue'), 'carte');
    const cible = lireCibleUrl(url.searchParams);
    assert.equal(cible?.libelle, '148 Rue de Belleville');
    assert.equal(cible?.banId, '75120_0835_00148');
    assert.equal(cible?.latitude, 48.872345);
  });

  it('refuse une position absurde ou absente', () => {
    assert.equal(lireCibleUrl(new URLSearchParams('aller=200,2')), null);
    assert.equal(lireCibleUrl(new URLSearchParams('aller=abc')), null);
    assert.equal(lireCibleUrl(new URLSearchParams('')), null);
  });

  it('le point change de taille avec le zoom, sans disparaître', () => {
    assert.equal(diametreCiblePx(12), 6);
    assert.equal(diametreCiblePx(14), 8);
    assert.equal(diametreCiblePx(17.5), 14);
    assert.equal(diametreCiblePx(19), 24);
    assert.equal(diametreCiblePx(22), 24);
    assert.ok(diametreCiblePx(16) > diametreCiblePx(14));
    assert.ok(diametreCiblePx(18) > diametreCiblePx(17.5));
    assert.ok(ZOOM_NOM_CIBLE < 17.5);
  });

  it('un oubli retire le repère, y compris celui venu de l’URL', () => {
    const demandee: CibleCarte = {
      latitude: 48.87,
      longitude: 2.38,
      libelle: '12 Rue de la Paix',
      banId: null,
      cle: '1',
    };
    const depuisUrl: CibleCarte = { ...demandee, cle: 'url:48.870000,2.380000' };
    assert.equal(cibleAffichee(demandee, depuisUrl, false)?.libelle, '12 Rue de la Paix');
    assert.equal(cibleAffichee(null, depuisUrl, false)?.cle, 'url:48.870000,2.380000');
    assert.equal(cibleAffichee(null, depuisUrl, true), null);
    assert.equal(cibleAffichee(demandee, depuisUrl, true), null);
  });
});

describe('ce que l’agent tape', () => {
  it('reconnaît une adresse', () => {
    assert.equal(ressembleAdresse('12 rue des pyr'), true);
    assert.equal(ressembleAdresse('avenue gambetta'), true);
    assert.equal(ressembleAdresse('Janine Bertin'), false);
  });

  it('reconnaît une question', () => {
    assert.equal(ressembleQuestion('qui cherche un T3 dans le 20e ?'), true);
    assert.equal(ressembleQuestion("qu'est-ce qu'on sait sur le 12 rue des Pyrénées"), true);
    assert.equal(ressembleQuestion('Bertin'), false);
  });
});
