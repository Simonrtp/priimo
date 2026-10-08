'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, FileText, Phone } from 'lucide-react';
import type { TacheDuJour } from '@/lib/today/taches';
import { FIELD } from '@/lib/today/field';
import { notifyError } from '@/lib/notify';
import { useNotesLectureOptional } from '@/components/dashboard/notes/NotesLectureProvider';
import { lienLectureNote } from '@/lib/notes/lecture';
import { vibrateBrief } from './tap';

/**
 * Les tâches du jour, en tête de l'accueil mobile.
 *
 * Posées entre le pense-bête et les objectifs : « Rappeler Janine » se fait
 * avant de regarder ses chiffres. Le numéro est le bouton — un pouce, et le
 * téléphone compose. Le nom ouvre la fiche.
 */
export default function TachesDuJour({ taches }: { taches: readonly TacheDuJour[] }) {
  // Cochées ici, en attendant que le serveur ne les renvoie plus. La liste
  // reste celle du serveur : une note validée entre-temps y apparaît seule.
  const [faites, setFaites] = useState<ReadonlySet<string>>(() => new Set());
  const restantes = taches.filter((t) => !faites.has(t.id));

  if (restantes.length === 0) return null;

  async function terminer(tache: TacheDuJour) {
    vibrateBrief();
    setFaites((ids) => new Set(ids).add(tache.id));
    try {
      const res = await fetch(`/api/dashboard/promesses/${encodeURIComponent(tache.id)}/faite`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('faite');
    } catch {
      setFaites((ids) => {
        const suivant = new Set(ids);
        suivant.delete(tache.id);
        return suivant;
      });
      notifyError("La tâche n'a pas pu être cochée");
    }
  }

  const enRetard = restantes.filter((t) => t.retardJours > 0).length;

  return (
    <section aria-labelledby="taches-du-jour" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id="taches-du-jour" className="text-[16px] font-semibold text-text-strong">
          À faire aujourd’hui
        </h2>
        <p className="text-[12.5px] font-medium tabular-nums text-text-muted">
          {restantes.length} tâche{restantes.length > 1 ? 's' : ''}
          {enRetard > 0 ? (
            <span style={{ color: FIELD.rouge }}>
              {' '}
              · {enRetard} en retard
            </span>
          ) : null}
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {restantes.map((tache) => (
          <li key={tache.id}>
            <CarteTache tache={tache} onFaite={() => void terminer(tache)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CarteTache({ tache, onFaite }: { tache: TacheDuJour; onFaite: () => void }) {
  const lecture = useNotesLectureOptional();
  const { contact } = tache;
  const retard = tache.retardJours > 0;

  function relireNote() {
    if (!tache.noteId) return;
    if (lecture) lecture.ouvrir(tache.noteId);
    else window.location.assign(lienLectureNote(tache.noteId));
  }

  return (
    <article className="flex flex-col gap-3 rounded-clay-lg bg-white px-4 pb-4 pt-3.5 shadow-clay">
      <div className="flex flex-col items-start gap-1.5">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
          style={
            retard
              ? { backgroundColor: FIELD.rougePastel, color: FIELD.rouge }
              : { backgroundColor: FIELD.creme, color: FIELD.orange }
          }
        >
          {retard
            ? `En retard de ${tache.retardJours} jour${tache.retardJours > 1 ? 's' : ''}`
            : 'Aujourd’hui'}
        </span>
        <h3 className="line-clamp-3 text-pretty text-[18px] font-semibold leading-snug text-text-strong">
          {tache.intitule}
        </h3>
      </div>

      {contact ? (
        <Link
          href={`/dashboard/contacts?fiche=${encodeURIComponent(contact.id)}`}
          className="flex min-h-[48px] items-center gap-3 rounded-full bg-bg-subtle py-1.5 pl-1.5 pr-3 active:scale-[0.99] motion-reduce:active:scale-100"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
            style={{ backgroundColor: FIELD.ardoise }}
          >
            {initiales(contact.nom)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-semibold text-text-strong">
              {contact.nom ?? 'Contact'}
            </span>
            <span className="block text-[12px] text-text-muted">Voir la fiche</span>
          </span>
          <ChevronRight size={18} strokeWidth={2.2} aria-hidden className="shrink-0 text-text-muted" />
        </Link>
      ) : null}

      <div className="flex items-center gap-2.5">
        {contact?.tel && contact.telephone ? (
          <a
            href={contact.tel}
            aria-label={`Appeler ${contact.nom ?? 'le contact'} au ${contact.telephone}`}
            className="flex min-h-[52px] min-w-0 flex-1 items-center justify-center gap-2.5 rounded-full px-4 text-white shadow-clay-sm active:scale-[0.99] motion-reduce:active:scale-100"
            style={{ backgroundColor: FIELD.orange }}
          >
            <Phone size={18} strokeWidth={2.4} aria-hidden className="shrink-0" />
            <span className="truncate text-[17px] font-semibold tabular-nums">{contact.telephone}</span>
          </a>
        ) : tache.noteId && !contact ? (
          <button
            type="button"
            onClick={relireNote}
            className="flex min-h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-bg-subtle px-4 text-[14.5px] font-semibold text-text-strong"
          >
            <FileText size={17} strokeWidth={2.2} aria-hidden className="shrink-0" />
            Relire la note
          </button>
        ) : (
          <p className="min-w-0 flex-1 px-1 text-[13px] text-text-muted">
            {contact ? 'Aucun numéro sur la fiche' : 'Aucun contact rattaché'}
          </p>
        )}
        <button
          type="button"
          onClick={onFaite}
          aria-label={`Marquer « ${tache.intitule} » comme faite`}
          className="flex min-h-[52px] shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold active:scale-[0.97] motion-reduce:active:scale-100"
          style={{ backgroundColor: FIELD.vertPastel, color: FIELD.vert }}
        >
          <Check size={18} strokeWidth={2.6} aria-hidden />
          Fait
        </button>
      </div>
    </article>
  );
}

function initiales(nom: string | null): string {
  if (!nom) return '?';
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  const lettres = mots.length > 1 ? [mots[0], mots[mots.length - 1]] : mots;
  return lettres.map((m) => m[0]?.toLocaleUpperCase('fr') ?? '').join('') || '?';
}
