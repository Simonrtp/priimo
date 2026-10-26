'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import NoteEntitySearch, { type NoteLinkPick } from '@/components/dashboard/notes/NoteEntitySearch';
import { useUser } from '@/lib/hooks/useUser';
import { notifyError, notifySuccess } from '@/lib/notify';
import { FIELD } from '@/lib/today/field';
import { formatNoteWhen } from '@/lib/notes/format-when';
import {
  estRattachee,
  LIBELLE_ENTITE,
  syntheseRattachement,
} from '@/lib/notes/rattachement';
import type { NoteLecture } from '@/lib/notes/lecture';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import { nomComplet } from '@/lib/notes/auteur';
import { bilanDuMois } from '@/lib/notes/temps-gagne';
import PanneauAlerte, { FOND_ALERTE, FOND_ALERTE_OUVERT } from '@/components/ui/PanneauAlerte';

const FOND_OUVERT = '#F1F2F4';

function nomAuteur(note: NoteLecture): string {
  if (note.author) {
    const nom = nomComplet(note.author);
    if (nom) return nom;
  }
  return note.authorName?.trim() || 'Auteur inconnu';
}

type PorteeNotes = 'toutes' | 'miennes' | 'publiques';

const PORTEES: readonly { id: PorteeNotes; label: string }[] = [
  { id: 'toutes', label: 'Toutes' },
  { id: 'miennes', label: 'Les miennes' },
  { id: 'publiques', label: 'Publiques' },
];

