'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, GripVertical, Trash2 } from 'lucide-react';
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
import ApercuPageComposee from '@/components/rapport/ApercuPageComposee';
import LogoAgenceChamp from '@/components/dashboard/settings/LogoAgenceChamp';
import NuancierAvis from '@/components/dashboard/settings/NuancierAvis';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { EstimationObjet } from '@/lib/estimation/objet';
import type { PageBibliotheque, PageRapportComposee } from '@/lib/rapport/pages';
import { pagePourPdf } from '@/lib/rapport/pages';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import {
  normaliserCouleurPrincipale,
  normaliserCouleurSecondaire,
  type IdentiteAgenceRapport,
  type IdentiteAgentRapport,
  type PiedBienRapport,
} from '@/lib/rapport/identite';
import type { EnvoiRapport } from '@/lib/rapport/envois';

function formatDateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function OngletRapport({
  estimation,
  onEtatChange,
}: {
  estimation: EstimationObjet;
  agencyName?: string;
  onEtatChange?: (etat: {
    pages: number;
    contactEmail: string | null;
    pagesIncompletes: Array<{ kind: import('@/lib/rapport/modele-defaut').KindGeneree; manques: string[] }>;
    contradictions: import('@/lib/rapport/genere/contradictions').ContradictionRapport[];
  }) => void;
}) {
  const [pages, setPages] = useState<PageRapportComposee[]>([]);
  const [dossier, setDossier] = useState<DossierRapport | null>(null);
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
  const [message, setMessage] = useState('');
  const [envois, setEnvois] = useState<EnvoiRapport[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const couleursTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEtatChangeRef = useRef(onEtatChange);
  onEtatChangeRef.current = onEtatChange;

  useEffect(() => {
    return () => {
      if (couleursTimer.current) clearTimeout(couleursTimer.current);
    };
  }, []);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const [comp, lib] = await Promise.all([
        fetch(`/api/dashboard/estimation/${estimation.id}/rapport`).then((r) => r.json()),
        fetch('/api/dashboard/rapport/bibliotheque').then((r) => r.json()),
      ]);
      const compose = comp as {
        pages?: PageRapportComposee[];
        dossier?: DossierRapport;
        agence?: IdentiteAgenceRapport;
        agent?: IdentiteAgentRapport;
        bien?: PiedBienRapport;
        dateIso?: string;
        contactEmail?: string | null;
        emailModele?: string;
        envois?: EnvoiRapport[];
        error?: string;
      };
      if (compose.error) throw new Error(compose.error);
      const nextPages = compose.pages ?? [];
      setPages(nextPages);
      if (compose.dossier) setDossier(compose.dossier);
      if (compose.agence) setAgence(compose.agence);
      if (compose.agent) setAgent(compose.agent);
      if (compose.bien) setBien(compose.bien);
      setDateIso(compose.dateIso ?? estimation.updatedAt);
      setEnvois(compose.envois ?? []);
      if (compose.emailModele) setMessage((prev) => (prev.trim() ? prev : compose.emailModele ?? ''));
      const mailClient = compose.contactEmail ?? null;
      setContactEmail(mailClient);
      if (mailClient) {
        setEmailTo((prev) => prev || mailClient);
      }
      onEtatChangeRef.current?.({
        pages: nextPages.length,
        contactEmail: mailClient,
        pagesIncompletes: nextPages
          .filter((p) => p.kind === 'generee' && p.kindGeneree && p.manques.length > 0)
          .map((p) => ({ kind: p.kindGeneree!, manques: p.manques })),
        contradictions: compose.dossier?.contradictions ?? [],
      });
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
  const vide = pages.length === 0;

  function publierEtat(nextPages: PageRapportComposee[]) {
    onEtatChangeRef.current?.({
      pages: nextPages.length,
      contactEmail,
      pagesIncompletes: nextPages
        .filter((p) => p.kind === 'generee' && p.kindGeneree && p.manques.length > 0)
        .map((p) => ({ kind: p.kindGeneree!, manques: p.manques })),
      contradictions: dossier?.contradictions ?? [],
    });
  }

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
    setPages((prev) => {
      const next = [...prev, ...data.pages!];
      publierEtat(next);
      return next;
    });
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
    setPages((prev) => {
      const next = [...prev, ...data.pages!];
      publierEtat(next);
      return next;
    });
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
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== pending.id);
      publierEtat(next);
      return next;
    });
    setPending(null);
    notifySuccess('Page retirée');
  }

  function appliquerCouleurs(principale: string, secondaire: string) {
    setAgence((prev) =>
      prev ? { ...prev, couleurPrincipale: principale, couleurSecondaire: secondaire } : prev,
    );
    setDossier((prev) =>
      prev
        ? { ...prev, agence: { ...prev.agence, couleurPrincipale: principale, couleurSecondaire: secondaire } }
        : prev,
    );
  }

  function changerCouleur(quelle: 'principale' | 'secondaire', hex: string) {
    if (!agence) return;
    const principale =
      quelle === 'principale' ? hex : normaliserCouleurPrincipale(agence.couleurPrincipale);
    const secondaire =
      quelle === 'secondaire' ? hex : normaliserCouleurSecondaire(agence.couleurSecondaire);
    appliquerCouleurs(principale, secondaire);
    if (couleursTimer.current) clearTimeout(couleursTimer.current);
    couleursTimer.current = setTimeout(() => {
      void fetch('/api/dashboard/agence/couleurs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principale, secondaire }),
      }).then(async (res) => {
        if (!res.ok) notifyError('Couleurs non enregistrées');
      });
    }, 400);
  }

  async function exporter() {
    if (vide || exportEnCours) return;
    setExportEnCours(true);
    try {
      const res = await fetch(`/api/dashboard/estimation/${estimation.id}/rapport/pdf`);
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !type.includes('pdf')) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        notifyError(data.error ?? 'Export impossible');
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get('content-disposition') ?? '';
      const nom = /filename="([^"]+)"/.exec(dispo)?.[1] ?? 'avis-de-valeur.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nom;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notifySuccess('PDF téléchargé');
    } catch {
      notifyError('Export impossible');
    } finally {
      setExportEnCours(false);
    }
  }

  async function envoyer() {
    if (vide) return;
    setEnvoi(true);
    try {
      const res = await fetch(`/api/dashboard/estimation/${estimation.id}/rapport/envoyer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo.trim() || undefined,
          message: message.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; envoi?: EnvoiRapport };
      if (!res.ok) throw new Error(data.error ?? 'Envoi impossible');
      if (data.envoi) setEnvois((prev) => [data.envoi!, ...prev]);
      notifySuccess('Avis de valeur envoyé');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-2">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <WorkspaceButton type="button" variant="secondary" onClick={() => importRef.current?.click()}>
              Importer un PDF
            </WorkspaceButton>
            <WorkspaceButton
              type="button"
              variant="secondary"
              disabled={vide || pages.filter(pagePourPdf).length === 0}
              title={vide ? 'Ajoutez au moins une page pour imprimer' : undefined}
              onClick={() => window.open(`/imprimer/estimation/${estimation.id}`, '_blank', 'noopener')}
            >
              Imprimer
            </WorkspaceButton>
            <WorkspaceButton
              type="button"
              variant="secondary"
              aria-expanded={biblioOuverte}
              aria-controls="rapport-bibliotheque"
              onClick={() => setBiblioOuverte((o) => !o)}
            >
              Bibliothèque
              {biblio.length > 0 ? (
                <span className="font-normal tabular-nums text-text-muted">({biblio.length})</span>
              ) : null}
              <ChevronDown
                size={16}
                strokeWidth={2}
                aria-hidden
                className={`shrink-0 ${biblioOuverte ? 'rotate-180' : ''}`}
              />
            </WorkspaceButton>
          </div>
          <WorkspaceButton
            type="button"
            disabled={vide || exportEnCours || pages.filter(pagePourPdf).length === 0}
            title={vide ? 'Ajoutez au moins une page pour télécharger' : undefined}
            onClick={() => void exporter()}
          >
            {exportEnCours ? 'Téléchargement…' : 'Télécharger en PDF'}
          </WorkspaceButton>
        </div>
        {agence ? (
          <div className="flex flex-wrap items-start gap-2">
            <LogoAgenceChamp
              compact
              url={agence.logoUrl}
              onUrl={(url) => {
                setAgence((prev) => (prev ? { ...prev, logoUrl: url } : prev));
                setDossier((prev) =>
                  prev ? { ...prev, agence: { ...prev.agence, logoUrl: url } } : prev,
                );
              }}
            />
            <NuancierAvis
              compact
              accent={normaliserCouleurPrincipale(agence.couleurPrincipale)}
              accent2={normaliserCouleurSecondaire(agence.couleurSecondaire)}
              onAccent={(hex) => changerCouleur('principale', hex)}
              onAccent2={(hex) => changerCouleur('secondaire', hex)}
            />
          </div>
        ) : null}
        {biblioOuverte ? (
          <div
            id="rapport-bibliotheque"
            className="w-fit min-w-[14rem] max-w-sm rounded-clay border border-black/[0.08] bg-surface px-3 py-2.5"
          >
            <p className="text-[13px] font-semibold text-text-strong">Pages de l’agence</p>
            {biblio.length === 0 ? (
              <p className="mt-1.5 text-pretty text-[13px] text-text-muted">
                Aucune page en bibliothèque. Le directeur les crée dans le modèle de rapport.
              </p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1">
                {biblio.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
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
      </div>

      <input
        ref={importRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => void importer(e.target.files?.[0])}
      />

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
              sansChrome={courante?.kind === 'generee'}
            >
              <ApercuPageComposee
                page={courante}
                accent={normaliserCouleurPrincipale(agence.couleurPrincipale)}
                dossier={dossier}
              />
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

          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label htmlFor="rapport-message" className="mb-1.5 block text-[13px] font-medium text-text">
                Message au client
              </label>
              <textarea
                id="rapport-message"
                className="min-h-[7.5rem] w-full resize-y rounded-clay border border-black/[0.1] bg-white px-3 py-2.5 text-[14px] text-text placeholder:text-text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                maxLength={4000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label htmlFor="rapport-email" className="mb-1.5 block text-[13px] font-medium text-text">
                  Destinataire
                </label>
                <input
                  id="rapport-email"
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-clay border border-black/[0.1] bg-white px-3 py-2.5 text-[14px] text-text placeholder:text-text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                  placeholder="client@exemple.fr"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                />
              </div>
              <WorkspaceButton
                type="button"
                variant="secondary"
                disabled={vide}
                title={vide ? 'Ajoutez au moins une page pour envoyer' : undefined}
                onClick={() => {
                  if (envoi) return;
                  void envoyer();
                }}
              >
                Envoyer
              </WorkspaceButton>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-[13px] font-semibold text-text-strong">Envois</h3>
            {envois.length === 0 ? (
              <p className="mt-1.5 text-pretty text-[13px] text-text-muted">
                Aucun envoi pour l’instant.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {envois.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-clay border border-black/[0.06] bg-surface px-3 py-2.5 text-[13px] text-text"
                  >
                    <p className="truncate font-medium">{e.destinataire}</p>
                    <p className="mt-0.5 text-text-muted">
                      {formatDateHeure(e.envoyeAt)}
                      {' · '}
                      Version {e.version}
                      {' · '}
                      {e.premierVuAt
                        ? `Consulté le ${formatDateHeure(e.premierVuAt)}`
                        : 'Pas encore consulté'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

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
