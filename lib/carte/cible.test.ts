import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hrefCarte, lireCibleUrl } from './cible';
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