function normaliser(valeur: string): string {
  return valeur.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function correspondRecherche(note: NoteLecture, q: string): boolean {
  if (!q) return true;
  const morceaux = [note.transcript ?? '', nomAuteur(note), ...note.rattachements.map((r) => r.label)];
  return normaliser(morceaux.join(' ')).includes(q);
}

type GroupeAgent = {
  id: string;
  nom: string;
  author: NoteLecture['author'];
  notes: NoteLecture[];
};

function grouperParAgent(notes: readonly NoteLecture[]): GroupeAgent[] {
  const map = new Map<string, GroupeAgent>();
  for (const note of notes) {
    const id = note.createdBy || 'inconnu';
    const deja = map.get(id);
    if (deja) {
      deja.notes.push(note);
      continue;
    }
    map.set(id, { id, nom: nomAuteur(note), author: note.author, notes: [note] });
  }
  return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

function libelleGroupe(notes: readonly NoteLecture[]): string {
  const publiques = notes.filter((n) => n.visibilite !== 'privee').length;
  if (publiques === notes.length) {
    return `${notes.length} publique${notes.length > 1 ? 's' : ''}`;
  }
  return `${notes.length} note${notes.length > 1 ? 's' : ''}`;
}

function LigneNote({
  note,
  active,
  onChoisir,
  onRafraichir,
}: {
  note: NoteLecture;
  active: boolean;
  onChoisir: (id: string) => void;
  onRafraichir: () => void;
}) {
  const ligne = useRef<HTMLLIElement>(null);
  const [montee, setMontee] = useState(active);
  const [ouverte, setOuverte] = useState(active);
  const rattachee = estRattachee(note.rattachements);
  const vocale = note.hasAudio;

  useEffect(() => {
    if (active) {
      setMontee(true);
      const frame = window.requestAnimationFrame(() => setOuverte(true));
      ligne.current?.scrollIntoView({ block: 'nearest' });
      return () => window.cancelAnimationFrame(frame);
    }
    setOuverte(false);
    const timer = window.setTimeout(() => setMontee(false), 320);
    return () => window.clearTimeout(timer);
  }, [active]);

  return (
    <li
      ref={ligne}
      className="border-b border-[#1A2A56]/12 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] last:border-b-0 motion-reduce:transition-none"
      style={{
        background: !rattachee ? (active ? FOND_ALERTE_OUVERT : FOND_ALERTE) : active ? FOND_OUVERT : '#FFFFFF',
        borderBottomWidth: 0.5,
      }}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => onChoisir(note.id)}
          aria-expanded={active}
          aria-controls={`note-fiche-${note.id}`}
          className={`flex min-w-0 flex-1 items-start gap-2.5 px-4 py-3 text-left transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
            rattachee ? 'hover:bg-[#F1F2F4]' : 'hover:bg-[#FFC48E]'
          }`}
        >
          {note.author ? (
            <ProfileAvatar
              firstName={note.author.firstName}
              lastName={note.author.lastName}
              avatarUrl={note.author.avatarUrl}
              size={36}
              className="mt-0.5 shrink-0"
            />
          ) : (
            <span className="mt-0.5 size-9 shrink-0 rounded-full bg-black/10" aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-text-strong">
                {nomAuteur(note)}
              </span>
              <time dateTime={note.createdAt} className="text-[12px] font-medium text-text-muted">
                {formatNoteWhen(note.createdAt)}
              </time>
            </span>
            <span className="mt-0.5 line-clamp-3 text-pretty text-[14px] leading-snug text-text">
              {(note.transcript ?? '').trim() || 'Sans texte'}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-medium text-text-muted">
              <span>{vocale ? 'Vocale' : 'Écrite'}</span>
              {note.visibilite === 'privee' ? <span>· Privée</span> : null}
              {rattachee ? (
                <span className="min-w-0 truncate">· {syntheseRattachement(note.rattachements)}</span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: '#8A3D14' }}>
                  · <PanneauAlerte size={12} label={null} /> Non rattachée
                </span>
              )}
            </span>
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden
            className={`mt-1 shrink-0 text-text-subtle transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
              active ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      <div
        id={`note-fiche-${note.id}`}
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{ gridTemplateRows: ouverte ? '1fr' : '0fr' }}
      >
        <div className={ouverte ? 'min-h-0 overflow-visible' : 'min-h-0 overflow-hidden'}>
          {montee ? <DetailNote note={note} onRafraichir={onRafraichir} /> : null}
        </div>
      </div>
    </li>
  );
}

function GroupeAgentNotes({
  groupe,
  ouvert,
  onBasculer,
  choisieId,
  onChoisir,
  onRafraichir,
}: {
  groupe: GroupeAgent;
  ouvert: boolean;
  onBasculer: () => void;
  choisieId: string | null;
  onChoisir: (id: string) => void;
  onRafraichir: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#1A2A56]/12 bg-white">
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={onBasculer}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-[#F1F2F4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
      >
        {groupe.author ? (
          <ProfileAvatar
            firstName={groupe.author.firstName}
            lastName={groupe.author.lastName}
            avatarUrl={groupe.author.avatarUrl}
            size={36}
            className="shrink-0"
          />
        ) : (
          <span className="size-9 shrink-0 rounded-full bg-black/10" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-text-strong">
            {groupe.nom}
          </span>
          <span className="text-[12px] font-medium text-text-muted">{libelleGroupe(groupe.notes)}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={`shrink-0 text-text-subtle transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
            ouvert ? 'rotate-180' : ''
          }`}
        />
      </button>
      {ouvert ? (
        <ul className="border-t border-[#1A2A56]/12">
          {groupe.notes.map((note) => (
            <LigneNote
              key={note.id}
              note={note}
              active={note.id === choisieId}
              onChoisir={onChoisir}
              onRafraichir={onRafraichir}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function NotesLectureCard({
  notes,
  erreur,
  noteIdInitial,
  onClose,
  onChoisir,
  onRafraichir,
}: {
  notes: NoteLecture[] | null;
  erreur: boolean;
  noteIdInitial: string | null;
  onClose: () => void;
  onChoisir: (id: string | null) => void;
  onRafraichir: () => void;
}) {
  const { profile, isDirector } = useUser();
  const [choisieId, setChoisieId] = useState<string | null>(noteIdInitial);
  const [recherche, setRecherche] = useState('');
  const [portee, setPortee] = useState<PorteeNotes>('toutes');
  const [agentsOuverts, setAgentsOuverts] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setChoisieId(noteIdInitial);
  }, [noteIdInitial]);

  const liste = notes ?? [];
  const q = normaliser(recherche.trim());
  const cherche = q.length > 0;
  const filtrees = useMemo(
    () => (cherche ? liste.filter((n) => correspondRecherche(n, q)) : liste),
    [liste, cherche, q],
  );
  const miennes = filtrees.filter((n) => n.createdBy === profile.id);
  const autres = filtrees.filter((n) => n.createdBy !== profile.id);
  const publiques = filtrees.filter((n) => n.visibilite !== 'privee');
  const groupes = grouperParAgent(portee === 'publiques' ? publiques : autres);
  const mois = bilanDuMois(liste.filter((n) => n.createdBy === profile.id && n.hasAudio));

  useEffect(() => {
    if (!choisieId) return;
    const note = liste.find((n) => n.id === choisieId);
    if (!note || note.createdBy === profile.id) return;
    const id = note.createdBy || 'inconnu';
    setAgentsOuverts((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, [choisieId, liste, profile.id]);

  function choisir(id: string) {
    const suivant = choisieId === id ? null : id;
    setChoisieId(suivant);
    onChoisir(suivant);
  }

  function basculerAgent(id: string) {
    setAgentsOuverts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const montrerMiennes = portee !== 'publiques';
  const montrerEquipe = portee !== 'miennes';
  const rien =
    (montrerMiennes ? miennes.length : 0) + (montrerEquipe ? groupes.length : 0) === 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={isDirector ? 'Les notes' : 'Mes notes'}
      description={
        isDirector
          ? 'Toutes les notes de l’agence. Chaque note indique qui l’a écrite.'
          : 'Les vôtres, et celles que l’équipe a rendues visibles.'
      }
      maxWidth="xl"
    >
      <div className="border-t border-black/[0.06] pt-4">
        <div className="flex min-h-0 flex-col">
          {notes === null ? (
            <p className="text-pretty py-8 text-[13.5px] font-medium text-mute">
              Les notes arrivent.
            </p>
          ) : erreur ? (
            <p className="text-pretty py-8 text-[13.5px] font-medium text-text-strong">
              Les notes n’ont pas pu être chargées. Fermez et réouvrez la carte.
            </p>
          ) : notes.length === 0 ? (
            <p className="text-pretty py-8 text-[13.5px] font-medium text-text-strong">
              Aucune note pour l’instant. Ajoutez-en depuis la carte Notes terrain.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2.5">
                <label className="relative block">
                  <Search
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
                  />
                  <input
                    type="search"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Rechercher une note, un agent, une adresse"
                    aria-label="Rechercher une note"
                    className="w-full rounded-clay border border-black/[0.08] bg-surface py-2.5 pl-9 pr-3 text-[14px] text-text-strong outline-none placeholder:text-text-subtle focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
                  />
                </label>
                <div role="tablist" aria-label="Quelles notes" className={`${PASTILLE_TRACK} w-full`}>
                  {PORTEES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={portee === p.id}
                      onClick={() => setPortee(p.id)}
                      className={`${pastilleClass(portee === p.id)} min-w-0 flex-1 text-center`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              {mois.notes > 0 ? (
                <p className="rounded-xl bg-primary-50 px-3 py-2 text-[12.5px] font-medium text-primary-700">
                  Ce mois-ci : {mois.notes} note{mois.notes > 1 ? 's' : ''} dictée{mois.notes > 1 ? 's' : ''}
                  {mois.minutes >= 1 ? ` · ≈ ${mois.libelle} de saisie évitées` : ''}
                </p>
              ) : null}
              {rien ? (
                <p className="text-pretty py-6 text-[13.5px] font-medium text-text-strong">
                  {cherche
                    ? 'Aucune note ne correspond à cette recherche.'
                    : portee === 'miennes'
                      ? 'Aucune note à vous pour l’instant.'
                      : 'Aucune note publique de l’équipe pour l’instant.'}
                </p>
              ) : (
                <>
                  {montrerMiennes && miennes.length > 0 ? (
                    <section>
                      {portee === 'toutes' && groupes.length > 0 ? (
                        <h3 className="mb-1.5 px-1 font-semibold uppercase" style={{ fontSize: 11, color: FIELD.ardoise }}>
                          Les miennes
                        </h3>
                      ) : null}
                      <ul className="overflow-hidden rounded-[28px] border border-[#1A2A56]/12 bg-white">
                        {miennes.map((note) => (
                          <LigneNote
                            key={note.id}
                            note={note}
                            active={note.id === choisieId}
                            onChoisir={choisir}
                            onRafraichir={onRafraichir}
                          />
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  {montrerEquipe && groupes.length > 0 ? (
                    <section className="flex flex-col gap-2">
                      <h3 className="px-1 font-semibold uppercase" style={{ fontSize: 11, color: FIELD.ardoise }}>
                        {portee === 'toutes' && groupes.every((g) => g.notes.every((n) => n.visibilite !== 'privee'))
                          ? 'Publiques, par agent'
                          : 'Par agent'}
                      </h3>
                      {groupes.map((groupe) => (
                        <GroupeAgentNotes
                          key={groupe.id}
                          groupe={groupe}
                          ouvert={cherche || agentsOuverts.has(groupe.id)}
                          onBasculer={() => basculerAgent(groupe.id)}
                          choisieId={choisieId}
                          onChoisir={choisir}
                          onRafraichir={onRafraichir}
                        />
                      ))}
                    </section>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DetailNote({
  note,
  onRafraichir,
}: {
  note: NoteLecture;
  onRafraichir: () => void;
}) {
  const { profile } = useUser();
  const [recherche, setRecherche] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const rattachee = estRattachee(note.rattachements);
  const peutRattacher = Boolean(profile.id && note.createdBy === profile.id);

  async function rattacher(pick: NoteLinkPick) {
    setEnCours(true);
    try {
      const res = await fetch(`/api/dashboard/voice-notes/${note.id}/liens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entiteType: pick.entiteType,
          entiteId: pick.entiteId,
          creePar: 'agent',
          confiance: 'certain',
        }),
      });
      if (!res.ok) throw new Error('lien');
      notifySuccess('Rattachement enregistré');
      setRecherche(false);
      onRafraichir();
    } catch {
      notifyError('Le rattachement n’a pas pu être ajouté');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <article
      className="flex flex-col gap-4 border-t border-[#1A2A56]/10 px-4 pb-5 pt-4"
      role="region"
      aria-label={`Note de ${nomAuteur(note)}`}
    >
      <p className="whitespace-pre-wrap text-pretty text-[15px] leading-relaxed text-text-strong">
        {(note.transcript ?? '').trim() || 'Sans texte'}
      </p>

      <section>
        <h3 className="mb-2 font-semibold uppercase" style={{ fontSize: 11, color: FIELD.ardoise }}>
          Rattachée à
        </h3>
        {rattachee ? (
          <ul className="flex flex-col gap-2">
            {note.rattachements.map((r) => {
              const corps = (
                <>
                  <span className="text-[11.5px] font-semibold uppercase" style={{ color: FIELD.ardoise }}>
                    {LIBELLE_ENTITE[r.type]}
                  </span>
                  <span className="mt-0.5 block truncate text-[14px] font-semibold text-text-strong">
                    {r.label}
                  </span>
                </>
              );
              return (
                <li key={`${r.type}:${r.id}`}>
                  {r.href ? (
                    <Link
                      href={r.href}
                      className="flex items-center gap-3 rounded-clay border border-black/12 bg-white px-3.5 py-3 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <span className="min-w-0 flex-1">{corps}</span>
                      <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-text-subtle" aria-hidden />
                    </Link>
                  ) : (
                    <div className="rounded-clay border border-black/12 bg-white px-3.5 py-3">{corps}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              className="flex flex-col gap-3 rounded-clay border border-dashed px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: 'rgba(138, 61, 20, 0.35)', backgroundColor: 'rgba(232, 116, 60, 0.1)' }}
            >
              <div className="flex items-start gap-2.5">
                <PanneauAlerte size={16} label="Note à rattacher" className="mt-0.5" />
                <div>
                  <p className="text-[14px] font-semibold text-text-strong">Non rattachée</p>
                  <p className="mt-0.5 text-pretty text-[13px] font-medium" style={{ color: '#8A3D14' }}>
                    Cette note n’est liée à aucun contact, bien, prospect, adresse ou parcelle.
                  </p>
                </div>
              </div>
              {peutRattacher ? (
                <WorkspaceButton
                  type="button"
                  className="shrink-0 self-start sm:self-center"
                  disabled={enCours}
                  onClick={() => setRecherche((o) => !o)}
                  aria-expanded={recherche}
                >
                  {recherche ? 'Fermer' : 'Rattacher'}
                </WorkspaceButton>
              ) : null}
            </div>
            {peutRattacher && recherche ? (
              <NoteEntitySearch
                className="w-full max-w-none"
                disabled={enCours}
                onPick={(pick) => void rattacher(pick)}
              />
            ) : null}
          </div>
        )}
      </section>
    </article>
  );
}
