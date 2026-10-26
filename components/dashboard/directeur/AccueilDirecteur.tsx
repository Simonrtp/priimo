'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, SlidersHorizontal } from 'lucide-react';
import InviteCollaboratorDialog from '@/components/dashboard/equipe/InviteCollaboratorDialog';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import { detailCompteur, detailSecteurs, type DetailSurvol } from '@/lib/activite/repartition';
import type { AccueilDirecteurModele } from '@/lib/directeur/assembler';
import SelecteurVueAccueil from './SelecteurVueAccueil';
import { SelecteurFenetre } from '@/components/dashboard/accueil/EnteteSemaine';
import { moisDe, semaineDe, type Periode } from '@/lib/activite/semaines';
import ModeReunion from './ModeReunion';
import ObjectifAgenceDialog from './ObjectifAgenceDialog';
import BullesEquipe, { InvitationsEnAttente } from './BullesEquipe';
import { OBJECTIF } from './statut-style';
import type { VictoireSemaine } from '@/lib/directeur/agence';
import { quandVictoire } from '@/lib/directeur/victoires';
import type { PortraitCollaborateur } from '@/types/contact';
import { nomComplet } from '@/lib/notes/auteur';
import { formatNoteWhen } from '@/lib/notes/format-when';
import { useNotesLectureOptional } from '@/components/dashboard/notes/NotesLectureProvider';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';

export type NoteAgenceLigne = {
  id: string;
  texte: string;
  createdAt: string;
  privee: boolean;
  auteur: PortraitCollaborateur | null;
};

const CREME = {
  voile: '#F9F4EB',
} as const;

