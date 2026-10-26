'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, MapPin, Phone, Upload } from 'lucide-react';
import type { ContactInputFields } from '@/lib/contact-input';
import type { Contact } from '@/types/contact';
import { CONTACT_TYPE_LABELS, rolesDuContact } from '@/types/contact';
import { applyMapping, IGNORE_COLUMN, suggestMapping } from '@/lib/import/mapping';
import {
  CONTACT_IMPORT_FIELDS,
  contactMappingSuffisant,
  contactToDuplicateRef,
  planContactImport,
  resumerPlan,
} from '@/lib/import/contacts';
import {
  CONTACT_IMPORT_LOT,
  MAX_CONTACT_IMPORT_BYTES,
  MAX_CONTACT_IMPORT_ROWS,
} from '@/lib/import/limits';
import { ImportFileError, parseTabularFile, type ParsedTable } from '@/lib/import/parse-file';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';

type Etape = 'depot' | 'apercu' | 'colonnes' | 'envoi' | 'bilan';

type Bilan = {
  importId: string | null;
  crees: Contact[];
  completes: number;
  dejaPresents: number;
  reunis: number;
  ecartes: { line: number; reason: string }[];
  avertissements: { line: number; message: string }[];
  /** L'envoi s'est arrêté en route : ce qui précède est enregistré. */
  interrompu: string | null;
};

type ImportRecent = {
  id: string;
  nomFichier: string;
  crees: number;
  completes: number;
  createdAt: string;
};

type Annulation = { supprimes: number; conserves: number; retablis: number };

const SELECT_CLASS =
  'flex w-full items-center justify-between gap-2 rounded-xl border border-black/[0.10] bg-surface px-3 py-2 text-left text-[13px] text-text outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/15';

const ACCEPT =
  '.csv,.xlsx,.xls,.vcf,.vcard,text/csv,text/vcard,text/x-vcard,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

function pluriel(n: number, un: string, plusieurs: string): string {
  return `${n.toLocaleString('fr-FR')} ${n > 1 ? plusieurs : un}`;
}

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function FicheExemple({ fields }: { fields: ContactInputFields }) {
  const nom = [fields.firstName, fields.lastName].filter(Boolean).join(' ');
  const roles = rolesDuContact(fields).filter((r) => r !== 'autre');
  const lieu = fields.address ?? fields.secteur;
  return (
    <li className="min-w-0 rounded-xl border border-black/[0.08] bg-surface p-3.5">
      <p className="truncate text-[14px] font-semibold text-text-strong">{nom}</p>
      {roles.length ? (
        <p className="mt-0.5 truncate text-[12px] text-text-muted">
          {roles.map((r) => CONTACT_TYPE_LABELS[r]).join(' · ')}
        </p>
      ) : null}
      <ul className="mt-2.5 flex flex-col gap-1 text-[12.5px] text-text">
        {fields.phone ? (
          <li className="flex min-w-0 items-center gap-1.5">
            <Phone size={13} strokeWidth={2} className="shrink-0 text-text-subtle" aria-hidden />
            <span className="truncate tabular-nums">{fields.phone}</span>
          </li>
        ) : null}
        {fields.email ? (
          <li className="flex min-w-0 items-center gap-1.5">
            <Mail size={13} strokeWidth={2} className="shrink-0 text-text-subtle" aria-hidden />
            <span className="truncate">{fields.email}</span>
          </li>
        ) : null}
        {lieu ? (
          <li className="flex min-w-0 items-center gap-1.5">
            <MapPin size={13} strokeWidth={2} className="shrink-0 text-text-subtle" aria-hidden />
            <span className="truncate">{lieu}</span>
          </li>
        ) : null}
      </ul>
      {fields.summary ? (
        <p className="mt-2 line-clamp-2 text-pretty text-[12px] text-text-muted">{fields.summary}</p>
      ) : null}
    </li>
  );
}

/**
 * Import de contacts sans question : on dépose le fichier, on voit ses fiches,
 * on importe. Les colonnes se relient seules (modifiables), les doublons sont
 * complétés sans rien écraser, et l'import s'annule pendant 7 jours.
 */
