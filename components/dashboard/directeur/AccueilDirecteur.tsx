'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, SlidersHorizontal } from 'lucide-react';
import InviteCollaboratorDialog from '@/components/dashboard/equipe/InviteCollaboratorDialog';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import type { AccueilDirecteurModele } from '@/lib/directeur/assembler';
import SelecteurVueAccueil from './SelecteurVueAccueil';
import { SelecteurFenetre } from '@/components/dashboard/accueil/EnteteSemaine';
import { moisDe, semaineDe, type Periode } from '@/lib/activite/semaines';
import ModeReunion from './ModeReunion';
import ObjectifAgenceDialog from './ObjectifAgenceDialog';
import BullesEquipe, { InvitationsEnAttente } from './BullesEquipe';
import { OBJECTIF } from './statut-style';

const CREME = {
  voile: '#F9F4EB',
} as const;

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
}: {
  modele: AccueilDirecteurModele;
  agences: readonly { id: string; name: string }[];
  agenceActiveId: string;
  periode: 'semaine' | 'mois';
  invitations?: readonly { id: string; email: string }[];
  secteur?: ReactNode;
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
      <section aria-labelledby="zone-equipe" className="mt-4 rounded-clay-lg bg-surface px-4 pb-3 pt-4 shadow-clay sm:px-5">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
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
                  Objectif d&apos;équipe
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

          <dl className="mb-4 divide-y divide-black/[0.08]">
            {(
              [
                {
                  label: 'Mandats en stock',
                  value: String(modele.indicateurs.mandatsEnStock),
                },
                {
                  label: "Taux d'exclusivité",
                  value:
                    modele.indicateurs.tauxExclusivite == null
                      ? '—'
                      : `${modele.indicateurs.tauxExclusivite} %`,
                },
                {
                  label: 'Mandats +60 j',
                  value: String(modele.indicateurs.mandatsPlusDe60j),
                },
                {
                  label: 'Contacts / mandat',
                  value:
                    modele.indicateurs.contactsParMandat == null
                      ? '—'
                      : String(modele.indicateurs.contactsParMandat),
                },
              ] as const
            ).map((tile) => (
              <div key={tile.label} className="flex items-baseline justify-between gap-3 py-3">
                <dt className="text-[13px] text-text-muted">{tile.label}</dt>
                <dd className="text-[16px] font-semibold tabular-nums text-text-strong">
                  {tile.value}
                </dd>
              </div>
            ))}
          </dl>

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
              <ul className="mt-2.5 space-y-1.5">
                {modele.victoires.map((v, i) => (
                  <li key={`${v.kind}-${i}`} className="text-[13.5px] text-text">
                    <span className="font-semibold">{v.prenom}</span>
                    {' — '}
                    {v.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

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
          onClose={() => setObjectifOpen(false)}
          onEnregistre={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
