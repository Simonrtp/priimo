import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { suggestMapping } from './mapping';
import {
  CONTACT_IMPORT_FIELDS,
  findContactDuplicate,
  interpretContactType,
  contactFieldsFromMapped,
  mergeContactFields,
  planContactImport,
} from './contacts';
import { findBienDuplicate, bienFieldsFromMapped } from './biens';
import { normalizePhone } from './normalize';

describe('suggestMapping', () => {
  it('associe mail et téléphone, ignore le reste', () => {
    const mapping = suggestMapping(
      ['Nom', 'e-mail', 'Portable', 'Couleur des yeux'],
      CONTACT_IMPORT_FIELDS,
    );
    assert.equal(mapping.lastName, 'Nom');
    assert.equal(mapping.email, 'e-mail');
    assert.equal(mapping.phone, 'Portable');
    assert.equal(mapping.firstName, '');
    assert.equal(mapping.secteur, '');
  });

  it('ne prend pas « nom » pour le nom complet', () => {
    const mapping = suggestMapping(['Nom', 'Nom complet'], CONTACT_IMPORT_FIELDS);
    assert.equal(mapping.lastName, 'Nom');
    assert.equal(mapping.fullName, 'Nom complet');
  });
});

describe('contactFieldsFromMapped', () => {
  it('découpe un nom complet si prénom et nom manquent', () => {
    const fields = contactFieldsFromMapped({ fullName: 'Marie Curie', email: 'marie@example.fr' });
    assert.ok(!('error' in fields));
    if ('error' in fields) return;
    assert.equal(fields.firstName, 'Marie');
    assert.equal(fields.lastName, 'Curie');
  });

  it('refuse un email malformé', () => {
    const fields = contactFieldsFromMapped({ lastName: 'Curie', email: 'pas-un-email' });
    assert.ok('error' in fields);
  });

  it('refuse une ligne sans nom', () => {
    const fields = contactFieldsFromMapped({ email: 'a@b.fr' });
    assert.ok('error' in fields);
  });
});

describe('findContactDuplicate', () => {
  const existing = [
    { id: '1', firstName: 'Marie', lastName: 'Curie', phone: '06 12 34 56 78', email: 'marie@lab.fr' },
  ];

  it('reconnaît le même numéro malgré le format', () => {
    assert.equal(normalizePhone('+33 6 12 34 56 78'), '0612345678');
    const fields = contactFieldsFromMapped({
      lastName: 'Autre',
      phone: '+33612345678',
    });
    assert.ok(!('error' in fields));
    if ('error' in fields) return;
    assert.equal(findContactDuplicate(fields, existing)?.id, '1');
  });

  it('reconnaît le même nom + email', () => {
    const fields = contactFieldsFromMapped({
      firstName: 'Marie',
      lastName: 'Curie',
      email: 'MARIE@lab.fr',
    });
    assert.ok(!('error' in fields));
    if ('error' in fields) return;
    assert.equal(findContactDuplicate(fields, existing)?.id, '1');
  });

  it('ne fusionne pas deux homonymes sans email ni téléphone commun', () => {
    const fields = contactFieldsFromMapped({ firstName: 'Marie', lastName: 'Curie' });
    assert.ok(!('error' in fields));
    if ('error' in fields) return;
    assert.equal(findContactDuplicate(fields, existing), null);
  });
});

describe('planContactImport', () => {
  it('importe les lignes valides et isole les invalides', () => {
    const plan = planContactImport(
      [
        { line: 2, mapped: { lastName: 'A', email: 'a@b.fr' } },
        { line: 3, mapped: { lastName: 'B', email: 'pas-email' } },
        { line: 4, mapped: { lastName: 'C', phone: '0611223344' } },
      ],
      [],
      'ignore',
    );
    assert.equal(plan.filter((p) => p.action === 'create').length, 2);
    const skipped = plan.find((p) => p.action === 'skip');
    assert.equal(skipped?.line, 3);
  });

  it('ignore un doublon existant', () => {
    const plan = planContactImport(
      [{ line: 2, mapped: { lastName: 'Curie', firstName: 'Marie', phone: '0612345678' } }],
      [{ id: '1', firstName: 'Marie', lastName: 'Curie', phone: '0612345678', email: null }],
      'ignore',
    );
    assert.equal(plan[0]?.action, 'skip');
  });

  it('propose une mise à jour quand demandé', () => {
    const plan = planContactImport(
      [{ line: 2, mapped: { lastName: 'Curie', firstName: 'Marie', phone: '0612345678', email: 'm@lab.fr' } }],
      [{ id: '1', firstName: 'Marie', lastName: 'Curie', phone: '0612345678', email: null }],
      'update',
    );
    assert.equal(plan[0]?.action, 'update');
  });
});

describe('interpretContactType', () => {
  it('comprend les libellés courants', () => {
    assert.equal(interpretContactType('Acquéreur'), 'acquereur');
    assert.equal(interpretContactType('Propriétaire'), 'vendeur');
    assert.equal(interpretContactType('xyz'), 'autre');
  });
});

describe('biens import', () => {
  it('exige une adresse', () => {
    const parsed = bienFieldsFromMapped({ city: 'Lille' });
    assert.ok('error' in parsed);
  });

  it('détecte un doublon d’adresse + CP', () => {
    const parsed = bienFieldsFromMapped({ address: '12 rue de la Monnaie', postalCode: '59000' });
    assert.ok(!('error' in parsed));
    if ('error' in parsed) return;
    const dup = findBienDuplicate(parsed, [
      { id: 'b1', address: '12  Rue de la Monnaie', postalCode: '59000', city: 'Lille' },
    ]);
    assert.equal(dup?.id, 'b1');
  });
});

describe('mergeContactFields', () => {
  it('ne vide pas un email non mappé', () => {
    const merged = mergeContactFields(
      {
        firstName: 'Marie',
        lastName: 'Curie',
        type: 'acquereur',
        phone: '0612345678',
        email: 'marie@lab.fr',
        secteur: 'Lille',
        address: null,
        postalCodes: ['59000'],
        budgetMin: 200000,
        budgetMax: 400000,
        surfaceMin: 60,
        surfaceMax: null,
        roomsMin: 3,
        summary: 'Physicienne',
      },
      {
        firstName: 'Marie',
        lastName: 'Curie',
        type: 'autre',
        phone: '0699999999',
        email: null,
        secteur: null,
        address: null,
        postalCodes: [],
        budgetMin: null,
        budgetMax: null,
        surfaceMin: null,
        surfaceMax: null,
        roomsMin: null,
        summary: null,
      },
      new Set(['phone']),
    );
    assert.equal(merged.phone, '0699999999');
    assert.equal(merged.email, 'marie@lab.fr');
    assert.equal(merged.secteur, 'Lille');
    assert.equal(merged.type, 'acquereur');
  });
});
