'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, Trash2 } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import ConfirmModal from '@/components/ui/ConfirmModal';
import PageRapport from '@/components/rapport/PageRapport';
import EditeurPageAgence from '@/components/dashboard/settings/EditeurPageAgence';
import { notifyError, notifySuccess } from '@/lib/notify';
import { useUser } from '@/lib/hooks/useUser';
import type { EstimationObjet } from '@/lib/estimation/objet';
import type { PageBibliotheque, PageRapportComposee } from '@/lib/rapport/pages';
import ContenuPageModele from '@/components/rapport/ContenuPageModele';
import {
  normaliserCouleurPrincipale,
  type IdentiteAgenceRapport,
  type IdentiteAgentRapport,
  type PiedBienRapport,
} from '@/lib/rapport/identite';
import { estDisposition } from '@/lib/rapport/modele';

export default function OngletRapport({
  estimation,
}: {
  estimation: EstimationObjet;
  agencyName?: string;
}) {
  const [pages, setPages] = useState<PageRapportComposee[]>([]);
  const [biblio, setBiblio] = useState<PageBibliotheque[]>([]);
  const [agence, setAgence] = useState<IdentiteAgenceRapport | null>(null);
  const [agent, setAgent] = useState<IdentiteAgentRapport | null>(null);
  const [bien, setBien] = useState<PiedBienRapport>({ adresse: null, ville: null });
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [biblioOuverte, setBiblioOuverte] = useState(false);
  const [pending, setPending] = useState<PageRapportComposee | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [creerPage, setCreerPage] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const { user, profile, agency } = useUser();

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const [comp, lib] = await Promise.all([
        fetch(`/api/dashboard/estimation/${estimation.id}/rapport`).then((r) => r.json()),
        fetch('/api/dashboard/rapport/bibliotheque').then((r) => r.json()),
      ]);
      const compose = comp as {
        pages?: PageRapportComposee[];
        agence?: IdentiteAgenceRapport;
        agent?: IdentiteAgentRapport;
        bien?: PiedBienRapport;
        dateIso?: string;
        error?: string;
      };
      if (compose.error) throw new Error(compose.error);
      setPages(compose.pages ?? []);
      if (compose.agence) setAgence(compose.agence);
      if (compose.agent) setAgent(compose.agent);
      if (compose.bien) setBien(compose.bien);
      setDateIso(compose.dateIso ?? estimation.updatedAt);
      setBiblio((lib as { pages?: PageBibliotheque[] }).pages ?? []);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Rapport indisponible');
    } finally {
      setChargement(false);
    }
  }, [estimation.id, estimation.updatedAt]);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    if (index >= pages.length) setIndex(Math.max(0, pages.length - 1));
  }, [index, pages.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const courante = pages[index] ?? null;

  async function ajouterBiblio(id: string) {
    const res = await fetch(`/api/dashboard/estimation/${estimation.id}/rapport/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bibliothequeId: id }),
    });
    const data = (await res.json()) as { pages?: PageRapportComposee[]; error?: string };
    if (!res.ok || !data.pages) {
      notifyError(data.error ?? 'Ajout impossible');
      return;
    }
    setPages((prev) => [...prev, ...data.pages!]);
    setIndex(pages.length);
    setBiblioOuverte(false);
    notifySuccess('Page ajoutée au rapport');
  }

  async function importer(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/dashboard/estimation/${estimation.id}/rapport/pages`, {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as { pages?: PageRapportComposee[]; error?: string };
    if (!res.ok || !data.pages) {
      notifyError(data.error ?? 'Import impossible');
      return;
    }
    setPages((prev) => [...prev, ...data.pages!]);
    setIndex(pages.length);
    notifySuccess('Document importé');
    if (importRef.current) importRef.current.value = '';
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = pages.findIndex((p) => p.id === active.id);
    const to = pages.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(pages, from, to);
    setPages(next);
    setIndex(to);
    const res = await fetch(`/api/dashboard/estimation/${estimation.id}/rapport/ordre`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map((p) => p.id) }),
    });
    if (!res.ok) {
      notifyError('Réordonnancement impossible');
      void charger();
    }
  }

  async function retirer() {
    if (!pending) return;
    const res = await fetch(
      `/api/dashboard/estimation/${estimation.id}/rapport/pages/${pending.id}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      notifyError('Retrait impossible');
      return;
    }
    setPages((prev) => prev.filter((p) => p.id !== pending.id));
    setPending(null);
    notifySuccess('Page retirée');
  }

  async function exporter() {
    const res = await fetch(`/api/dashboard/estimation/${estimation.id}/rapport/pdf`);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      notifyError(data.error ?? 'Export impossible');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'avis-de-valeur.pdf';
    a.click();
    URL.revokeObjectURL(url);
    notifySuccess('PDF téléchargé');
  }

  async function envoyer() {
    setEnvoi(true);
    try {
      const res = await fetch(`/api/dashboard/estimation/${estimation.id}/rapport/envoyer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailTo.trim() || undefined }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Envoi impossible');
      notifySuccess('Avis de valeur envoyé');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-pretty text-[13.5px] text-text-muted">
          Composez le contenant : pages de l’agence, documents importés. Les pages de données
          viendront ensuite. Accessible dès maintenant, même si le bien n’est pas encore renseigné.
        </p>
        <div className="flex flex-wrap gap-2">
          <WorkspaceButton type="button" variant="secondary" onClick={() => setBiblioOuverte((o) => !o)}>
            Bibliothèque
          </WorkspaceButton>
          <WorkspaceButton type="button" variant="secondary" onClick={() => importRef.current?.click()}>
            Importer un PDF
          </WorkspaceButton>
          <WorkspaceButton type="button" onClick={() => void exporter()}>
            Exporter le PDF
          </WorkspaceButton>
        </div>
      </div>

      <input
        ref={importRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => void importer(e.target.files?.[0])}
      />

      {biblioOuverte ? (
        <div className="rounded-clay border border-black/[0.06] bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-text-strong">Pages de l’agence</p>
            <WorkspaceButton type="button" variant="secondary" onClick={() => setCreerPage(true)}>
              Créer une page
            </WorkspaceButton>
          </div>
          {biblio.length === 0 ? (
            <p className="mt-2 text-pretty text-[13px] text-text-muted">
              Aucune page en bibliothèque. Créez-en une ici, ou importez un PDF.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {biblio.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[13.5px] text-text">
                    {p.nom}
                    <span className="text-text-muted">
                      {p.pageCount > 1 ? ` · ${p.pageCount} pages` : ''}
                    </span>
                  </span>
                  <WorkspaceButton type="button" variant="secondary" onClick={() => void ajouterBiblio(p.id)}>
                    Ajouter
                  </WorkspaceButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
        <div className="rounded-clay border border-black/[0.06] bg-surface p-2">
          {chargement ? (
            <div className="h-40 animate-pulse rounded-clay bg-black/[0.04]" aria-hidden />
          ) : pages.length === 0 ? (
            <p className="p-3 text-pretty text-[13.5px] text-text-muted">
              Aucune page. Ajoutez-en une depuis la bibliothèque ou importez un PDF.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
              <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <ol className="flex flex-col gap-1" aria-label="Pages du rapport">
                  {pages.map((p, i) => (
                    <LigneComposee
                      key={p.id}
                      page={p}
                      index={i}
                      active={i === index}
                      onSelect={() => setIndex(i)}
                      onDelete={() => setPending(p)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div>
          {agence && agent ? (
            <PageRapport
              agence={agence}
              agent={agent}
              bien={bien}
              dateIso={dateIso}
              page={pages.length === 0 ? 1 : index + 1}
              pages={Math.max(pages.length, 1)}
            >
              <ApercuPage page={courante} accent={normaliserCouleurPrincipale(agence.couleurPrincipale)} />
            </PageRapport>
          ) : (
            <div className="aspect-[297/210] animate-pulse rounded-clay bg-black/[0.04]" aria-hidden />
          )}

          {pages.length > 1 ? (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-clay border border-black/[0.08] bg-surface text-text hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                aria-label="Page précédente"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft size={18} strokeWidth={2} aria-hidden />
              </button>
              <p className="min-w-[4rem] text-center text-[13px] tabular-nums text-text-muted">
                {index + 1} / {pages.length}
              </p>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-clay border border-black/[0.08] bg-surface text-text hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                aria-label="Page suivante"
                disabled={index >= pages.length - 1}
                onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
              >
                <ChevronRight size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="rapport-email" className="mb-1.5 block text-[13px] font-medium text-text">
                Envoyer par e-mail
              </label>
              <input
                id="rapport-email"
                type="email"
                autoComplete="email"
                className="w-full rounded-clay border border-black/[0.1] bg-white px-3 py-2.5 text-[14px] text-text placeholder:text-text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                placeholder="client@exemple.fr — ou l’e-mail du contact rattaché"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
            </div>
            <WorkspaceButton type="button" variant="secondary" disabled={envoi} onClick={() => void envoyer()}>
              {envoi ? 'Envoi…' : 'Envoyer'}
            </WorkspaceButton>
          </div>
        </div>
      </div>

      <EditeurPageAgence
        key={creerPage ? 'rapport-new' : 'rapport-ferme'}
        open={creerPage}
        page={null}
        agency={agency}
        profile={profile}
        loginEmail={user.email}
        logoUrl={agence?.logoUrl ?? null}
        onClose={() => setCreerPage(false)}
        onSaved={(saved) => {
          setBiblio((prev) => [...prev, saved]);
          setCreerPage(false);
        }}
      />

      <ConfirmModal
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void retirer()}
        title="Retirer cette page"
        message={`${pending?.nom ?? ''} quittera ce rapport.`}
        primaryLabel="Retirer"
        variant="danger"
      />
    </div>
  );
}

function ApercuPage({ page, accent }: { page: PageRapportComposee | null; accent: string }) {
  if (!page) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-pretty text-center text-[13.5px] text-text-muted">
          Le gabarit est prêt. Ajoutez une page pour l’aperçu.
        </p>
      </div>
    );
  }
  if (page.kind === 'modele' && page.disposition && estDisposition(page.disposition)) {
    return (
      <ContenuPageModele
        disposition={page.disposition}
        contenu={page.contenu ?? {}}
        imageUrl={page.previewUrl}
        accent={accent}
      />
    );
  }
  if (page.kind === 'image' && page.previewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={page.previewUrl} alt="" className="h-full w-full object-contain" />
    );
  }
  if (page.kind === 'pdf' && page.previewUrl) {
    return (
      <iframe
        title={page.nom}
        src={`${page.previewUrl}#page=${page.pageIndex + 1}&view=FitH`}
        className="h-full w-full border-0 bg-white"
      />
    );
  }
  return (
    <div className="flex h-full items-center justify-center px-6">
      <p className="text-pretty text-center text-[13.5px] text-text-muted">{page.nom}</p>
    </div>
  );
}

function LigneComposee({
  page,
  index,
  active,
  onSelect,
  onDelete,
}: {
  page: PageRapportComposee;
  index: number;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const sortable = useSortable({ id: page.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.45 : 1,
  };
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className={`flex items-center gap-1 rounded-clay px-1 py-1 ${
        active ? 'bg-[#E8743C]/10 ring-1 ring-[#E8743C]/50' : 'hover:bg-black/[0.03]'
      }`}
    >
      <button
        type="button"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-black/[0.04]"
        aria-label={`Déplacer ${page.nom}`}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical size={15} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 truncate py-1.5 text-left text-[13px] font-medium text-text"
      >
        <span className="mr-1.5 tabular-nums text-text-muted">{index + 1}.</span>
        {page.nom}
      </button>
      <button
        type="button"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-black/[0.04] hover:text-red-700"
        aria-label={`Retirer ${page.nom}`}
        onClick={onDelete}
      >
        <Trash2 size={15} strokeWidth={2} aria-hidden />
      </button>
    </li>
  );
}
