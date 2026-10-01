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
      (err: unknown) => err instanceof ImportFileError && /CSV ou Excel/.test(err.message),
    );
  });
});
