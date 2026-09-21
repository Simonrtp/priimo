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
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';
const labelClass = 'mb-1.5 block font-medium text-gray-700';

export default function SectionBibliothequePages() {
  const { user, profile, agency, isDirector } = useUser();
  const [modele, setModele] = useState<PageBibliotheque[] | null>(null);
  const [personnel, setPersonnel] = useState<PageBibliotheque[] | null>(null);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PageBibliotheque | null>(null);
  const [editeur, setEditeur] = useState<PageBibliotheque | 'new-agence' | 'new-moi' | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const charger = useCallback(async () => {
    const res = await fetch('/api/dashboard/rapport/bibliotheque');
    const data = (await res.json()) as {
      pages?: PageBibliotheque[];
      modele?: PageBibliotheque[];
      personnel?: PageBibliotheque[];
      error?: string;
    };
    if (!res.ok) {
      notifyError(data.error ?? 'Bibliothèque indisponible');
      setModele([]);
      setPersonnel([]);
      return;
    }
    const all = data.pages ?? [];
    setModele(data.modele ?? all.filter((p) => p.ownerId == null));
    setPersonnel(data.personnel ?? all.filter((p) => p.ownerId != null));
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
      setPersonnel((prev) => [...(prev ?? []), data.page!]);
      setNom('');
      setDescription('');
      notifySuccess('Page ajoutée à votre rapport');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onDragEnd(liste: 'agence' | 'moi', event: DragEndEvent) {
    const { active, over } = event;
    const pages = liste === 'agence' ? modele : personnel;
    if (!over || active.id === over.id || !pages) return;
    const from = pages.findIndex((p) => p.id === active.id);
    const to = pages.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(pages, from, to);
    if (liste === 'agence') setModele(next);
    else setPersonnel(next);
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

  async function dupliquer(page: PageBibliotheque, personnelCible: boolean) {
    const res = await fetch(`/api/dashboard/rapport/bibliotheque/${page.id}/dupliquer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personnel: personnelCible }),
    });
    const data = (await res.json()) as { page?: PageBibliotheque; error?: string };
    if (!res.ok || !data.page) {
      notifyError(data.error ?? 'Copie impossible');
      return;
    }
    if (data.page.ownerId == null) setModele((prev) => [...(prev ?? []), data.page!]);
    else setPersonnel((prev) => [...(prev ?? []), data.page!]);
    notifySuccess(personnelCible ? 'Page reprise dans votre rapport' : 'Page dupliquée');
  }

  async function reprendreModele() {
    if (!modele || modele.length === 0) return;
    setBusy(true);
    try {
      for (const page of modele) {
        const res = await fetch(`/api/dashboard/rapport/bibliotheque/${page.id}/dupliquer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personnel: true }),
        });
        const data = (await res.json()) as { page?: PageBibliotheque; error?: string };
        if (!res.ok || !data.page) throw new Error(data.error ?? 'Copie impossible');
        setPersonnel((prev) => [...(prev ?? []), data.page!]);
      }
      notifySuccess('Modèle repris dans votre rapport');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Copie impossible');
    } finally {
      setBusy(false);
    }
  }

  async function supprimer() {
    if (!pending) return;
    const res = await fetch(`/api/dashboard/rapport/bibliotheque/${pending.id}`, { method: 'DELETE' });
    if (!res.ok) {
      notifyError('Suppression impossible');
      return;
    }
    setModele((prev) => (prev ?? []).filter((p) => p.id !== pending.id));
    setPersonnel((prev) => (prev ?? []).filter((p) => p.id !== pending.id));
    setPending(null);
    notifySuccess('Page retirée');
  }

  if (!user || !profile || !agency) return null;

  const editeurPage = editeur && editeur !== 'new-agence' && editeur !== 'new-moi' ? editeur : null;
  const modeleAgence = editeur === 'new-agence' || (editeurPage != null && editeurPage.ownerId == null);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-semibold text-ink" style={{ fontSize: 18 }}>
          Modifier mon rapport
        </h2>
        <p className="mt-1 text-pretty text-mute" style={{ fontSize: 13.5 }}>
          Le modèle de l’agence reste le gabarit de départ. Chaque agent a ensuite son propre
          rapport, sans écraser celui des autres.
        </p>
      </div>

      <section>
        <h3 className="font-semibold text-ink" style={{ fontSize: 16 }}>
          Modèle de l’agence
        </h3>
        <p className="mt-1 text-pretty text-mute" style={{ fontSize: 13 }}>
          {isDirector
            ? 'Ces pages s’appliquent à toute l’équipe, tant qu’un agent n’a pas repris le modèle.'
            : 'Lecture seule. Reprenez-le pour le personnaliser.'}
        </p>
        {isDirector ? (
          <div className="mt-3">
            <WorkspaceButton type="button" onClick={() => setEditeur('new-agence')}>
              Créer une page modèle
            </WorkspaceButton>
          </div>
        ) : null}
        <ListePages
          pages={modele}
          sensors={sensors}
          lectureSeule={!isDirector}
          onDragEnd={(e) => void onDragEnd('agence', e)}
          onRename={renommer}
          onEdit={isDirector ? (p) => setEditeur(p) : undefined}
          onDuplicate={(p) => void dupliquer(p, !isDirector)}
          onDelete={isDirector ? (p) => setPending(p) : undefined}
          vide="Aucune page modèle pour l’instant."
        />
      </section>

      <section>
        <h3 className="font-semibold text-ink" style={{ fontSize: 16 }}>
          Mon rapport
        </h3>
        <p className="mt-1 text-pretty text-mute" style={{ fontSize: 13 }}>
          Pages utilisées dans vos avis de valeur. Vous pouvez reprendre le modèle, puis modifier.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <WorkspaceButton type="button" onClick={() => setEditeur('new-moi')}>
            Créer une page
          </WorkspaceButton>
          {modele && modele.length > 0 ? (
            <WorkspaceButton
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void reprendreModele()}
            >
              Reprendre le modèle
            </WorkspaceButton>
          ) : null}
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
              placeholder="Présentation"
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
            className="self-start rounded-lg border border-black/10 bg-white px-4 py-2.5 text-[14px] font-medium text-ink hover:bg-black/[0.04] disabled:opacity-50"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? 'Envoi…' : 'Ajouter un PDF ou une image'}
          </button>
        </div>
        <ListePages
          pages={personnel}
          sensors={sensors}
          onDragEnd={(e) => void onDragEnd('moi', e)}
          onRename={renommer}
          onEdit={(p) => setEditeur(p)}
          onDuplicate={(p) => void dupliquer(p, true)}
          onDelete={(p) => setPending(p)}
          vide="Aucune page pour l’instant. Créez-en une ou reprenez le modèle."
        />
      </section>

      <EditeurPageAgence
        key={
          editeur === 'new-agence' || editeur === 'new-moi'
            ? editeur
            : editeur?.id ?? 'ferme'
        }
        open={editeur !== null}
        page={editeurPage}
        agency={agency}
        profile={profile}
        loginEmail={user.email}
        logoUrl={logoUrl}
        modeleAgence={modeleAgence}
        onClose={() => setEditeur(null)}
        onSaved={(saved) => {
          if (saved.ownerId == null) {
            setModele((prev) => upsertPage(prev, saved));
          } else {
            setPersonnel((prev) => upsertPage(prev, saved));
          }
        }}
      />

      <ConfirmModal
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void supprimer()}
        title="Retirer cette page"
        message={`${pending?.nom ?? ''} quittera ${pending?.ownerId ? 'votre rapport' : 'le modèle d’agence'}. Les avis déjà composés gardent une copie.`}
        primaryLabel="Retirer"
        variant="danger"
      />
    </div>
  );
}

