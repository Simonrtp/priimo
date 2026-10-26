import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, MAX_VCARD_IMPORT_BYTES } from './limits';
import { isBlankRow } from './normalize';
import { lireVcard, ressembleAVcard, VCARD_COLONNES } from './vcard';

export { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from './limits';

export interface ParsedTable {
  fileName: string;
  headers: string[];
  /** Tableur : ligne 1 = en-tête, `line` commence à 2. vCard : n° de fiche, à partir de 1. */
  rows: { line: number; values: Record<string, string> }[];
  format?: 'tableur' | 'vcard' | 'google' | 'telephone';
}

export type ParseLimits = { maxRows?: number; maxBytes?: number };

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

function tableFromMatrix(
  matrix: unknown[][],
  fileName: string,
  maxRows: number = MAX_IMPORT_ROWS,
): ParsedTable {
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
    if (rows.length > maxRows) {
      throw new ImportFileError(
        `Le fichier dépasse ${maxRows.toLocaleString('fr-FR')} lignes. Découpez-le avant de l'importer.`,
      );
    }
  }

  if (rows.length === 0) {
    throw new ImportFileError("Le fichier n'a aucune ligne de données sous l'en-tête.");
  }

  return { fileName, headers, rows, format: 'tableur' };
}

/**
 * Excel « CSV (séparateur : point-virgule) » enregistre en Windows-1252 :
 * lu comme de l'UTF-8, chaque accent devient « � ». On essaie l'UTF-8 strict,
 * sinon Windows-1252.
 */
export function decoderTexte(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function parseVcardText(text: string, fileName: string, maxRows: number): ParsedTable {
  const fiches = lireVcard(text);
  const rows = fiches
    .map((values, index) => ({ line: index + 1, values }))
    .filter((row) => !isBlankRow(Object.values(row.values)));
  if (rows.length === 0) {
    throw new ImportFileError("Aucun contact n'a été trouvé dans ce fichier.");
  }
  if (rows.length > maxRows) {
    throw new ImportFileError(
      `Le fichier dépasse ${maxRows.toLocaleString('fr-FR')} contacts. Découpez-le avant de l'importer.`,
    );
  }
  return { fileName, headers: [...VCARD_COLONNES], rows, format: 'vcard' };
}

function parseCsvText(text: string, fileName: string, maxRows: number = MAX_IMPORT_ROWS): ParsedTable {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: 'greedy',
    delimiter: '',
  });
  if (parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
    throw new ImportFileError(parsed.errors[0]?.message ?? 'Le CSV n’a pas pu être lu.');
  }
  return tableFromMatrix(parsed.data, fileName, maxRows);
}

function parseWorkbook(buffer: ArrayBuffer, fileName: string, maxRows: number = MAX_IMPORT_ROWS): ParsedTable {
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
  return tableFromMatrix(matrix, fileName, maxRows);
}

function tropLourd(bytes: number): ImportFileError {
  return new ImportFileError(`Le fichier dépasse ${Math.round(bytes / (1024 * 1024))} Mo.`);
}

export async function parseTabularFile(file: File, limits: ParseLimits = {}): Promise<ParsedTable> {
  const maxRows = limits.maxRows ?? MAX_IMPORT_ROWS;
  const maxBytes = limits.maxBytes ?? MAX_IMPORT_BYTES;
  const name = file.name || 'import';
  const lower = name.toLowerCase();
  const vcard = lower.endsWith('.vcf') || lower.endsWith('.vcard') || /vcard/i.test(file.type);

  if (vcard) {
    if (file.size > MAX_VCARD_IMPORT_BYTES) throw tropLourd(MAX_VCARD_IMPORT_BYTES);
    return parseVcardText(decoderTexte(await file.arrayBuffer()), name, maxRows);
  }

  if (file.size > maxBytes) throw tropLourd(maxBytes);

  if (lower.endsWith('.csv') || lower.endsWith('.txt') || file.type === 'text/csv' || file.type === 'text/plain') {
    const text = decoderTexte(await file.arrayBuffer());
    // Un export de téléphone renommé ou mal étiqueté reste une vCard.
    if (ressembleAVcard(text)) return parseVcardText(text, name, maxRows);
    return parseCsvText(text, name, maxRows);
  }

  if (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'
  ) {
    return parseWorkbook(await file.arrayBuffer(), name, maxRows);
  }

  throw new ImportFileError('Formats acceptés : Excel (.xlsx), CSV ou vCard (.vcf).');
}
