'use client';

import { useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { Bien } from '@/types/bien';
import type { Contact } from '@/types/contact';
import { applyMapping, IGNORE_COLUMN, suggestMapping, type ImportField } from '@/lib/import/mapping';
import {
  CONTACT_IMPORT_FIELDS,
  contactToDuplicateRef,
  planContactImport,
  type DuplicateStrategy,
} from '@/lib/import/contacts';
import { BIEN_IMPORT_FIELDS, bienToDuplicateRef, planBienImport } from '@/lib/import/biens';
import { ImportFileError, parseTabularFile, type ParsedTable } from '@/lib/import/parse-file';
import Modal from '@/components/ui/Modal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';

type Step = 'drop' | 'map' | 'preview' | 'report';

type ImportReport = {
  created: number;
  updated: number;
  skipped: { line: number; reason: string }[];
};

const SELECT_CLASS =
  'w-full rounded-xl border border-black/[0.10] bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15';

function hasRequiredMapping(kind: 'contacts' | 'biens', mapping: Record<string, string>): boolean {
  if (kind === 'biens') return Boolean(mapping.address);
  return Boolean(mapping.firstName || mapping.lastName || mapping.fullName);
}

export default function ImportWizard({
  open,
  onClose,
  kind,
  contacts,
  biens,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  kind: 'contacts' | 'biens';
  contacts?: Contact[];
  biens?: Bien[];
  onImported: (created: Contact[] | Bien[], updated: Contact[] | Bien[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('drop');
  const [dragOver, setDragOver] = useState(false);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [strategy, setStrategy] = useState<DuplicateStrategy>('ignore');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const fields: readonly ImportField[] = kind === 'contacts' ? CONTACT_IMPORT_FIELDS : BIEN_IMPORT_FIELDS;
  const noun = kind === 'contacts' ? 'contacts' : 'biens';
  const nounOne = kind === 'contacts' ? 'contact' : 'bien';

  const titles: Record<Step, { title: string; description: string }> = {
    drop: {
      title: `Importer des ${noun}`,
      description: 'CSV ou Excel. Les colonnes seront détectées, rien n’est écrit pour l’instant.',
    },
    map: {
      title: 'Correspondance des colonnes',
      description:
        'Reliez chaque champ Priimo à une colonne du fichier. Ce qui n’est pas reconnu reste ignoré.',
    },
    preview: {
      title: 'Aperçu avant import',
      description: 'Vérifiez les 5 premières lignes. Rien n’est écrit tant que vous ne confirmez pas.',
    },
    report: {
      title: 'Résultat de l’import',
      description: 'Les lignes valides sont enregistrées. Les autres sont listées avec la raison.',
    },
  };

  const mappedRows = useMemo(() => {
    if (!table) return [];
    return table.rows.map((row) => ({
      line: row.line,
      mapped: applyMapping(row.values, mapping),
    }));
  }, [table, mapping]);

  const previewFields = fields.filter((field) => mapping[field.key]);

  const planSummary = useMemo(() => {
    if (!table) return { create: 0, update: 0, skip: 0 };
    const plan =
      kind === 'contacts'
        ? planContactImport(mappedRows, (contacts ?? []).map(contactToDuplicateRef), strategy)
        : planBienImport(mappedRows, (biens ?? []).map(bienToDuplicateRef), strategy);
    return {
      create: plan.filter((p) => p.action === 'create').length,
      update: plan.filter((p) => p.action === 'update').length,
      skip: plan.filter((p) => p.action === 'skip').length,
    };
  }, [table, mappedRows, kind, contacts, biens, strategy]);

  function reset() {
    setStep('drop');
    setTable(null);
    setMapping({});
    setStrategy('ignore');
    setBusy(false);
    setError(null);
    setReport(null);
    setDragOver(false);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const parsed = await parseTabularFile(file);
      setTable(parsed);
      setMapping(suggestMapping(parsed.headers, fields));
      setStep('map');
    } catch (err) {
      setError(err instanceof ImportFileError ? err.message : 'Ce fichier n’a pas pu être lu.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!table || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        kind === 'contacts' ? '/api/dashboard/contacts/import' : '/api/dashboard/biens/import',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: mappedRows, duplicates: strategy, mapping }),
        },
      );
      const data = (await res.json()) as {
        created?: Contact[] | Bien[];
        updated?: Contact[] | Bien[];
        skipped?: { line: number; reason: string }[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'L’import a échoué.');
        return;
      }
      const created = data.created ?? [];
      const updated = data.updated ?? [];
      onImported(created, updated);
      setReport({
        created: created.length,
        updated: updated.length,
        skipped: data.skipped ?? [],
      });
      setStep('report');
    } catch {
      setError('L’import a échoué.');
    } finally {
      setBusy(false);
    }
  }

  const previewRows = mappedRows.slice(0, 5);
  const canMapNext = hasRequiredMapping(kind, mapping);

  return (
    <Modal
      open={open}
      onClose={close}
      title={titles[step].title}
      description={titles[step].description}
      maxWidth="2xl"
    >
      {error ? (
        <p className="mb-4 text-pretty text-[13px] text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {step === 'drop' ? (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void handleFile(e.dataTransfer.files[0]);
            }}
            className={`flex w-full flex-col items-center justify-center rounded-clay border border-dashed px-6 py-12 text-center transition-colors ${
              dragOver ? 'border-accent bg-soft-warm' : 'border-black/[0.16] bg-black/[0.02]'
            }`}
          >
            <Upload size={22} strokeWidth={2} className="text-accent-dark" aria-hidden />
            <p className="mt-3 text-pretty text-[14px] font-medium text-text-strong">
              Glissez un fichier ici, ou cliquez pour le choisir
            </p>
            <p className="mt-1 text-pretty text-[12.5px] text-text-muted">
              CSV ou Excel (.xlsx), 2 000 lignes maximum
            </p>
          </button>
        </div>
      ) : null}

      {step === 'map' && table ? (
        <div>
          <p className="mb-4 text-pretty text-[13px] text-text-muted">
            {table.fileName} · {table.rows.length} ligne{table.rows.length > 1 ? 's' : ''} ·{' '}
            {table.headers.length} colonne{table.headers.length > 1 ? 's' : ''}
          </p>
          <ul className="flex flex-col gap-3">
            {fields.map((field) => (
              <li key={field.key} className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-4">
                <label htmlFor={`map-${field.key}`} className="text-[13px] font-medium text-text">
                  {field.label}
                  {field.key === 'address' ? (
                    <span className="ml-1 font-normal text-text-subtle">obligatoire</span>
                  ) : null}
                </label>
                <select
                  id={`map-${field.key}`}
                  className={SELECT_CLASS}
                  value={mapping[field.key] ?? IGNORE_COLUMN}
                  onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                >
                  <option value={IGNORE_COLUMN}>À ignorer</option>
                  {table.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {!canMapNext ? (
            <p className="mt-4 text-pretty text-[13px] text-text-muted">
              {kind === 'contacts'
                ? 'Indiquez au moins un nom, un prénom ou un nom complet.'
                : 'Indiquez au moins la colonne Adresse.'}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            <WorkspaceButton type="button" variant="secondary" onClick={reset}>
              Autre fichier
            </WorkspaceButton>
            <WorkspaceButton type="button" disabled={!canMapNext} onClick={() => setStep('preview')}>
              Voir l’aperçu
            </WorkspaceButton>
          </div>
        </div>
      ) : null}

      {step === 'preview' && table ? (
        <div>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[12.5px]">
              <caption className="sr-only">Aperçu des cinq premières lignes après correspondance</caption>
              <thead>
                <tr>
                  <th className="border-b border-black/[0.08] px-2 py-2 font-medium text-text-muted">Ligne</th>
                  {previewFields.map((field) => (
                    <th
                      key={field.key}
                      className="border-b border-black/[0.08] px-2 py-2 font-medium text-text-muted"
                    >
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.line}>
                    <td className="border-b border-black/[0.06] px-2 py-2 tabular-nums text-text-subtle">
                      {row.line}
                    </td>
                    {previewFields.map((field) => (
                      <td
                        key={field.key}
                        className="max-w-[160px] truncate border-b border-black/[0.06] px-2 py-2 text-text"
                      >
                        {row.mapped[field.key] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-pretty text-[13px] text-text-muted">
            {planSummary.create} {planSummary.create > 1 ? `${noun} seront créés` : `${nounOne} sera créé`}
            {planSummary.update > 0
              ? ` · ${planSummary.update} mise${planSummary.update > 1 ? 's' : ''} à jour`
              : ''}
            {planSummary.skip > 0
              ? ` · ${planSummary.skip} ignorée${planSummary.skip > 1 ? 's' : ''}`
              : ''}
            {table.rows.length > 5 ? ` · ${table.rows.length} lignes au total` : ''}
          </p>

          <fieldset className="mt-5">
            <legend className="mb-2 text-[13px] font-medium text-text">
              {kind === 'contacts'
                ? 'Si un contact a déjà le même téléphone, ou le même nom et le même email'
                : 'Si un bien a déjà la même adresse (et le même code postal ou la même ville)'}
            </legend>
            <label className="flex items-start gap-2.5 py-1.5 text-[13.5px] text-text">
              <input
                type="radio"
                name="import-duplicates"
                className="mt-1"
                checked={strategy === 'ignore'}
                onChange={() => setStrategy('ignore')}
              />
              <span>Ignorer les doublons — ne jamais créer de fiche en double</span>
            </label>
            <label className="flex items-start gap-2.5 py-1.5 text-[13.5px] text-text">
              <input
                type="radio"
                name="import-duplicates"
                className="mt-1"
                checked={strategy === 'update'}
                onChange={() => setStrategy('update')}
              />
              <span>Mettre à jour les fiches existantes avec les colonnes reliées</span>
            </label>
          </fieldset>

          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            <WorkspaceButton type="button" variant="secondary" onClick={() => setStep('map')}>
              Revenir aux colonnes
            </WorkspaceButton>
            <WorkspaceButton type="button" disabled={busy} onClick={() => void confirmImport()}>
              {busy ? 'Import en cours…' : `Importer ${table.rows.length} ligne${table.rows.length > 1 ? 's' : ''}`}
            </WorkspaceButton>
          </div>
        </div>
      ) : null}

      {step === 'report' && report ? (
        <div>
          <p className="text-pretty text-[14px] text-text">
            {report.created} importé{report.created > 1 ? 's' : ''}
            {report.updated > 0 ? ` · ${report.updated} mis à jour` : ''}
            {report.skipped.length > 0
              ? ` · ${report.skipped.length} ignoré${report.skipped.length > 1 ? 's' : ''}`
              : ''}
          </p>
          {report.skipped.length > 0 ? (
            <ul className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-black/[0.08] p-3 text-[13px]">
              {report.skipped.map((item) => (
                <li key={`${item.line}-${item.reason}`} className="py-1 text-pretty text-text-muted">
                  Ligne {item.line} — {item.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-pretty text-[13px] text-text-muted">Aucune ligne ignorée.</p>
          )}
          <div className="mt-6 flex justify-end">
            <WorkspaceButton type="button" onClick={close}>
              Terminé
            </WorkspaceButton>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
