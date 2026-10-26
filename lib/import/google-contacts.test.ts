import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GOOGLE_COLONNES, personneVersValeurs } from './google-contacts';
import { applyMapping, suggestMapping } from './mapping';
import { CONTACT_IMPORT_FIELDS, contactFieldsFromMapped } from './contacts';

describe('personneVersValeurs', () => {
  it('range une fiche Google dans les colonnes de l’import', () => {
    const valeurs = personneVersValeurs({
      names: [{ displayName: 'Marie Curie', givenName: 'Marie', familyName: 'Curie', metadata: { primary: true } }],
      phoneNumbers: [
        { value: '01 23 45 67 89', type: 'home' },
        { value: '06 12 34 56 78', canonicalForm: '+33612345678', type: 'mobile' },
      ],
      emailAddresses: [{ value: 'perso@x.fr' }, { value: 'marie@lab.fr', metadata: { primary: true } }],
      addresses: [{ streetAddress: '12 rue Cuvier', postalCode: '75005', city: 'Paris' }],
      organizations: [{ name: 'Institut du radium' }],
      biographies: [{ value: 'Cherche un T3' }],
    });
    assert.equal(valeurs['Prénom'], 'Marie');
    assert.equal(valeurs.Nom, 'Curie');
    assert.equal(valeurs['Nom complet'], '');
    assert.equal(valeurs['Téléphone'], '06 12 34 56 78');
    assert.equal(valeurs['Autre téléphone'], '01 23 45 67 89');
    assert.equal(valeurs.Email, 'marie@lab.fr');
    assert.equal(valeurs.Adresse, '12 rue Cuvier');
    assert.equal(valeurs['Code postal'], '75005');
    assert.equal(valeurs.Ville, 'Paris');
    assert.equal(valeurs.Notes, 'Société : Institut du radium\nAutres emails : perso@x.fr\nCherche un T3');
  });

  it('nomme par la société une fiche sans nom', () => {
    const valeurs = personneVersValeurs({
      organizations: [{ name: 'Plomberie Bernard' }],
      phoneNumbers: [{ canonicalForm: '+33645678901' }],
    });
    assert.equal(valeurs['Nom complet'], 'Plomberie Bernard');
    assert.equal(valeurs['Téléphone'], '+33645678901');
  });

  it('donne une fiche Priimo sans aucune correspondance à régler', () => {
    const mapping = suggestMapping([...GOOGLE_COLONNES], CONTACT_IMPORT_FIELDS);
    const valeurs = personneVersValeurs({
      names: [{ givenName: 'Amélie', familyName: 'Guérin' }],
      phoneNumbers: [{ canonicalForm: '+33623456789', type: 'mobile' }],
      addresses: [{ formattedValue: '8 rue Victor Hugo\n44000 Nantes\nFrance', postalCode: '44000', city: 'Nantes' }],
    });
    const lu = contactFieldsFromMapped(applyMapping(valeurs, mapping));
    assert.ok(!('error' in lu));
    if ('error' in lu) return;
    assert.equal(lu.fields.firstName, 'Amélie');
    assert.equal(lu.fields.lastName, 'Guérin');
    assert.equal(lu.fields.phone, '06 23 45 67 89');
    assert.equal(lu.fields.address, '8 rue Victor Hugo, Nantes');
    assert.deepEqual(lu.fields.postalCodes, ['44000']);
  });
});
