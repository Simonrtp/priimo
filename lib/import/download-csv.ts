import Papa from 'papaparse';

/** CSV lisible par Excel français : point-virgule + BOM UTF-8. */
export function downloadCsv(
  filename: string,
  fields: readonly string[],
  rows: readonly Record<string, string>[],
): void {
  const csv = Papa.unparse(
    {
      fields: [...fields],
      data: rows.map((row) => fields.map((field) => row[field] ?? '')),
    },
    { delimiter: ';', quotes: true },
  );
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
