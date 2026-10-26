import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { suggestMapping } from './mapping';
import {
  CONTACT_IMPORT_FIELDS,
  completerContact,
  contactFieldsFromMapped,
  findContactDuplicate,
  interpretContactRoles,
  interpretContactType,
  lireNombre,
  planContactImport,
  splitFullName,
} from './contacts';
import type { ContactInputFields } from '@/lib/contact-input';
import { findBienDuplicate, bienFieldsFromMapped } from './biens';
import {
  formatPhoneAfterCountryCode,
  formatPhoneDisplay,
  nettoyerEmail,
  normalizePhone,
  reparerTelephones,
  telHref,
} from './normalize';
import { intactesDepuisImport, retablissement } from './annulation';

function lu(mapped: Record<string, string>) {
  const res = contactFieldsFromMapped(mapped);
  assert.ok(!('error' in res), 'error' in res ? res.error : '');
  return res as { fields: ContactInputFields; avertissements: string[] };
}

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
    const lu = contactFieldsFromMapped({ fullName: 'Marie Curie', email: 'marie@example.fr' });
    assert.ok(!('error' in lu));
    if ('error' in lu) return;
    assert.equal(lu.fields.firstName, 'Marie');
    assert.equal(lu.fields.lastName, 'Curie');
  });

  it('laisse de côté un email malformé sans rejeter la fiche', () => {
    const lu = contactFieldsFromMapped({ lastName: 'Curie', email: 'pas-un-email' });
    assert.ok(!('error' in lu));
    if ('error' in lu) return;
    assert.equal(lu.fields.lastName, 'Curie');
    assert.equal(lu.fields.email, null);
    assert.ok(lu.avertissements.some((a) => /email illisible/.test(a)));
  });

  it('enregistre sous son email une ligne sans nom, et rejette une ligne vide', () => {
    const avecEmail = contactFieldsFromMapped({ email: 'a@b.fr' });
    assert.ok(!('error' in avecEmail));
    if ('error' in avecEmail) return;
    assert.equal(avecEmail.fields.lastName, 'a@b.fr');

    const vide = contactFieldsFromMapped({});
    assert.ok('error' in vide);
  });
});

describe('findContactDuplicate', () => {
  const existing = [
    { id: '1', firstName: 'Marie', lastName: 'Curie', phone: '06 12 34 56 78', email: 'marie@lab.fr' },
  ];

  it('reconnaît le même numéro malgré le format', () => {
    assert.equal(normalizePhone('+33 6 12 34 56 78'), '0612345678');
    assert.equal(formatPhoneDisplay('+33 6 12 34 56 78'), '06 12 34 56 78');
    assert.equal(formatPhoneDisplay('0678765456'), '06 78 76 54 56');
    assert.equal(formatPhoneDisplay('0678'), '06 78');
    assert.equal(formatPhoneDisplay('06787'), '06 78 7');
    assert.equal(formatPhoneAfterCountryCode('612345678'), '6 12 34 56 78');
    assert.equal(telHref('06 12 34 56 78'), 'tel:+33612345678');
    const lu = contactFieldsFromMapped({
      lastName: 'Autre',
      phone: '+33612345678',
    });
    assert.ok(!('error' in lu));
    if ('error' in lu) return;
    assert.equal(lu.fields.phone, '06 12 34 56 78');
    assert.equal(findContactDuplicate(lu.fields, existing)?.id, '1');
  });

  it('reconnaît le même nom + email', () => {
    const lu = contactFieldsFromMapped({
      firstName: 'Marie',
      lastName: 'Curie',
      email: 'MARIE@lab.fr',
    });
    assert.ok(!('error' in lu));
    if ('error' in lu) return;
    assert.equal(findContactDuplicate(lu.fields, existing)?.id, '1');
  });

  it('ne fusionne pas deux homonymes sans email ni téléphone commun', () => {
    const lu = contactFieldsFromMapped({ firstName: 'Marie', lastName: 'Curie' });
    assert.ok(!('error' in lu));
    if ('error' in lu) return;
    assert.equal(findContactDuplicate(lu.fields, existing), null);
  });
});

describe('planContactImport', () => {
  it('importe les lignes valides et isole les invalides', () => {
    const plan = planContactImport(
      [
        { line: 2, mapped: { lastName: 'A', email: 'a@b.fr' } },
        { line: 3, mapped: { email: 'pas-email' } },
        { line: 4, mapped: { lastName: 'C', phone: '0611223344' } },
      ],
      [],
    );
    assert.equal(plan.filter((p) => p.action === 'create').length, 2);
    const skipped = plan.find((p) => p.action === 'skip');
    assert.equal(skipped?.line, 3);
  });

  it('complète un doublon existant et réunit les lignes du même fichier', () => {
    const plan = planContactImport(
      [
        { line: 2, mapped: { lastName: 'Curie', firstName: 'Marie', phone: '0612345678', email: 'm@lab.fr' } },
        { line: 3, mapped: { lastName: 'Curie', firstName: 'Marie', phone: '06 12 34 56 78', secteur: 'Paris' } },
      ],
      [{ id: '1', firstName: 'Marie', lastName: 'Curie', phone: '0612345678', email: null }],
    );
    assert.equal(plan[0]?.action, 'complete');
    assert.equal(plan[1]?.action, 'merged');
  });
});

