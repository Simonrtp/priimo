import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estRattachee,
  hrefRattachement,
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

  it('pointe les fiches de l’agence, pas la parcelle', () => {
    assert.equal(hrefRattachement('contact', 'c1'), '/dashboard/contacts?fiche=c1');
    assert.equal(hrefRattachement('parcelle', '75120000BN0208'), null);
  });

  it('espace la référence cadastrale', () => {
    assert.equal(libelleParcelle('75120000BN0208'), 'Parcelle 75120 000 BN 0208');
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
