import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from './limits';
import { isBlankRow } from './normalize';

export { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from './limits';

export interface ParsedTable {
  fileName: string;
  headers: string[];
  /** Ligne 1 = en-tête. `line` commence à 2. */
  rows: { line: number; values: Record<string, string> }[];
}

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportFileError';
  }
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function uniqueHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((header, index) => {
    const base = header.trim() || `Colonne ${index + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

function tableFromMatrix(matrix: unknown[][], fileName: string): ParsedTable {
  if (matrix.length === 0) {
    throw new ImportFileError('Le fichier est vide.');
  }

  const headers = uniqueHeaders((matrix[0] ?? []).map((cell) => stringifyCell(cell)));
  if (headers.length === 0) {
    throw new ImportFileError("Aucune colonne n'a été détectée.");
  }

  const rows: ParsedTable['rows'] = [];
  for (let i = 1; i < matrix.length; i++) {
    const line = i + 1;
    const cells = matrix[i] ?? [];
    const values: Record<string, string> = {};
    const ordered: string[] = [];
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c] ?? `Colonne ${c + 1}`;
      const text = stringifyCell(cells[c]);
      values[header] = text;
      ordered.push(text);
    }
    if (isBlankRow(ordered)) continue;
    rows.push({ line, values });
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new ImportFileError(
        `Le fichier dépasse ${MAX_IMPORT_ROWS} lignes. Découpez-le avant de l'importer.`,
      );
    }
  }

  if (rows.length === 0) {
    throw new ImportFileError("Le fichier n'a aucune ligne de données sous l'en-tête.");
  }

  return { fileName, headers, rows };
}

function parseCsvText(text: string, fileName: string): ParsedTable {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: 'greedy',
    delimiter: '',
  });
  if (parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
    throw new ImportFileError(parsed.errors[0]?.message ?? 'Le CSV n’a pas pu être lu.');
  }
  return tableFromMatrix(parsed.data, fileName);
}

function parseWorkbook(buffer: ArrayBuffer, fileName: string): ParsedTable {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new ImportFileError("Le classeur n'a aucune feuille.");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new ImportFileError("La première feuille n'a pas pu être lue.");
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  return tableFromMatrix(matrix, fileName);
}

export async function parseTabularFile(file: File): Promise<ParsedTable> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new ImportFileError('Le fichier dépasse 5 Mo.');
  }

  const name = file.name || 'import';
  const lower = name.toLowerCase();

  if (lower.endsWith('.csv') || file.type === 'text/csv' || file.type === 'text/plain') {
    return parseCsvText(await file.text(), name);
  }

  if (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'
  ) {
    return parseWorkbook(await file.arrayBuffer(), name);
  }

  throw new ImportFileError('Formats acceptés : CSV ou Excel (.xlsx).');
}
