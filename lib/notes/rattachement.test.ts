import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ancrageParcelle,
  estRattachee,
  hrefImmeuble,
  hrefParcelle,
  hrefRattachement,
  lirePosCarte,
  idsParType,
  libelleParcelle,
  nomContact,
  syntheseRattachement,
} from './rattachement';

describe('rattachement d’une note', () => {
  it('compose le nom d’un contact', () => {
    assert.equal(nomContact('Gérard', 'René'), 'Gérard René');
    assert.equal(nomContact('Gérard', ''), 'Gérard');
    assert.equal(nomContact(null, null), 'Contact');
  });

  it('envoie chaque rattachement à sa fiche', () => {
    assert.equal(hrefRattachement('contact', 'c1'), '/dashboard/contacts?fiche=c1');
    assert.equal(hrefRattachement('bien', 'b1'), '/dashboard/biens?fiche=b1');
    assert.equal(hrefRattachement('lead', 'l1'), '/dashboard/prospection?lead=l1');
    assert.equal(hrefParcelle('75120000BN0208'), '/dashboard/prospection?vue=carte&parcelle=75120000BN0208');
    const immeuble = hrefImmeuble('75120_0835', {
      latitude: 48.85,
      longitude: 2.4,
      libelle: '36 Rue Alphonse Penaud',
    });
    const url = new URL(immeuble, 'http://x');
    assert.equal(url.searchParams.get('immeuble'), '75120_0835');
    assert.equal(url.searchParams.get('vue'), 'carte');
    assert.equal(url.searchParams.get('pos'), '48.850000,2.400000');
    assert.equal(url.searchParams.get('libelle'), '36 Rue Alphonse Penaud');
    assert.equal(lirePosCarte('48.850000,2.400000')?.latitude, 48.85);
    assert.equal(lirePosCarte('200,2'), null);
  });

  it('espace la référence cadastrale', () => {
    assert.equal(libelleParcelle('75120000BN0208'), 'Parcelle 75120 000 BN 0208');
  });

  it('nomme le lieu : adresse d’abord, parcelle en dessous', () => {
    assert.deepEqual(ancrageParcelle('75120000BN0208', '6 avenue Crampel'), {
      titre: '6 avenue Crampel',
      detail: 'Parcelle 75120 000 BN 0208',
    });
    assert.deepEqual(ancrageParcelle('75120000BN0208', ''), {
      titre: 'Parcelle 75120 000 BN 0208',
      detail: null,
    });
    assert.equal(ancrageParcelle(null, '6 avenue Crampel'), null);
  });

  it('fusionne le contact_id avec les liens, sans doublon', () => {
    const parType = idsParType(
      [
        { entiteType: 'contact', entiteId: 'c1' },
        { entiteType: 'parcelle', entiteId: '75120000BN0208' },
      ],
      'c1',
    );
    assert.deepEqual(parType.get('contact'), ['c1']);
    assert.deepEqual(parType.get('parcelle'), ['75120000BN0208']);
  });

  it('dit clairement qu’une note n’est liée à rien', () => {
    assert.equal(estRattachee([]), false);
    assert.equal(syntheseRattachement([]), null);
    assert.equal(
      syntheseRattachement([{ type: 'contact', id: 'c1', label: 'Gérard René', href: null }]),
      'Gérard René',
    );
  });
});
