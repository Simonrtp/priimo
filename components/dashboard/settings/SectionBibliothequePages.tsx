'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, GripVertical, Pencil, Trash2 } from 'lucide-react';
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
import ConfirmModal from '@/components/ui/ConfirmModal';

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';
const labelClass = 'mb-1.5 block font-medium text-gray-700';

export default function SectionBibliothequePages() {
  const { user, profile, agency } = useUser();
  const [pages, setPages] = useState<PageBibliotheque[] | null>(null);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PageBibliotheque | null>(null);
  const [editeur, setEditeur] = useState<PageBibliotheque | 'new' | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const charger = useCallback(async () => {
    const res = await fetch('/api/dashboard/rapport/bibliotheque');
    const data = (await res.json()) as { pages?: PageBibliotheque[]; error?: string };
    if (!res.ok) {
      notifyError(data.error ?? 'Bibliothèque indisponible');
      setPages([]);
      return;
    }
    setPages(data.pages ?? []);
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

  async function onUpload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (nom.trim()) form.append('nom', nom.trim());
      if (description.trim()) form.append('description', description.trim());
      const res = await fetch('/api/dashboard/rapport/bibliotheque', { method: 'POST', body: form });
      const data = (await res.json()) as { page?: PageBibliotheque; error?: string };
      if (!res.ok || !data.page) throw new Error(data.error ?? 'Envoi impossible');
      setPages((prev) => [...(prev ?? []), data.page!]);
      setNom('');
      setDescription('');
      notifySuccess('Page ajoutée à la bibliothèque');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !pages) return;
    const from = pages.findIndex((p) => p.id === active.id);
    const to = pages.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(pages, from, to);
    setPages(next);
    const res = await fetch('/api/dashboard/rapport/bibliotheque/ordre', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map((p) => p.id) }),
    });
    if (!res.ok) {
      notifyError('Réordonnancement impossible');
      void charger();
    }
  }

  async function renommer(id: string, nextNom: string) {
    const nomTrim = nextNom.trim();
    if (!nomTrim) return;
    const res = await fetch(`/api/dashboard/rapport/bibliotheque/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: nomTrim }),
    });
    if (!res.ok) notifyError('Renommage impossible');
  }

  async function dupliquer(page: PageBibliotheque) {
    const res = await fetch(`/api/dashboard/rapport/bibliotheque/${page.id}/dupliquer`, { method: 'POST' });
    const data = (await res.json()) as { page?: PageBibliotheque; error?: string };
    if (!res.ok || !data.page) {
      notifyError(data.error ?? 'Copie impossible');
      return;
    }
    setPages((prev) => [...(prev ?? []), data.page!]);
    notifySuccess('Page dupliquée');
  }

  async function supprimer() {
    if (!pending) return;
    const res = await fetch(`/api/dashboard/rapport/bibliotheque/${pending.id}`, { method: 'DELETE' });
    if (!res.ok) {
      notifyError('Suppression impossible');
      return;
    }
    setPages((prev) => (prev ?? []).filter((p) => p.id !== pending.id));
    setPending(null);
    notifySuccess('Page retirée');
  }

  return (
    <div className="border-t border-black/[0.06] pt-5">
      <h3 className="font-semibold text-ink" style={{ fontSize: 16 }}>
        Bibliothèque de pages
      </h3>
      <p className="mt-1 text-pretty text-mute" style={{ fontSize: 13 }}>
        Créez une page dans Priimo, ou importez un PDF. Réutilisable dans tous les avis de valeur.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
          onClick={() => setEditeur('new')}
        >
          Créer une page
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <label htmlFor="biblio-nom" className={labelClass}>
            Nom
          </label>
          <input
            id="biblio-nom"
            className={inputClass}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Présentation de l’agence"
          />
        </div>
        <div>
          <label htmlFor="biblio-desc" className={labelClass}>
            Description
          </label>
          <textarea
            id="biblio-desc"
            className={`${inputClass} min-h-[4.5rem] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionnel — ce que contient cette page"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => void onUpload(e.target.files?.[0])}
        />
        <button
          type="button"
          className="rounded-lg border border-black/10 bg-white px-4 py-2.5 text-[14px] font-medium text-ink hover:bg-black/[0.04] disabled:opacity-50"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Envoi…' : 'Ajouter un PDF ou une image'}
        </button>
      </div>

      {pages === null ? (
        <div className="mt-4 h-16 animate-pulse rounded-lg bg-black/[0.04]" aria-hidden />
      ) : pages.length === 0 ? (
        <p className="mt-4 text-pretty text-[13.5px] text-mute">
          Aucune page pour l’instant. Créez-en une ou déposez un PDF.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
          <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="mt-4 flex flex-col gap-2" aria-label="Pages de la bibliothèque">
              {pages.map((p) => (
                <LigneBiblio
                  key={p.id}
                  page={p}
                  onRename={renommer}
                  onEdit={p.kind === 'modele' ? () => setEditeur(p) : undefined}
                  onDuplicate={() => void dupliquer(p)}
                  onDelete={() => setPending(p)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <EditeurPageAgence
        key={editeur === 'new' ? 'new' : editeur?.id ?? 'ferme'}
        open={editeur !== null}
        page={editeur && editeur !== 'new' ? editeur : null}
        agency={agency}
        profile={profile}
        loginEmail={user.email}
        logoUrl={logoUrl}
        onClose={() => setEditeur(null)}
        onSaved={(saved) => {
          setPages((prev) => {
            const list = prev ?? [];
            const idx = list.findIndex((p) => p.id === saved.id);
            if (idx < 0) return [...list, saved];
            return list.map((p) => (p.id === saved.id ? saved : p));
          });
        }}
      />

      <ConfirmModal
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void supprimer()}
        title="Retirer cette page"
        message={`${pending?.nom ?? ''} quittera la bibliothèque. Les rapports déjà composés gardent une copie si elle a été importée.`}
        primaryLabel="Retirer"
        variant="danger"
      />
    </div>
  );
}

function LigneBiblio({
  page,
  onRename,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  page: PageBibliotheque;
  onRename: (id: string, nom: string) => void;
  onEdit?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const sortable = useSortable({ id: page.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-black/8 bg-white px-2 py-2"
    >
      <button
        type="button"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04]"
        aria-label={`Déplacer ${page.nom}`}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical size={16} strokeWidth={2} aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <input
          className="w-full rounded-md border-0 bg-transparent px-1 py-1 text-[13.5px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent/25"
          defaultValue={page.nom}
          aria-label={`Nom de ${page.nom}`}
          onBlur={(e) => onRename(page.id, e.target.value)}
        />
        <p className="px-1 text-[12px] text-mute">
          {libelleKindPage(page.kind, page.disposition, page.pageCount)}
          {page.description ? ` · ${page.description}` : ''}
        </p>
      </div>
      {onEdit ? (
        <button
          type="button"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04] hover:text-ink"
          aria-label={`Modifier ${page.nom}`}
          onClick={onEdit}
        >
          <Pencil size={16} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04] hover:text-ink"
        aria-label={`Dupliquer ${page.nom}`}
        onClick={onDuplicate}
      >
        <Copy size={16} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04] hover:text-red-700"
        aria-label={`Supprimer ${page.nom}`}
        onClick={onDelete}
      >
        <Trash2 size={16} strokeWidth={2} aria-hidden />
      </button>
    </li>
  );
}
