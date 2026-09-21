'use client';

import { useCallback, useEffect, useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
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
import { notifyError, notifySuccess } from '@/lib/notify';
import type { PageBibliotheque } from '@/lib/rapport/pages';
import type { SlotModele } from '@/lib/rapport/modele-defaut';

type SlotVue = SlotModele & { nom: string; key: string };

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';
const labelClass = 'mb-1.5 block font-medium text-gray-700';

function cleSlot(slot: SlotModele, index: number): string {
  if (slot.source === 'bibliotheque') return `b:${slot.bibliothequeId}:${index}`;
  return `g:${slot.kindGeneree}:${index}`;
}

export default function SectionModeleRapport() {
  const [slots, setSlots] = useState<SlotVue[] | null>(null);
  const [pages, setPages] = useState<PageBibliotheque[]>([]);
  const [emailModele, setEmailModele] = useState('');
  const [sauvegardeEmail, setSauvegardeEmail] = useState(false);

  const charger = useCallback(async () => {
    const res = await fetch('/api/dashboard/agence/rapport-modele');
    const data = (await res.json()) as {
      slots?: Array<SlotModele & { nom: string }>;
      pages?: PageBibliotheque[];
      emailModele?: string;
      error?: string;
    };
    if (!res.ok) {
      notifyError(data.error ?? 'Modèle indisponible');
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
    setEmailModele(data.emailModele ?? '');
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

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
    if (!slots) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = slots.findIndex((s) => s.key === active.id);
    const to = slots.findIndex((s) => s.key === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(slots, from, to).map((s, i) => ({ ...s, key: cleSlot(s, i) }));
    void enregistrerSlots(next);
  }

  function ajouter(page: PageBibliotheque) {
    const base = slots ?? [];
    const slot: SlotVue = {
      source: 'bibliotheque',
      bibliothequeId: page.id,
      nom: page.nom,
      key: cleSlot({ source: 'bibliotheque', bibliothequeId: page.id }, base.length),
    };
    void enregistrerSlots([...base, slot]);
  }

  function retirer(key: string) {
    if (!slots) return;
    void enregistrerSlots(slots.filter((s) => s.key !== key).map((s, i) => ({ ...s, key: cleSlot(s, i) })));
  }

  async function enregistrerEmail() {
    setSauvegardeEmail(true);
    try {
      const res = await fetch('/api/dashboard/agence/rapport-modele', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailModele }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        notifyError(data.error ?? 'Message non enregistré');
        return;
      }
      notifySuccess('Message enregistré');
    } finally {
      setSauvegardeEmail(false);
    }
  }

  const disponibles = pages.filter(
    (p) => !(slots ?? []).some((s) => s.source === 'bibliotheque' && s.bibliothequeId === p.id),
  );

  return (
    <div className="border-t border-black/[0.06] pt-5">
      <h3 className="text-[15px] font-semibold text-ink">Modèle de rapport</h3>
      <p className="mt-1 text-pretty text-[13px] text-mute">
        Ordre des pages reprises dans chaque nouvel avis de valeur. L’agent peut ensuite ajouter,
        retirer ou réordonner les pages de son rapport, sans modifier ce modèle.
      </p>

      {slots === null ? (
        <div className="mt-3 h-24 animate-pulse rounded-lg bg-black/[0.04]" aria-hidden />
      ) : (
        <div className="mt-3 rounded-lg border border-black/8 bg-white p-3">
          {slots.length === 0 ? (
            <p className="text-pretty text-[13.5px] text-mute">
              Aucune page dans le modèle. Les nouveaux rapports démarrent vides.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={slots.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                <ol className="flex flex-col gap-1" aria-label="Pages du modèle">
                  {slots.map((slot, i) => (
                    <LigneSlot
                      key={slot.key}
                      slot={slot}
                      index={i}
                      onDelete={() => retirer(slot.key)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
          {disponibles.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-black/[0.06] pt-3">
              {disponibles.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[13.5px] text-ink">{p.nom}</span>
                  <WorkspaceButton type="button" variant="secondary" onClick={() => ajouter(p)}>
                    Ajouter
                  </WorkspaceButton>
                </li>
              ))}
            </ul>
          ) : pages.length === 0 ? (
            <p className="mt-3 text-pretty text-[13px] text-mute">
              Créez d’abord des pages dans « Modifier mon rapport ».
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="rapport-email-modele" className={labelClass}>
          Message d’envoi
        </label>
        <p className="mb-2 text-pretty text-[12.5px] text-mute">
          Texte proposé à l’agent avant l’envoi. Il reste libre de le modifier.
        </p>
        <textarea
          id="rapport-email-modele"
          className={`${inputClass} min-h-[8.5rem] resize-y`}
          maxLength={4000}
          value={emailModele}
          onChange={(e) => setEmailModele(e.target.value)}
        />
        <WorkspaceButton
          type="button"
          className="mt-2"
          disabled={sauvegardeEmail}
          onClick={() => void enregistrerEmail()}
        >
          {sauvegardeEmail ? 'Enregistrement…' : 'Enregistrer le message'}
        </WorkspaceButton>
      </div>
    </div>
  );
}

function LigneSlot({
  slot,
  index,
  onDelete,
}: {
  slot: SlotVue;
  index: number;
  onDelete: () => void;
}) {
  const sortable = useSortable({ id: slot.key });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.45 : 1,
  };
  return (
    <li ref={sortable.setNodeRef} style={style} className="flex items-center gap-1 rounded-lg hover:bg-black/[0.03]">
      <button
        type="button"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04]"
        aria-label={`Déplacer ${slot.nom}`}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical size={15} strokeWidth={2} aria-hidden />
      </button>
      <span className="min-w-0 flex-1 truncate py-1.5 text-[13.5px] text-ink">
        <span className="mr-1.5 tabular-nums text-mute">{index + 1}.</span>
        {slot.nom}
      </span>
      <button
        type="button"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-mute hover:bg-black/[0.04] hover:text-red-700"
        aria-label={`Retirer ${slot.nom}`}
        onClick={onDelete}
      >
        <Trash2 size={15} strokeWidth={2} aria-hidden />
      </button>
    </li>
  );
}