function LignesAgence({ modele }: { modele: AccueilDirecteurModele }) {
  const parCle = new Map(modele.familles.map((f) => [f.activite, f]));
  const contacts = parCle.get('contacts_qualifies');
  const notes = parCle.get('informations_terrain');
  const total = modele.secteurs.length;
  const travailles = modele.secteurs.filter((s) => s.travaille).length;
  const detail = modele.equipe.length > 1;

  const lignes: readonly {
    label: string;
    valeur: string;
    muet?: boolean;
    survol: DetailSurvol | null;
  }[] = [
    {
      label: 'Nouveaux contacts',
      valeur: contacts
        ? contacts.objectif > 0
          ? `${contacts.valeur.toLocaleString('fr-FR')} / ${contacts.objectif.toLocaleString('fr-FR')}`
          : contacts.valeur.toLocaleString('fr-FR')
        : '0',
      survol: detail ? detailCompteur(modele.equipe, 'contacts') : null,
    },
    {
      label: 'Notes terrain',
      valeur: (notes?.valeur ?? 0).toLocaleString('fr-FR'),
      survol: detail ? detailCompteur(modele.equipe, 'notes') : null,
    },
    {
      label: total > 1 ? 'Secteurs travaillés' : 'Secteur travaillé',
      valeur:
        total === 0
          ? '—'
          : total === 1
            ? travailles === 1
              ? 'Travaillé'
              : 'Pas travaillé'
            : `${travailles.toLocaleString('fr-FR')} / ${total.toLocaleString('fr-FR')}`,
      survol: detail ? detailSecteurs(modele.equipe) : null,
    },
    {
      label: 'Estimations',
      valeur: 'À venir',
      muet: true,
      survol: null,
    },
  ];

  return (
    <dl className="mb-4 divide-y divide-black/[0.08]">
      {lignes.map((ligne) => {
        const survol =
          ligne.survol && (ligne.survol.lignes.length > 0 || ligne.survol.suite) ? ligne.survol : null;
        return (
          <div
            key={ligne.label}
            tabIndex={survol ? 0 : undefined}
            className="group/ligne py-3 outline-none focus-visible:rounded-clay focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-text-muted">{ligne.label}</dt>
              <dd
                className={`text-[16px] font-semibold tabular-nums ${
                  ligne.muet ? 'text-text-muted' : 'text-text-strong'
                }`}
              >
                {ligne.valeur}
              </dd>
            </div>
            {survol ? (
              <div className="mt-2 hidden flex-col gap-1.5 group-hover/ligne:flex group-focus-within/ligne:flex [@media(hover:none)]:flex">
                {survol.lignes.map((item, index) => (
                  <p key={`${item.prenom}-${index}`} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] text-text-muted">{item.prenom}</span>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums text-text-strong">
                      {item.valeur}
                    </span>
                  </p>
                ))}
                {survol.suite ? <p className="text-[12px] text-text-muted">{survol.suite}</p> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}

function Sticker({
  repos,
  survol,
  fond,
}: {
  repos: string;
  survol: string;
  fond: string;
}) {
  return (
    <span
      aria-hidden
      className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px] transition-transform duration-fluid ease-soft group-hover/sticker:scale-105 motion-reduce:transition-none"
      style={{ backgroundColor: fond }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={repos}
        alt=""
        width={36}
        height={36}
        className="absolute inset-0 m-auto size-9 object-contain transition-[opacity,transform] duration-fluid ease-soft group-hover/sticker:scale-110 group-hover/sticker:opacity-0 motion-reduce:transition-none"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={survol}
        alt=""
        width={36}
        height={36}
        className="absolute inset-0 m-auto size-9 object-contain opacity-0 transition-[opacity,transform] duration-fluid ease-soft group-hover/sticker:scale-110 group-hover/sticker:opacity-100 motion-reduce:transition-none"
      />
    </span>
  );
}

export default function AccueilDirecteur({
  modele,
  agences,
  agenceActiveId,
  periode,
  invitations = [],
  secteur,
  notes = [],
}: {
  modele: AccueilDirecteurModele;
  agences: readonly { id: string; name: string }[];
  agenceActiveId: string;
  periode: 'semaine' | 'mois';
  invitations?: readonly { id: string; email: string }[];
  secteur?: ReactNode;
  notes?: readonly NoteAgenceLigne[];
}) {
  const router = useRouter();
  const [reunion, setReunion] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [objectifOpen, setObjectifOpen] = useState(false);

  // Les alertes d'un négociateur vont dans sa bulle ; celles de l'agence
  // (personne n'en a la charge) restent en tête de ligne.
  const idsEquipe = new Set(modele.negociateurs.map((n) => n.membreId));
  const alertesEquipe = modele.cartes.filter((c) => c.membreId && idsEquipe.has(c.membreId));

  function changerPeriode(next: Periode) {
    const q = new URLSearchParams(window.location.search);
    q.set('periode', next === 'custom' ? '30j' : next);
    router.push(`/dashboard?${q.toString()}`);
  }

  const periodeSemaine: Periode = periode === 'mois' ? '30j' : '7j';

  if (reunion) {
    return <ModeReunion modele={modele} onClose={() => setReunion(false)} />;
  }

  return (
    <div data-accueil data-accueil-agence className="flex w-full min-w-0 flex-col gap-4 pb-10" aria-label={modele.titre}>
      <header className="flex flex-row flex-wrap items-center gap-2 sm:gap-4">
        <SelecteurVueAccueil vue="directeur" />
        <h1 className="font-display text-[24px] font-bold leading-none tracking-[-0.01em] text-text-strong max-sm:sr-only">
          L&apos;agence
        </h1>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          <SelecteurFenetre
            periode={periodeSemaine}
            intervalle={periode === 'mois' ? moisDe(new Date()) : semaineDe(new Date())}
            enCours={false}
            onChanger={changerPeriode}
            etroit
          />
          {agences.length > 1 ? (
            <label className="inline-flex items-center gap-2 text-[13px] text-text-muted">
              <span className="sr-only">Agence</span>
              <select
                className="min-h-9 rounded-clay border border-black/[0.08] bg-white px-3 text-[13px] text-text shadow-clay-sm"
                value={agenceActiveId}
                onChange={(e) => {
                  void fetch('/api/dashboard/active-agency', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agencyId: e.target.value }),
                  }).then(() => router.refresh());
                }}
              >
                {agences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => setReunion(true)}
            className="hidden min-h-9 shrink-0 items-center justify-center rounded-clay bg-surface px-3 text-[12px] font-semibold text-text-muted shadow-clay-sm transition hover:text-text-strong lg:inline-flex"
          >
            Mode réunion
          </button>
        </div>
      </header>

      {/* Zone 1 — l'équipe d'un coup d'œil */}
      <section aria-labelledby="zone-equipe" className="mt-4 rounded-clay-lg bg-surface px-4 pb-2 pt-3 shadow-clay sm:px-5 sm:pb-3 sm:pt-4">
        <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mb-3">
          <h2 id="zone-equipe" className="text-[15px] font-semibold text-text-strong sm:text-[16px]">
            L&apos;équipe
          </h2>
          {modele.cartes.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-muted">
              <span
                className="inline-flex size-5 items-center justify-center rounded-full"
                style={{ backgroundColor: COULEUR_FAMILLE.contacts_qualifies.pastelFort }}
                aria-hidden
              >
                <Check size={12} strokeWidth={2.6} style={{ color: COULEUR_FAMILLE.contacts_qualifies.teinte }} />
              </span>
              Rien à signaler
            </span>
          ) : null}
          <InvitationsEnAttente invitations={invitations} />
        </div>
        <BullesEquipe
          negociateurs={modele.negociateurs}
          moiId={modele.moiId}
          alertes={alertesEquipe}
          onInviter={() => setInviteOpen(true)}
        />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {secteur ? <div className="min-w-0">{secteur}</div> : null}
        <section className="min-w-0 rounded-clay-lg bg-surface px-4 pb-4 pt-4 shadow-clay sm:px-5" aria-labelledby="zone-agence">
          <h2 id="zone-agence" className="mb-2 text-[15px] font-semibold text-text-strong sm:text-[16px]">
            L&apos;agence ce mois
          </h2>

          <div
            className="group/sticker group/objectif mb-4 flex flex-col gap-3 rounded-clay-lg px-4 py-3.5 shadow-clay-sm sm:flex-row sm:items-center sm:gap-4"
            style={{ backgroundColor: OBJECTIF.voile }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Sticker
                repos="/cibles.png"
                survol="/cibles-contour.png"
                fond={OBJECTIF.pastelFort}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                  Objectif de la période
                </p>
                <p className="mt-0.5 text-[22px] font-semibold tabular-nums text-text-strong">
                  {modele.indicateurs.mandatsDuMois}
                  <span className="text-[14px] font-normal text-text-muted">
                    {' '}
                    / {modele.indicateurs.objectifMandatsMois}
                  </span>
                  <span className="ml-2 text-[16px] font-semibold" style={{ color: OBJECTIF.teinte }}>
                    {modele.progressionEquipe}&nbsp;%
                  </span>
                </p>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full"
                  style={{ backgroundColor: OBJECTIF.pastille }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${modele.progressionEquipe}%`,
                      backgroundColor: OBJECTIF.teinte,
                    }}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setObjectifOpen(true)}
              className="inline-flex shrink-0 translate-y-1 items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[12px] font-semibold text-text-strong opacity-0 shadow-clay-sm transition-[opacity,transform] duration-fluid ease-soft pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 group-hover/objectif:pointer-events-auto group-hover/objectif:translate-y-0 group-hover/objectif:opacity-100 group-focus-within/objectif:pointer-events-auto group-focus-within/objectif:translate-y-0 group-focus-within/objectif:opacity-100 motion-reduce:transition-none sm:self-center [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100"
              style={{ backgroundColor: OBJECTIF.pastelFort }}
            >
              <SlidersHorizontal size={13} strokeWidth={2.4} aria-hidden />
              Modifier
            </button>
          </div>

          <LignesAgence modele={modele} />

          <div
            className="group/sticker rounded-clay-lg px-4 py-3.5 shadow-clay-sm"
            style={{ backgroundColor: CREME.voile }}
          >
            <div className="flex items-center gap-2.5">
              <Sticker
                repos="/trophee.png"
                survol="/trophee-contour.png"
                fond={COULEUR_FAMILLE.immeubles_prospectes.pastelFort}
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                Victoires de la semaine
              </p>
            </div>
            {modele.victoires.length === 0 ? (
              <p className="mt-2.5 text-[13px] text-text-muted">Pas encore de victoire cette semaine.</p>
            ) : (
              <ul className="mt-2.5 divide-y divide-black/[0.08]">
                {modele.victoires.map((v, i) => (
                  <VictoireLigne key={`${v.kind}-${v.leadId ?? ''}-${v.quand ?? ''}-${i}`} victoire={v} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <NotesAgence notes={notes} />

      <InviteCollaboratorDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          setInviteOpen(false);
          router.refresh();
        }}
      />

      {objectifOpen ? (
        <ObjectifAgenceDialog
          initial={modele.indicateurs.objectifMandatsMois}
          agents={modele.negociateurs.map((n) => ({
            membreId: n.membreId,
            prenom: n.prenom,
            nom: n.nom,
            avatarUrl: n.avatarUrl,
            moi: n.membreId === modele.moiId,
            objectifs: n.objectifs,
          }))}
          onClose={() => setObjectifOpen(false)}
          onEnregistre={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

function NotesAgence({ notes }: { notes: readonly NoteAgenceLigne[] }) {
  const lecture = useNotesLectureOptional();

  return (
    <section className="rounded-clay-lg bg-surface px-4 pb-2 pt-4 shadow-clay sm:px-5" aria-labelledby="zone-notes">
      <h2 id="zone-notes" className="text-[15px] font-semibold text-text-strong sm:text-[16px]">
        Les notes
      </h2>
      {notes.length === 0 ? (
        <p className="py-4 text-[13.5px] text-text-muted">Aucune note pour l’instant.</p>
      ) : (
        <ul className="mt-1 max-h-[40rem] divide-y divide-black/[0.08] overflow-y-auto">
          {notes.map((note) => {
            const nom = note.auteur ? nomComplet(note.auteur) : '';
            return (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => lecture?.ouvrir(note.id)}
                  className="flex w-full items-start gap-3 rounded-lg py-3 text-left hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {note.auteur ? (
                    <ProfileAvatar
                      firstName={note.auteur.firstName}
                      lastName={note.auteur.lastName}
                      avatarUrl={note.auteur.avatarUrl}
                      size={36}
                      className="mt-0.5 shrink-0"
                    />
                  ) : (
                    <span className="mt-0.5 size-9 shrink-0 rounded-full bg-black/[0.06]" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[14px] font-semibold text-text-strong">
                        {nom || 'Auteur inconnu'}
                      </span>
                      <time dateTime={note.createdAt} className="text-[12.5px] text-text-muted">
                        {formatNoteWhen(note.createdAt)}
                      </time>
                      {note.privee ? <span className="text-[12px] text-text-muted">Privée</span> : null}
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap text-pretty text-[13.5px] leading-snug text-text">
                      {note.texte || 'Sans texte'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const LIEN = 'underline-offset-2 hover:underline';

function VictoireLigne({ victoire }: { victoire: VictoireSemaine }) {
  const quand = victoire.quand ? quandVictoire(victoire.quand) : '';
  const contacts = victoire.contacts ?? [];
  const bien = victoire.bien ?? null;
  const faitsBien = [bien?.precisions, bien?.prix, bien?.achat, bien?.mandat].filter(Boolean).join(' · ');
  const hrefLead = victoire.leadId
    ? `/dashboard/prospection?lead=${victoire.leadId}&vue=liste`
    : null;
  const hrefBien = bien?.id ? `/dashboard/biens?fiche=${bien.id}` : null;

  return (
    <li className="py-2.5 first:pt-1">
      <p className="text-[13.5px] text-text">
        <span className="font-semibold text-text-strong">{victoire.prenom}</span>
        {' — '}
        {victoire.label}
        {quand ? <span className="text-text-muted"> · {quand}</span> : null}
      </p>
      {victoire.adresse ? (
        hrefLead ? (
          <Link href={hrefLead} className={`mt-0.5 block text-[13px] font-medium text-text-strong ${LIEN}`}>
            {victoire.adresse}
          </Link>
        ) : hrefBien ? (
          <Link href={hrefBien} className={`mt-0.5 block text-[13px] font-medium text-text-strong ${LIEN}`}>
            {victoire.adresse}
          </Link>
        ) : (
          <p className="mt-0.5 text-[13px] font-medium text-text-strong">{victoire.adresse}</p>
        )
      ) : hrefLead ? (
        <Link href={hrefLead} className={`mt-0.5 block text-[13px] text-text-muted ${LIEN}`}>
          Voir le lead
        </Link>
      ) : null}
      {contacts.map((contact, index) => (
        <p key={`${contact.id ?? contact.nom}-${index}`} className="mt-0.5 text-[12.5px] text-text-muted">
          {contact.role ? <span>{contact.role} · </span> : null}
          {contact.id ? (
            <Link
              href={`/dashboard/contacts?fiche=${contact.id}`}
              className={`font-medium text-text-strong ${LIEN}`}
            >
              {contact.nom}
            </Link>
          ) : (
            <span className="font-medium text-text-strong">{contact.nom}</span>
          )}
          {contact.telephone ? (
            <>
              {' · '}
              <a href={`tel:${contact.telephone.replace(/\s/g, '')}`} className={LIEN}>
                {contact.telephone}
              </a>
            </>
          ) : null}
          {contact.email ? (
            <>
              {' · '}
              <a href={`mailto:${contact.email}`} className={`break-all ${LIEN}`}>
                {contact.email}
              </a>
            </>
          ) : null}
        </p>
      ))}
      {faitsBien ? (
        <p className="mt-0.5 text-[12.5px] text-text-muted">
          {hrefBien ? (
            <Link href={hrefBien} className={LIEN}>
              {faitsBien}
            </Link>
          ) : (
            faitsBien
          )}
        </p>
      ) : hrefBien && hrefLead ? (
        <Link href={hrefBien} className={`mt-0.5 block text-[12.5px] text-text-muted ${LIEN}`}>
          Voir le bien
        </Link>
      ) : null}
    </li>
  );
}