export default function ImportContacts({
  open,
  onClose,
  contacts,
  onImported,
  onAnnule,
}: {
  open: boolean;
  onClose: () => void;
  contacts: Contact[];
  onImported: (created: Contact[], completed: Contact[]) => void;
  onAnnule: (supprimesIds: string[], retablis: Contact[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [etape, setEtape] = useState<Etape>('depot');
  const [dragOver, setDragOver] = useState(false);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progression, setProgression] = useState({ fait: 0, total: 0 });
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [recents, setRecents] = useState<ImportRecent[]>([]);
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);
  const [annulation, setAnnulation] = useState<Annulation | null>(null);

  // La liste de référence est figée à l'ouverture : l'import l'enrichit en route.
  const [references, setReferences] = useState<Contact[]>(contacts);

  useEffect(() => {
    if (!open) return;
    setReferences(contacts);
    let actif = true;
    fetch('/api/dashboard/contacts/import')
      .then((res) => (res.ok ? res.json() : { imports: [] }))
      .then((data: { imports?: ImportRecent[] }) => {
        if (actif) setRecents(data.imports ?? []);
      })
      .catch(() => {
        if (actif) setRecents([]);
      });
    return () => {
      actif = false;
    };
    // Seulement à l'ouverture : la liste bouge pendant l'import.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const vcard = table?.format === 'vcard';
  const lignesMot = vcard ? 'Contact' : 'Ligne';

  const mappedRows = useMemo(() => {
    if (!table) return [];
    return table.rows.map((row) => ({ line: row.line, mapped: applyMapping(row.values, mapping) }));
  }, [table, mapping]);

  const plan = useMemo(
    () => planContactImport(mappedRows, references.map(contactToDuplicateRef)),
    [mappedRows, references],
  );
  const resume = resumerPlan(plan);
  const exemples = useMemo(
    () =>
      plan
        .flatMap((p) => (p.action === 'create' || p.action === 'complete' ? [p.fields] : []))
        .slice(0, 3),
    [plan],
  );
  const aImporter = resume.nouveaux + resume.connus + resume.reunis;

  function reset() {
    setEtape('depot');
    setTable(null);
    setMapping({});
    setBusy(false);
    setError(null);
    setProgression({ fait: 0, total: 0 });
    setBilan(null);
    setAConfirmer(null);
    setAnnulation(null);
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
      const parsed = await parseTabularFile(file, {
        maxRows: MAX_CONTACT_IMPORT_ROWS,
        maxBytes: MAX_CONTACT_IMPORT_BYTES,
      });
      const suggestion = suggestMapping(parsed.headers, CONTACT_IMPORT_FIELDS);
      setTable(parsed);
      setMapping(suggestion);
      setEtape(contactMappingSuffisant(suggestion) ? 'apercu' : 'colonnes');
    } catch (err) {
      setError(err instanceof ImportFileError ? err.message : 'Ce fichier n’a pas pu être lu.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function importer() {
    if (!table || busy) return;
    setBusy(true);
    setError(null);
    setEtape('envoi');
    setProgression({ fait: 0, total: mappedRows.length });

    const cumul: Bilan = {
      importId: null,
      crees: [],
      completes: 0,
      dejaPresents: 0,
      reunis: 0,
      ecartes: [],
      avertissements: [],
      interrompu: null,
    };

    for (let i = 0; i < mappedRows.length; i += CONTACT_IMPORT_LOT) {
      const lot = mappedRows.slice(i, i + CONTACT_IMPORT_LOT);
      try {
        const res = await fetch('/api/dashboard/contacts/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: lot,
            importId: cumul.importId,
            fichier: { nom: table.fileName, format: table.format ?? 'tableur' },
          }),
        });
        const data = (await res.json()) as {
          importId?: string | null;
          created?: Contact[];
          completed?: Contact[];
          completes?: number;
          dejaPresents?: number;
          reunis?: number;
          skipped?: { line: number; reason: string }[];
          avertissements?: { line: number; message: string }[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? 'L’import a échoué.');

        cumul.importId = data.importId ?? cumul.importId;
        cumul.crees.push(...(data.created ?? []));
        cumul.completes += data.completes ?? 0;
        cumul.dejaPresents += data.dejaPresents ?? 0;
        cumul.reunis += data.reunis ?? 0;
        cumul.ecartes.push(...(data.skipped ?? []));
        cumul.avertissements.push(...(data.avertissements ?? []));
        onImported(data.created ?? [], data.completed ?? []);
        setProgression({ fait: Math.min(i + lot.length, mappedRows.length), total: mappedRows.length });
      } catch (err) {
        const raison = err instanceof Error && err.message ? err.message : 'La connexion a été perdue.';
        if (i === 0) {
          setError(raison);
          setEtape('apercu');
          setBusy(false);
          return;
        }
        cumul.interrompu = `${raison} L’import s’est arrêté après ${pluriel(i, 'ligne', 'lignes')}. Relancez le même fichier : les contacts déjà importés seront reconnus à leur téléphone ou à leur email.`;
        break;
      }
    }

    setBilan(cumul);
    setEtape('bilan');
    setBusy(false);
  }

  async function annuler(importId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/contacts/import/${importId}`, { method: 'DELETE' });
      const data = (await res.json()) as {
        supprimes?: string[];
        conserves?: number;
        retablis?: Contact[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'L’annulation a échoué.');
        return;
      }
      onAnnule(data.supprimes ?? [], data.retablis ?? []);
      setRecents((list) => list.filter((r) => r.id !== importId));
      setAConfirmer(null);
      if (bilan?.importId === importId) {
        setAnnulation({
          supprimes: data.supprimes?.length ?? 0,
          conserves: data.conserves ?? 0,
          retablis: data.retablis?.length ?? 0,
        });
      }
    } catch {
      setError('L’annulation a échoué.');
    } finally {
      setBusy(false);
    }
  }

  const titres: Record<Etape, { title: string; description?: string }> = {
    depot: {
      title: 'Importer vos contacts',
      description: 'Déposez le fichier tel quel : Priimo reconnaît les colonnes et les doublons.',
    },
    apercu: {
      title: pluriel(table?.rows.length ?? 0, 'contact trouvé', 'contacts trouvés'),
      description: 'Voici à quoi ressembleront vos fiches.',
    },
    colonnes: {
      title: 'Vérifier les colonnes',
      description: 'Chaque information Priimo et la colonne du fichier d’où elle vient.',
    },
    envoi: { title: 'Import en cours', description: 'Gardez cette fenêtre ouverte, c’est l’affaire d’un instant.' },
    bilan: { title: annulation ? 'Import annulé' : 'Import terminé' },
  };

  const exemplesColonne = (header: string) =>
    table?.rows.find((row) => row.values[header]?.trim())?.values[header]?.trim() ?? '';

  return (
    <Modal
      open={open}
      onClose={close}
      title={titres[etape].title}
      description={titres[etape].description}
      maxWidth="xl"
    >
      {error ? (
        <p className="mb-4 text-pretty text-[13px] text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {etape === 'depot' ? (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
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
            className={`flex w-full flex-col items-center justify-center rounded-clay border border-dashed px-6 py-12 text-center transition-colors duration-fluid-subtle ease-in-out ${
              dragOver ? 'border-accent bg-soft-warm' : 'border-black/[0.16] bg-black/[0.02]'
            }`}
          >
            <Upload size={22} strokeWidth={2} className="text-accent-dark" aria-hidden />
            <p className="mt-3 text-pretty text-[14px] font-medium text-text-strong">
              {busy ? 'Lecture du fichier…' : 'Glissez votre fichier ici, ou cliquez pour le choisir'}
            </p>
            <p className="mt-1 text-pretty text-[12.5px] text-text-muted">
              Excel, CSV ou vCard (.vcf), jusqu’à 10 000 contacts
            </p>
          </button>
          <p className="mt-4 text-pretty text-[13px] text-text-muted">
            Exportez vos contacts depuis votre téléphone, Google Contacts, Outlook ou votre ancien
            logiciel, puis déposez le fichier. Rien n’est enregistré avant votre accord.
          </p>

          {recents.length > 0 ? (
            <div className="mt-6">
              <p className="mb-2 text-[13px] font-medium text-text">Vos derniers imports</p>
              <ul className="flex flex-col gap-2">
                {recents.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-black/[0.08] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-text">{r.nomFichier || 'Fichier sans nom'}</p>
                      <p className="text-[12px] text-text-muted">
                        {dateCourte(r.createdAt)} · {pluriel(r.crees, 'contact ajouté', 'contacts ajoutés')}
                        {r.completes > 0 ? ` · ${pluriel(r.completes, 'fiche complétée', 'fiches complétées')}` : ''}
                      </p>
                    </div>
                    {aConfirmer === r.id ? (
                      <div className="flex gap-2">
                        <WorkspaceButton type="button" variant="secondary" onClick={() => setAConfirmer(null)}>
                          Garder
                        </WorkspaceButton>
                        <WorkspaceButton
                          type="button"
                          busy={busy}
                          busyLabel="Annulation…"
                          onClick={() => void annuler(r.id)}
                        >
                          Oui, annuler
                        </WorkspaceButton>
                      </div>
                    ) : (
                      <WorkspaceButton type="button" variant="secondary" onClick={() => setAConfirmer(r.id)}>
                        Annuler cet import
                      </WorkspaceButton>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {etape === 'apercu' && table ? (
        <div>
          {exemples.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {exemples.map((fields, i) => (
                <FicheExemple key={i} fields={fields} />
              ))}
            </ul>
          ) : (
            <p className="text-pretty text-[13px] text-text-muted">
              Aucune ligne de ce fichier ne donne de fiche. Vérifiez les colonnes.
            </p>
          )}

          <ul className="mt-5 flex flex-col gap-1 text-pretty text-[13.5px] text-text">
            <li>{pluriel(resume.nouveaux, 'nouveau contact', 'nouveaux contacts')}</li>
            {resume.connus > 0 ? (
              <li>
                {pluriel(resume.connus, 'contact déjà dans Priimo', 'contacts déjà dans Priimo')} : complétés, sans
                rien écraser
              </li>
            ) : null}
            {resume.reunis > 0 ? (
              <li>{pluriel(resume.reunis, 'doublon du fichier réuni', 'doublons du fichier réunis')}</li>
            ) : null}
            {resume.ecartes > 0 ? (
              <li className="text-text-muted">
                {pluriel(resume.ecartes, 'ligne écartée', 'lignes écartées')} : ni nom, ni téléphone, ni email
              </li>
            ) : null}
          </ul>
          <p className="mt-3 text-pretty text-[12.5px] text-text-muted">
            Ils arrivent en privé : vous et la direction les voyez. Vous pourrez annuler l’import pendant 7 jours.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => setEtape('colonnes')}
              className="text-[13px] font-medium text-text-muted underline-offset-2 hover:text-text hover:underline"
            >
              Vérifier les colonnes
            </button>
            <div className="flex flex-wrap justify-end gap-2.5">
              <WorkspaceButton type="button" variant="secondary" onClick={reset}>
                Autre fichier
              </WorkspaceButton>
              <WorkspaceButton type="button" disabled={aImporter === 0} onClick={() => void importer()}>
                {`Importer ${pluriel(aImporter, 'contact', 'contacts')}`}
              </WorkspaceButton>
            </div>
          </div>
        </div>
      ) : null}

      {etape === 'colonnes' && table ? (
        <div>
          {!contactMappingSuffisant(mapping) ? (
            <p className="mb-4 text-pretty text-[13px] text-text">
              Nous n’avons pas reconnu de colonne nom, téléphone ou email. Indiquez au moins l’une d’elles.
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {CONTACT_IMPORT_FIELDS.map((field) => {
              const colonne = mapping[field.key] ?? IGNORE_COLUMN;
              const exemple = colonne ? exemplesColonne(colonne) : '';
              return (
                <li
                  key={field.key}
                  className="grid grid-cols-1 items-start gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-4"
                >
                  <label htmlFor={`colonne-${field.key}`} className="pt-2 text-[13px] font-medium text-text">
                    {field.label}
                  </label>
                  <div className="min-w-0">
                    <Select
                      id={`colonne-${field.key}`}
                      value={colonne}
                      onChange={(valeur) => setMapping((m) => ({ ...m, [field.key]: valeur }))}
                      options={[
                        { value: IGNORE_COLUMN, label: 'À ignorer' },
                        ...table.headers.map((header) => ({ value: header, label: header })),
                      ]}
                      searchable={table.headers.length > 8}
                      searchPlaceholder="Filtrer les colonnes…"
                      triggerClassName={SELECT_CLASS}
                    />
                    {exemple ? (
                      <p className="mt-1 truncate text-[12px] text-text-subtle">ex. {exemple}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            <WorkspaceButton type="button" variant="secondary" onClick={reset}>
              Autre fichier
            </WorkspaceButton>
            <WorkspaceButton
              type="button"
              disabled={!contactMappingSuffisant(mapping)}
              onClick={() => setEtape('apercu')}
            >
              Voir mes fiches
            </WorkspaceButton>
          </div>
        </div>
      ) : null}

      {etape === 'envoi' ? (
        <div className="py-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-black/[0.06]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progression.total}
            aria-valuenow={progression.fait}
            aria-label="Progression de l’import"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{
                width: `${progression.total ? Math.max(4, (progression.fait / progression.total) * 100) : 4}%`,
              }}
            />
          </div>
          <p className="mt-3 text-[13px] tabular-nums text-text-muted">
            {progression.fait.toLocaleString('fr-FR')} sur {pluriel(progression.total, 'ligne', 'lignes')}
          </p>
        </div>
      ) : null}

      {etape === 'bilan' && bilan ? (
        <div>
          {annulation ? (
            <div className="text-pretty text-[14px] text-text">
              <p>
                {pluriel(annulation.supprimes, 'fiche retirée', 'fiches retirées')}
                {annulation.retablis > 0
                  ? `, ${pluriel(annulation.retablis, 'fiche remise', 'fiches remises')} comme avant`
                  : ''}
                .
              </p>
              {annulation.conserves > 0 ? (
                <p className="mt-2 text-[13px] text-text-muted">
                  {pluriel(annulation.conserves, 'fiche gardée', 'fiches gardées')} : vous l’avez déjà utilisée ou
                  modifiée depuis l’import.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-pretty text-[15px] font-semibold text-text-strong">
                {pluriel(bilan.crees.length, 'contact ajouté', 'contacts ajoutés')}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-pretty text-[13.5px] text-text">
                {bilan.completes > 0 ? (
                  <li>{pluriel(bilan.completes, 'fiche existante complétée', 'fiches existantes complétées')}</li>
                ) : null}
                {bilan.dejaPresents > 0 ? (
                  <li>{pluriel(bilan.dejaPresents, 'contact déjà à jour', 'contacts déjà à jour')}</li>
                ) : null}
                {bilan.reunis > 0 ? (
                  <li>{pluriel(bilan.reunis, 'doublon du fichier réuni', 'doublons du fichier réunis')}</li>
                ) : null}
              </ul>

              {bilan.interrompu ? (
                <p className="mt-4 text-pretty text-[13px] text-red-700" role="alert">
                  {bilan.interrompu}
                </p>
              ) : null}

              {bilan.avertissements.length > 0 ? (
                <details className="mt-4 rounded-xl border border-black/[0.08] px-3.5 py-2.5">
                  <summary className="cursor-pointer text-[13px] font-medium text-text">
                    {pluriel(bilan.avertissements.length, 'point à vérifier', 'points à vérifier')}
                  </summary>
                  <ul className="mt-2 max-h-48 overflow-y-auto text-[13px]">
                    {bilan.avertissements.map((a, i) => (
                      <li key={`${a.line}-${i}`} className="py-1 text-pretty text-text-muted">
                        {lignesMot} {a.line} : {a.message}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {bilan.ecartes.length > 0 ? (
                <details className="mt-3 rounded-xl border border-black/[0.08] px-3.5 py-2.5">
                  <summary className="cursor-pointer text-[13px] font-medium text-text">
                    {pluriel(bilan.ecartes.length, 'ligne écartée', 'lignes écartées')}
                  </summary>
                  <ul className="mt-2 max-h-48 overflow-y-auto text-[13px]">
                    {bilan.ecartes.map((e, i) => (
                      <li key={`${e.line}-${i}`} className="py-1 text-pretty text-text-muted">
                        {lignesMot} {e.line} : {e.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {aConfirmer && aConfirmer === bilan.importId ? (
                <p className="mt-5 text-pretty text-[13px] text-text">
                  Les contacts ajoutés seront retirés et les fiches complétées remises comme avant. Ce que vous
                  avez déjà utilisé reste.
                </p>
              ) : null}
            </>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            {!annulation && bilan.importId ? (
              aConfirmer === bilan.importId ? (
                <>
                  <WorkspaceButton type="button" variant="secondary" onClick={() => setAConfirmer(null)}>
                    Garder l’import
                  </WorkspaceButton>
                  <WorkspaceButton
                    type="button"
                    variant="secondary"
                    busy={busy}
                    busyLabel="Annulation…"
                    onClick={() => void annuler(bilan.importId as string)}
                  >
                    Oui, annuler l’import
                  </WorkspaceButton>
                </>
              ) : (
                <WorkspaceButton
                  type="button"
                  variant="secondary"
                  onClick={() => setAConfirmer(bilan.importId)}
                >
                  Annuler cet import
                </WorkspaceButton>
              )
            ) : null}
            <WorkspaceButton type="button" disabled={busy} onClick={close}>
              Terminé
            </WorkspaceButton>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