describe('interpretContactType', () => {
  it('comprend les libellés courants', () => {
    assert.equal(interpretContactType('Acquéreur'), 'acquereur');
    assert.equal(interpretContactType('Propriétaire'), 'vendeur');
    assert.equal(interpretContactType('xyz'), 'autre');
    assert.deepEqual(interpretContactRoles('Vendeur / Acheteur'), ['vendeur', 'acquereur']);
  });
});

describe('correspondance des exports courants', () => {
  it('reconnaît un export Google Contacts', () => {
    const mapping = suggestMapping(
      [
        'First Name',
        'Last Name',
        'E-mail 1 - Label',
        'E-mail 1 - Value',
        'Phone 1 - Label',
        'Phone 1 - Value',
        'Phone 2 - Value',
        'Address 1 - Formatted',
        'Notes',
      ],
      CONTACT_IMPORT_FIELDS,
    );
    assert.equal(mapping.firstName, 'First Name');
    assert.equal(mapping.lastName, 'Last Name');
    assert.equal(mapping.email, 'E-mail 1 - Value');
    assert.equal(mapping.phone, 'Phone 1 - Value');
    assert.equal(mapping.phone2, 'Phone 2 - Value');
    assert.equal(mapping.address, 'Address 1 - Formatted');
    assert.equal(mapping.summary, 'Notes');
  });

  it('préfère le portable au fixe dans un export Outlook', () => {
    const mapping = suggestMapping(
      ['Prénom', 'Nom', 'Téléphone domicile', 'Téléphone mobile', 'Adresse de messagerie'],
      CONTACT_IMPORT_FIELDS,
    );
    assert.equal(mapping.phone, 'Téléphone mobile');
    assert.equal(mapping.phone2, 'Téléphone domicile');
    assert.equal(mapping.email, 'Adresse de messagerie');
  });
});

describe('lignes réelles', () => {
  it('enregistre sous son numéro une ligne sans nom', () => {
    const { fields } = lu({ phone: '0612345678' });
    assert.equal(fields.lastName, '06 12 34 56 78');
    assert.equal(fields.phone, '06 12 34 56 78');
  });

  it('remet le zéro qu’Excel a mangé', () => {
    assert.equal(lu({ lastName: 'Curie', phone: '612345678' }).fields.phone, '06 12 34 56 78');
  });

  it('garde le second numéro d’une case dans le résumé', () => {
    const { fields } = lu({ lastName: 'Curie', phone: '06 12 34 56 78 / 01 23 45 67 89' });
    assert.equal(fields.phone, '06 12 34 56 78');
    assert.match(fields.summary ?? '', /Autres numéros : 01 23 45 67 89/);
  });

  it('lit « DUPONT Jean » rangé dans la seule colonne Nom', () => {
    const { fields } = lu({ lastName: 'DUPONT Jean' });
    assert.equal(fields.firstName, 'Jean');
    assert.equal(fields.lastName, 'DUPONT');
  });

  it('remet dans l’ordre un budget inversé écrit à la française', () => {
    const { fields } = lu({ lastName: 'Curie', budgetMin: '400.000 €', budgetMax: '250 000' });
    assert.equal(fields.budgetMin, 250_000);
    assert.equal(fields.budgetMax, 400_000);
  });

  it('lit une fourchette de budget dans une seule case', () => {
    const { fields } = lu({ lastName: 'Curie', budgetMax: '300k - 400k' });
    assert.equal(fields.budgetMin, 300_000);
    assert.equal(fields.budgetMax, 400_000);
  });

  it('ajoute la ville à l’adresse et le zéro au code postal', () => {
    const { fields } = lu({ lastName: 'Curie', address: '12 rue Neuve', ville: 'Bourg', postalCodes: '1000' });
    assert.equal(fields.address, '12 rue Neuve, Bourg');
    assert.deepEqual(fields.postalCodes, ['01000']);
  });
});

