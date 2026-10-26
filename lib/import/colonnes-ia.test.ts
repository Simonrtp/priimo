import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aRelire,
  enTetesSontDesDonnees,
  exemplesColonnes,
  fusionnerCorrespondance,
  masquerExemple,
  notesEnTetes,
  sansLigneEnTete,
  validerColonnes,
  versIndex,
} from './colonnes-ia';
import { avecNotesEnPlus, CONTACT_IMPORT_FIELDS, contactFieldsFromMapped } from './contacts';
import { applyMapping, suggestMapping } from './mapping';
import type { ParsedTable } from './parse-file';
import { contactTelephoneVersValeurs } from './telephone';

function tableau(headers: string[], lignes: string[][]): ParsedTable {
  return {
    fileName: 'export.csv',
    headers,
    rows: lignes.map((cells, i) => ({
      line: i + 2,
      values: Object.fromEntries(headers.map((h, j) => [h, cells[j] ?? ''])),
    })),
    format: 'tableur',
  };
}

describe('masquerExemple', () => {
  it('garde la forme, pas le numéro ni l’adresse email', () => {
    assert.equal(masquerExemple('06 12 34 56 78'), '06 00 00 00 00');
    assert.equal(masquerExemple('75002'), '75000');
    assert.equal(masquerExemple('jean.dupont@gmail.com'), 'j•••@gmail.com');
    assert.equal(masquerExemple('DUPONT'), 'DUPONT');
    // Masquer deux fois ne change rien (le serveur remasque).
    assert.equal(masquerExemple(masquerExemple('06 12 34 56 78')), '06 00 00 00 00');
  });

  it('prend trois valeurs distinctes et masquées par colonne', () => {
    const t = tableau(['Tél'], [['0612345678'], ['0612345678'], ['0698765432'], [''], ['0711223344'], ['0799999999']]);
    assert.deepEqual(exemplesColonnes(t), [['0600000000', '0600000000', '0700000000']]);
  });
});

describe('aRelire', () => {
  it('laisse tranquille un fichier dont tout est reconnu', () => {
    const t = tableau(['Nom', 'Prénom', 'Portable'], [['Curie', 'Marie', '0612345678']]);
    assert.equal(aRelire(t, suggestMapping(t.headers, CONTACT_IMPORT_FIELDS)), false);
  });

  it('relit un fichier aux colonnes pleines non reconnues', () => {
    const t = tableau(['Nom', 'Prénom', 'GSM perso', 'Suivi'], [['Curie', 'Marie', '0612345678', 'Rappeler']]);
    assert.equal(aRelire(t, suggestMapping(t.headers, CONTACT_IMPORT_FIELDS)), true);
  });

  it('ne relit jamais une vCard', () => {
    const t = { ...tableau(['Truc'], [['x']]), format: 'vcard' as const };
    assert.equal(aRelire(t, {}), false);
  });
});

describe('validerColonnes', () => {
  it('écarte les champs inconnus, les colonnes hors fichier et les doublons', () => {
    const v = validerColonnes(
      {
        premiere_ligne_est_une_donnee: false,
        champs: { lastName: 0, firstName: 0, phone: 2, inconnu: 1, email: 9, summary: 1.5 },
        notes: [3, 2, 3, 12],
      },
      4,
    );
    // Même colonne pour deux champs : l'ordre des champs Priimo tranche (prénom d'abord).
    assert.deepEqual(v, { champs: { firstName: 0, phone: 2 }, notes: [3], premiereLigneDonnee: false });
  });

  it('refuse une réponse qui n’est pas un objet', () => {
    assert.equal(validerColonnes('bonjour', 3), null);
  });

  it('ne garde jamais un nom complet avec un prénom seul', () => {
    const seul = validerColonnes({ champs: { fullName: 0, firstName: 1 } }, 3);
    assert.deepEqual(seul?.champs, { fullName: 0 });
    const separes = validerColonnes({ champs: { fullName: 0, firstName: 1, lastName: 2 } }, 3);
    assert.deepEqual(separes?.champs, { firstName: 1, lastName: 2 });
  });
});

describe('enTetesSontDesDonnees', () => {
  it('reconnaît un contact pris pour des titres', () => {
    assert.equal(enTetesSontDesDonnees(['DUPONT', 'Jean', '06 12 34 56 78']), true);
    assert.equal(enTetesSontDesDonnees(['Nom', 'jean@x.fr']), true);
    assert.equal(enTetesSontDesDonnees(['Nom', 'Prénom', 'Tél. 1', 'Code postal 2']), false);
  });
});

