import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as XLSX from 'xlsx';
import { ImportFileError, parseTabularFile } from './parse-file';

function fichier(nom: string, contenu: BlobPart, type: string): File {
  return new File([contenu], nom, { type });
}

describe('parseTabularFile', () => {
  it('lit un CSV avec en-tête', async () => {
    const table = await parseTabularFile(
      fichier('contacts.csv', 'Nom,Mail\nCurie,marie@lab.fr\n', 'text/csv'),
    );
    assert.deepEqual(table.headers, ['Nom', 'Mail']);
    assert.equal(table.rows.length, 1);
    assert.equal(table.rows[0]?.line, 2);
    assert.equal(table.rows[0]?.values.Nom, 'Curie');
    assert.equal(table.rows[0]?.values.Mail, 'marie@lab.fr');
  });

  it('lit le premier onglet Excel et garde les cellules vides', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nom', 'Mail'],
      ['Curie', ''],
      ['', ''],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const table = await parseTabularFile(
      fichier(
        'contacts.xlsx',
        buf,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    );
    assert.equal(XLSX.version, '0.20.3');
    assert.deepEqual(table.headers, ['Nom', 'Mail']);
    assert.equal(table.rows.length, 1);
    assert.equal(table.rows[0]?.values.Nom, 'Curie');
    assert.equal(table.rows[0]?.values.Mail, '');
  });

  it('refuse un format inconnu', async () => {
    await assert.rejects(
      () => parseTabularFile(fichier('notes.pdf', 'bonjour', 'application/pdf')),
      (err: unknown) => err instanceof ImportFileError && /Excel.*CSV ou vCard/.test(err.message),
    );
  });

  it('lit un CSV Excel enregistré en Windows-1252 sans casser les accents', async () => {
    // « Prénom;Téléphone\nHélène;0612345678 » en Windows-1252.
    const octets = Uint8Array.from([
      ...Buffer.from('Pr'), 0xe9, ...Buffer.from('nom;T'), 0xe9, ...Buffer.from('l'), 0xe9,
      ...Buffer.from('phone\nH'), 0xe9, ...Buffer.from('l'), 0xe8, ...Buffer.from('ne;0612345678\n'),
    ]);
    const table = await parseTabularFile(fichier('export.csv', octets, 'text/csv'));
    assert.deepEqual(table.headers, ['Prénom', 'Téléphone']);
    assert.equal(table.rows[0]?.values['Prénom'], 'Hélène');
  });

  it('lit un export vCard de téléphone', async () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Curie;Marie;;;',
      'FN:Marie Curie',
      'item1.TEL;type=HOME:01 23 45 67 89',
      'TEL;type=CELL;type=pref:06 12 34 56 78',
      'EMAIL;type=INTERNET:marie@lab.fr',
      'ADR;type=HOME:;;12 rue Cuvier;Paris;;75005;France',
      'NOTE:Cherche un T3\\, proche du jardin',
      'PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRgABAQ',
      ' AAAQABAAD',
      'END:VCARD',
      'BEGIN:VCARD',
      'VERSION:2.1',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Dupr=C3=A9;H=C3=A9l=C3=A8ne;;;',
      'TEL;CELL:0698765432',
      'END:VCARD',
    ].join('\r\n');
    const table = await parseTabularFile(fichier('contacts.vcf', vcf, 'text/vcard'));
    assert.equal(table.format, 'vcard');
    assert.equal(table.rows.length, 2);
    const marie = table.rows[0]?.values ?? {};
    assert.equal(marie['Prénom'], 'Marie');
    assert.equal(marie.Nom, 'Curie');
    assert.equal(marie['Téléphone'], '06 12 34 56 78');
    assert.equal(marie['Autre téléphone'], '01 23 45 67 89');
    assert.equal(marie.Email, 'marie@lab.fr');
    assert.equal(marie.Adresse, '12 rue Cuvier');
    assert.equal(marie['Code postal'], '75005');
    assert.equal(marie.Ville, 'Paris');
    assert.equal(marie.Notes, 'Cherche un T3, proche du jardin');
    assert.equal(table.rows[1]?.values.Nom, 'Dupré');
    assert.equal(table.rows[1]?.values['Prénom'], 'Hélène');
    assert.equal(table.rows[1]?.line, 2);
  });
});