describe('réparations', () => {
  it('lit les numéros comme les fichiers les donnent', () => {
    assert.deepEqual(reparerTelephones('+33 6 12 34 56 78 ::: 01 23 45 67 89'), ['0612345678', '0123456789']);
    assert.deepEqual(reparerTelephones('0612345678 0123456789'), ['0612345678', '0123456789']);
    assert.deepEqual(reparerTelephones('tel:+33612345678'), ['0612345678']);
    assert.deepEqual(reparerTelephones('n/a'), []);
  });

  it('extrait l’email d’une case encombrée', () => {
    assert.equal(nettoyerEmail('mailto:Marie@Lab.fr'), 'marie@lab.fr');
    assert.equal(nettoyerEmail('Marie <marie@lab.fr>, autre@x.fr'), 'marie@lab.fr');
    assert.equal(nettoyerEmail('marie(at)lab'), null);
  });

  it('découpe les noms complets courants', () => {
    assert.deepEqual(splitFullName('CURIE Marie'), { firstName: 'Marie', lastName: 'CURIE' });
    assert.deepEqual(splitFullName('Curie, Marie'), { firstName: 'Marie', lastName: 'Curie' });
    assert.deepEqual(splitFullName('M. et Mme DUPONT'), { firstName: '', lastName: 'DUPONT' });
    assert.deepEqual(splitFullName('Jean-Paul Martin'), { firstName: 'Jean-Paul', lastName: 'Martin' });
  });

  it('lit les nombres écrits à la main', () => {
    assert.equal(lireNombre('250 000 €'), 250_000);
    assert.equal(lireNombre('1,2 M€'), 1_200_000);
    assert.equal(lireNombre('65 m²'), 65);
    assert.equal(lireNombre('T3'), 3);
    assert.equal(lireNombre(''), null);
  });
});

describe('gros carnet', () => {
  it('planifie 10 000 lignes face à 10 000 fiches en moins de 3 s', () => {
    const existants = Array.from({ length: 10_000 }, (_, i) => ({
      id: String(i),
      firstName: 'Prénom',
      lastName: `Nom${i}`,
      phone: `07${String(i).padStart(8, '0')}`,
      email: `p${i}@x.fr`,
    }));
    const lignes = Array.from({ length: 10_000 }, (_, i) => ({
      line: i + 2,
      mapped: { lastName: `Nouveau${i}`, phone: `06${String(i).padStart(8, '0')}` },
    }));
    const debut = Date.now();
    const plan = planContactImport(lignes, existants);
    assert.equal(plan.length, 10_000);
    assert.ok(Date.now() - debut < 3_000);
  });
});

describe('annulation', () => {
  const completion = {
    id: 'c1',
    avant: { email: null, summary: 'Physicienne', ban_id: null, latitude: null },
    apres: { email: 'marie@lab.fr', summary: 'Physicienne\nAutre numéro', ban_id: 'b1', latitude: 50.6 },
  };

  it('remet comme avant ce que personne n’a touché', () => {
    const patch = retablissement(
      { email: 'marie@lab.fr', summary: 'Physicienne\nAutre numéro', ban_id: 'b1', latitude: 50.6 },
      completion,
    );
    assert.deepEqual(patch, { email: null, summary: 'Physicienne', ban_id: null, latitude: null });
  });

  it('laisse un champ modifié depuis l’import', () => {
    const patch = retablissement(
      { email: 'nouvelle@lab.fr', summary: 'Physicienne\nAutre numéro', ban_id: 'b2', latitude: 50.7 },
      completion,
    );
    assert.deepEqual(patch, { summary: 'Physicienne' });
  });

  it('ne retire que les fiches restées telles quelles', () => {
    const ids = intactesDepuisImport(
      [
        { id: 'a', updated_at: '2026-10-26T10:00:01Z' },
        { id: 'b', updated_at: '2026-10-27T09:00:00Z' },
      ],
      '2026-10-26T10:00:00Z',
    );
    assert.deepEqual(ids, ['a']);
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

describe('completerContact', () => {
  it('remplit ce qui manque sans écraser les champs existants', () => {
    const { fields: merged } = completerContact(
      {
        firstName: 'Marie',
        lastName: 'Curie',
        type: 'acquereur',
        autresTypes: [],
        phone: '0612345678',
        numeroCommuniqueParLaPersonne: false,
        email: 'marie@lab.fr',
        secteur: null,
        address: null,
        postalCodes: ['59000'],
        budgetMin: 200000,
        budgetMax: 400000,
        surfaceMin: 60,
        surfaceMax: null,
        roomsMin: 3,
        summary: 'Physicienne',
        recontacterLe: null,
      },
      {
        firstName: 'Marie',
        lastName: 'Curie',
        type: 'autre',
        autresTypes: [],
        phone: '0699999999',
        numeroCommuniqueParLaPersonne: false,
        email: null,
        secteur: 'Lille',
        address: null,
        postalCodes: [],
        budgetMin: null,
        budgetMax: null,
        surfaceMin: null,
        surfaceMax: null,
        roomsMin: null,
        summary: null,
        recontacterLe: null,
      },
    );
    assert.equal(merged.phone, '0612345678');
    assert.equal(merged.email, 'marie@lab.fr');
    assert.equal(merged.secteur, 'Lille');
    assert.equal(merged.type, 'acquereur');
    assert.match(merged.summary ?? '', /06 99 99 99 99/);
  });
});
