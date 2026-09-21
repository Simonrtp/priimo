'use client';

import { useCallback, useEffect, useState } from 'react';
import { GripVertical, Pencil, Trash2, X } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import EditeurPageAgence from './EditeurPageAgence';
import { libelleKindPage } from '@/lib/rapport/modele';
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
import { notifyError, notifySuccess } from '@/lib/notify';
import type { PageBibliotheque } from '@/lib/rapport/pages';
import {
  KINDS_GENEREES,
  LIBELLE_KIND_GENEREE,
  type SlotModele,
} from '@/lib/rapport/modele-defaut';
import ConfirmModal from '@/components/ui/ConfirmModal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';

type SlotVue = SlotModele & { nom: string; key: string };

function cleSlot(slot: SlotModele, index: number): string {
  if (slot.source === 'bibliotheque') return `b:${slot.bibliothequeId}:${index}`;
  return `g:${slot.kindGeneree}:${index}`;
}

function upsertPage(prev: PageBibliotheque[] | null, saved: PageBibliotheque): PageBibliotheque[] {
  const list = prev ?? [];
  const idx = list.findIndex((p) => p.id === saved.id);
  if (idx < 0) return [...list, saved];
  return list.map((p) => (p.id === saved.id ? saved : p));
}

export default function SectionBibliothequePages() {
  const { user, profile, agency, isDirector } = useUser();
  const [pages, setPages] = useState<PageBibliotheque[] | null>(null);
  const [slots, setSlots] = useState<SlotVue[] | null>(null);
  const [pending, setPending] = useState<PageBibliotheque | null>(null);
  const [editeur, setEditeur] = useState<PageBibliotheque | 'new' | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const res = await fetch('/api/dashboard/agence/rapport-modele');
    const data = (await res.json()) as {
      slots?: Array<SlotModele & { nom: string }>;
      pages?: PageBibliotheque[];
      error?: string;
    };
    if (!res.ok) {
      notifyError(data.error ?? 'Modèle indisponible');
      setPages([]);
      setSlots([]);
      return;
    }
    setPages(data.pages ?? []);
    setSlots(
      (data.slots ?? []).map((s, i) => ({
        ...s,
        key: cleSlot(s, i),
      })),
    );
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    void fetch('/api/dashboard/agence/logo')
      .then((r) => r.json())
      .then((data: { url?: string | null }) => setLogoUrl(data.url ?? null))
      .catch(() => undefined);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function enregistrerSlots(next: SlotVue[]) {
    setSlots(next);
    const res = await fetch('/api/dashboard/agence/rapport-modele', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slots: next.map((s) =>
          s.source === 'bibliotheque'
            ? { source: 'bibliotheque', bibliothequeId: s.bibliothequeId }
            : { source: 'generee', kindGeneree: s.kindGeneree },
        ),
      }),
    });
    if (!res.ok) {
      notifyError('Modèle non enregistré');
      void charger();
    }
  }

  function onDragEnd(event: DragEndEvent) {
    if (!slots || !isDirector) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = slots.findIndex((s) => s.key === active.id);
    const to = slots.findIndex((s) => s.key === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(slots, from, to).map((s, i) => ({ ...s, key: cleSlot(s, i) }));
    void enregistrerSlots(next);
  }

  function ajouterGeneree(kind: (typeof KINDS_GENEREES)[number]) {
    const base = slots ?? [];
    if (base.some((s) => s.source === 'generee' && s.kindGeneree === kind)) return;
    const slot: SlotVue = {
      source: 'generee',
      kindGeneree: kind,
      nom: LIBELLE_KIND_GENEREE[kind],
      key: cleSlot({ source: 'generee', kindGeneree: kind }, base.length),
    };
    void enregistrerSlots([...base, slot]);
  }

  function ajouterAuModele(page: PageBibliotheque) {
    const base = slots ?? [];
    const slot: SlotVue = {
      source: 'bibliotheque',
      bibliothequeId: page.id,
      nom: page.nom,
      key: cleSlot({ source: 'bibliotheque', bibliothequeId: page.id }, base.length),
    };
    void enregistrerSlots([...base, slot]);
  }

  function retirerDuModele(key: string) {
    if (!slots) return;
    void enregistrerSlots(slots.filter((s) => s.key !== key).map((s, i) => ({ ...s, key: cleSlot(s, i) })));
  }

  async function renommer(id: string, nextNom: string) {
    const nomTrim = nextNom.trim();
    if (!nomTrim) return;
    const res = await fetch(`/api/dashboard/rapport/bibliotheque/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: nomTrim }),
    });
    if (!res.ok) {
      notifyError('Renommage impossible');
      return;
    }
    setPages((prev) => (prev ?? []).map((p) => (p.id === id ? { ...p, nom: nomTrim } : p)));
    setSlots((prev) =>
      (prev ?? []).map((s) =>
        s.source === 'bibliotheque' && s.bibliothequeId === id ? { ...s, nom: nomTrim } : s,
      ),
    );
  }

  async function supprimer() {
    if (!pending) return;
    const res = await fetch(`/api/dashboard/rapport/bibliotheque/${pending.id}`, { method: 'DELETE' });
    if (!res.ok) {
      notifyError('Suppression impossible');
      return;
    }
    const id = pending.id;
    setPages((prev) => (prev ?? []).filter((p) => p.id !== id));
    setSlots((prev) =>
      (prev ?? [])
        .filter((s) => !(s.source === 'bibliotheque' && s.bibliothequeId === id))
        .map((s, i) => ({ ...s, key: cleSlot(s, i) })),
    );
    setPending(null);
    notifySuccess('Page retirée de la bibliothèque');
  }

  if (!user || !profile || !agency) return null;

  const editeurPage = editeur && editeur !== 'new' ? editeur : null;
  const idsDansModele = new Set(
    (slots ?? [])
      .filter((s): s is SlotVue & { source: 'bibliotheque' } => s.source === 'bibliotheque')
      .map((s) => s.bibliothequeId),
  );

  return (
    <div className="flex flex-col gap-8">
      {isDirector ? (
        <div>
          <WorkspaceButton type="button" onClick={() => setEditeur('new')}>
            Créer une page
          </WorkspaceButton>
        </div>
      ) : (
        <p className="text-pretty text-[13.5px] text-mute">Lecture seule — le directeur compose le modèle.</p>
      )}

      <section>
        <h2 className="text-balance text-[16px] font-semibold text-ink">Modèle</h2>
        <p className="mt-1 text-pretty text-[13px] text-mute">
          Ordre des pages dans chaque nouvel avis de valeur. Un rapport déjà envoyé ne bouge pas.
        </p>
        {slots === null ? (
          <div className="mt-4 h-16 animate-pulse rounded-lg bg-black/[0.04]" aria-hidden />
        ) : slots.length === 0 ? (
          <p className="mt-4 text-pretty text-[13.5px] text-mute">
            {isDirector
              ? 'Aucune page dans le modèle. Ajoutez-en une depuis la bibliothèque.'
              : 'Le modèle est encore vide.'}
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={slots.map((s) => s.key)} strategy={verticalListSortingStrategy}>
              <ol className="mt-4 flex flex-col gap-2" aria-label="Pages du modèle">
                {slots.map((slot, i) => (
                  <LigneSlot
                    key={slot.key}
                    slot={slot}
                    index={i}
                    lectureSeule={!isDirector}
                    onDelete={isDirector ? () => retirerDuModele(slot.key) : undefined}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {isDirector && slots ? (
        <section>
          <h2 className="text-balance text-[16px] font-semibold text-ink">Pages de données</h2>
          <p className="mt-1 text-pretty text-[13px] text-mute">
            Pages produites depuis le dossier. Retirez-les du modèle ou remettez-les ici.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {KINDS_GENEREES.filter(
              (k) => !slots.some((s) => s.source === 'generee' && s.kindGeneree === k),
            ).map((k) => (
              <li key={k}>
                <WorkspaceButton type="button" variant="secondary" onClick={() => ajouterGeneree(k)}>
                  {LIBELLE_KIND_GENEREE[k]}
                </WorkspaceButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-balance text-[16px] font-semibold text-ink">Bibliothèque</h2>
        <p className="mt-1 text-pretty text-[13px] text-mute">
          Toutes les pages de l’agence. {isDirector ? 'Ajoutez-les au modèle quand elles doivent figurer par défaut.' : ''}
        </p>
        {pages === null ? (
          <div className="mt-4 h-16 animate-pulse rounded-lg bg-black/[0.04]" aria-hidden />
        ) : pages.length === 0 ? (
          <p className="mt-4 text-pretty text-[13.5px] text-mute">
            {isDirector
              ? 'Aucune page pour l’instant. Créez-en une pour commencer.'
              : 'Aucune page en bibliothèque.'}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2" aria-label="Pages de la bibliothèque">
            {pages.map((p) => (
              <LigneBiblio
                key={p.id}
                page={p}
                lectureSeule={!isDirector}
                dejaAuModele={idsDansModele.has(p.id)}
                onRename={renommer}
                onEdit={isDirector && p.kind === 'modele' ? () => setEditeur(p) : undefined}
                onAjouter={isDirector && !idsDansModele.has(p.id) ? () => ajouterAuModele(p) : undefined}
                onDelete={isDirector ? () => setPending(p) : undefined}
              />
            ))}
          </ul>
        )}
      </section>

      {isDirector ? (
        <EditeurPageAgence
          key={editeur === 'new' ? 'new' : editeur?.id ?? 'ferme'}
          open={editeur !== null}
          page={editeurPage}
          agency={agency}
          profile={profile}
          loginEmail={user.email}
          logoUrl={logoUrl}
          onClose={() => setEditeur(null)}
          onSaved={(saved) => setPages((prev) => upsertPage(prev, saved))}
        />
      ) : null}

      <ConfirmModal
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void supprimer()}
        title="Retirer cette page"
        message={`${pending?.nom ?? ''} quittera la bibliothèque. Les avis déjà composés gardent une copie.`}
        primaryLabel="Retirer"
        variant="danger"
      />
    </div>
  );
}

function LigneSlot({
  slot,
  index,
  lectureSeule,
  onDelete,
}: {
  slot: SlotVue;
  index: number;
  lectureSeule: boolean;
  onDelete?: () => void;
}) {
  const sortable = useSortable({ id: slot.key, disabled: lectureSeule });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.45 : 1,
  };
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-black/8 bg-white px-2 py-2"
    >
      {lectureSeule ? (
        <span className="size-11 shrink-0" aria-hidden />
      ) : (
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04]"
          aria-label={`Déplacer ${slot.nom}`}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical size={16} strokeWidth={2} aria-hidden />
        </button>
      )}
      <span className="min-w-0 flex-1 truncate py-1 text-[13.5px] text-ink">
        <span className="mr-1.5 tabular-nums text-mute">{index + 1}.</span>
        {slot.nom}
      </span>
      {onDelete ? (
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04] hover:text-red-700"
          aria-label={`Retirer ${slot.nom} du modèle`}
          onClick={onDelete}
        >
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

function LigneBiblio({
  page,
  lectureSeule,
  dejaAuModele,
  onRename,
  onEdit,
  onAjouter,
  onDelete,
}: {
  page: PageBibliotheque;
  lectureSeule: boolean;
  dejaAuModele: boolean;
  onRename: (id: string, nom: string) => void;
  onEdit?: () => void;
  onAjouter?: () => void;
  onDelete?: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-black/8 bg-white px-3 py-2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        {lectureSeule ? (
          <p className="px-1 py-1 text-[13.5px] font-medium text-ink">{page.nom}</p>
        ) : (
          <input
            className="w-full rounded-md border-0 bg-transparent px-1 py-1 text-[13.5px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent/25"
            defaultValue={page.nom}
            aria-label={`Nom de ${page.nom}`}
            onBlur={(e) => onRename(page.id, e.target.value)}
          />
        )}
        <p className="px-1 text-[12px] text-mute">
          {libelleKindPage(page.kind, page.disposition, page.pageCount)}
          {page.description ? ` · ${page.description}` : ''}
          {dejaAuModele ? ' · Dans le modèle' : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1">
        {onAjouter ? (
          <WorkspaceButton type="button" variant="secondary" className="shrink-0" onClick={onAjouter}>
            Ajouter au modèle
          </WorkspaceButton>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04] hover:text-ink"
            aria-label={`Modifier ${page.nom}`}
            onClick={onEdit}
          >
            <Pencil size={16} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04] hover:text-red-700"
            aria-label={`Supprimer ${page.nom}`}
            onClick={onDelete}
          >
            <Trash2 size={16} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  );
}