function upsertPage(
  prev: PageBibliotheque[] | null,
  saved: PageBibliotheque,
): PageBibliotheque[] {
  const list = prev ?? [];
  const idx = list.findIndex((p) => p.id === saved.id);
  if (idx < 0) return [...list, saved];
  return list.map((p) => (p.id === saved.id ? saved : p));
}

function ListePages({
  pages,
  sensors,
  lectureSeule = false,
  onDragEnd,
  onRename,
  onEdit,
  onDuplicate,
  onDelete,
  vide,
}: {
  pages: PageBibliotheque[] | null;
  sensors: ReturnType<typeof useSensors>;
  lectureSeule?: boolean;
  onDragEnd: (e: DragEndEvent) => void;
  onRename: (id: string, nom: string) => void;
  onEdit?: (page: PageBibliotheque) => void;
  onDuplicate: (page: PageBibliotheque) => void;
  onDelete?: (page: PageBibliotheque) => void;
  vide: string;
}) {
  if (pages === null) {
    return <div className="mt-4 h-16 animate-pulse rounded-lg bg-black/[0.04]" aria-hidden />;
  }
  if (pages.length === 0) {
    return <p className="mt-4 text-pretty text-[13.5px] text-mute">{vide}</p>;
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ul className="mt-4 flex flex-col gap-2" aria-label="Pages">
          {pages.map((p) => (
            <LigneBiblio
              key={p.id}
              page={p}
              lectureSeule={lectureSeule}
              onRename={onRename}
              onEdit={onEdit && p.kind === 'modele' ? () => onEdit(p) : undefined}
              onDuplicate={() => onDuplicate(p)}
              onDelete={onDelete ? () => onDelete(p) : undefined}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function LigneBiblio({
  page,
  lectureSeule,
  onRename,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  page: PageBibliotheque;
  lectureSeule: boolean;
  onRename: (id: string, nom: string) => void;
  onEdit?: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}) {
  const sortable = useSortable({ id: page.id, disabled: lectureSeule });
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
      {lectureSeule ? (
        <span className="size-9 shrink-0" aria-hidden />
      ) : (
        <button
          type="button"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04]"
          aria-label={`Déplacer ${page.nom}`}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical size={16} strokeWidth={2} aria-hidden />
        </button>
      )}
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
        aria-label={lectureSeule ? `Reprendre ${page.nom} dans mon rapport` : `Dupliquer ${page.nom}`}
        onClick={onDuplicate}
      >
        <Copy size={16} strokeWidth={2} aria-hidden />
      </button>
      {onDelete ? (
        <button
          type="button"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04] hover:text-red-700"
          aria-label={`Supprimer ${page.nom}`}
          onClick={onDelete}
        >
          <Trash2 size={16} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </li>
  );
}