describe('lecture des colonnes reliées par l’assistant', () => {
  it('tire le code postal d’une colonne « 75002 Paris » et lit Achat / Vente', () => {
    const avecAdresse = contactFieldsFromMapped({ fullName: 'DUPONT Jean', address: '12 rue de la Paix', ville: '75002 Paris', type: 'Achat T3' });
    assert.ok(!('error' in avecAdresse));
    if ('error' in avecAdresse) return;
    assert.deepEqual(avecAdresse.fields.postalCodes, ['75002']);
    assert.equal(avecAdresse.fields.address, '12 rue de la Paix, 75002 Paris');
    assert.equal(avecAdresse.fields.type, 'acquereur');

    const sansAdresse = contactFieldsFromMapped({ lastName: 'Martin', ville: '69006 Lyon', type: 'Vente maison' });
    assert.ok(!('error' in sansAdresse));
    if ('error' in sansAdresse) return;
    assert.equal(sansAdresse.fields.secteur, 'Lyon');
    assert.deepEqual(sansAdresse.fields.postalCodes, ['69006']);
    assert.equal(sansAdresse.fields.type, 'vendeur');
  });
});

describe('fichier sans ligne d’en-tête', () => {
  it('rend son premier contact à la ligne prise pour des titres', () => {
    const t = tableau(['DUPONT', 'Jean', '0612345678'], [['MARTIN', 'Paul', '0712345678']]);
    const sans = sansLigneEnTete(t);
    assert.deepEqual(sans.headers, ['Colonne 1', 'Colonne 2', 'Colonne 3']);
    assert.equal(sans.rows.length, 2);
    assert.deepEqual(sans.rows[0], { line: 1, values: { 'Colonne 1': 'DUPONT', 'Colonne 2': 'Jean', 'Colonne 3': '0612345678' } });
    assert.equal(sans.rows[1]?.values['Colonne 1'], 'MARTIN');

    const ia = { champs: { lastName: 0, firstName: 1, phone: 2 }, notes: [], premiereLigneDonnee: true };
    const mapping = fusionnerCorrespondance(sans.headers, suggestMapping(t.headers, CONTACT_IMPORT_FIELDS), ia);
    const lu = contactFieldsFromMapped(applyMapping(sans.rows[0]?.values ?? {}, mapping));
    assert.ok(!('error' in lu));
    if ('error' in lu) return;
    assert.equal(lu.fields.lastName, 'DUPONT');
    assert.equal(lu.fields.phone, '06 12 34 56 78');
  });
});

describe('fusion avec les alias', () => {
  it('garde ce que les en-têtes disent, l’assistant complète le reste', () => {
    const headers = ['Nom', 'GSM perso', 'Téléphone', 'Historique', 'ID interne'];
    const aliases = suggestMapping(headers, CONTACT_IMPORT_FIELDS);
    assert.equal(aliases.phone, 'Téléphone');
    const ia = { champs: { lastName: 1, phone: 1, phone2: 2 }, notes: [3], premiereLigneDonnee: false };
    const mapping = fusionnerCorrespondance(headers, aliases, ia);
    assert.equal(mapping.lastName, 'Nom');
    assert.equal(mapping.phone, 'Téléphone');
    assert.equal(mapping.phone2, '');
    assert.deepEqual(notesEnTetes(headers, ia, mapping), ['Historique']);
    assert.deepEqual(versIndex(headers, mapping, ['Historique']), {
      champs: { lastName: 0, phone: 2 },
      notes: [3],
    });
  });
});

describe('avecNotesEnPlus', () => {
  it('ajoute les colonnes gardées au résumé, avec leur titre', () => {
    const mapped = avecNotesEnPlus(
      { lastName: 'Curie', summary: 'Physicienne' },
      { Historique: 'Appelée le 3/10', Source: '', Négociateur: 'Paul' },
      ['Historique', 'Source', 'Négociateur'],
    );
    assert.equal(mapped.summary, 'Physicienne\nHistorique : Appelée le 3/10\nNégociateur : Paul');
  });
});

describe('contacts du téléphone', () => {
  it('donne une fiche à partir du carnet Android', () => {
    const valeurs = contactTelephoneVersValeurs({
      name: ['Hélène LEFÈVRE'],
      tel: ['06 98 76 54 32', '06 98 76 54 32', '01 42 00 00 00'],
      email: ['helene@free.fr'],
      address: [{ addressLine: ['3 avenue Foch'], postalCode: '69006', city: 'Lyon' }],
    });
    const lu = contactFieldsFromMapped(applyMapping(valeurs, suggestMapping(Object.keys(valeurs), CONTACT_IMPORT_FIELDS)));
    assert.ok(!('error' in lu));
    if ('error' in lu) return;
    assert.equal(lu.fields.firstName, 'Hélène');
    assert.equal(lu.fields.lastName, 'LEFÈVRE');
    assert.equal(lu.fields.phone, '06 98 76 54 32');
    assert.match(lu.fields.summary ?? '', /Autres numéros : 01 42 00 00 00/);
    assert.equal(lu.fields.address, '3 avenue Foch, Lyon');
  });
});
