'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, SlidersHorizontal, X } from 'lucide-react';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import InviteCollaboratorDialog from '@/components/dashboard/equipe/InviteCollaboratorDialog';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import type { AccueilDirecteurModele, CarteNegociateur } from '@/lib/directeur/assembler';
import type { DirecteurCarte } from '@/lib/directeur/cartes';
import { STATUT_NEGOCIATEUR_LABELS } from '@/lib/directeur/statut';
import SelecteurVueAccueil from './SelecteurVueAccueil';
import { SelecteurFenetre } from '@/components/dashboard/accueil/EnteteSemaine';
import { moisDe, semaineDe, type Periode } from '@/lib/activite/semaines';
import ModeReunion from './ModeReunion';
import ObjectifAgenceDialog from './ObjectifAgenceDialog';
import BullesEquipe from './BullesEquipe';
import { ALERTE_STYLE, OBJECTIF, STATUT_STYLE } from './statut-style';

const MANDAT_VERT = {
  teinte: '#0F8F4A',
  pastelFort: '#D5EADF',
  pastille: '#C6F6D6',
  voile: '#ECF6F1',
} as const;

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

function CompteurMini({
  label,
  valeur,
  objectif,
  famille,
  icon,
}: {
  label: string;
  valeur: number;
  objectif: number;
  famille: keyof typeof COULEUR_FAMILLE | 'mandat';
  icon: string;
}) {
  const c =
    famille === 'mandat' ? MANDAT_VERT : COULEUR_FAMILLE[famille];
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: c.pastelFort }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" width={14} height={14} className="size-3.5 object-contain" />
      </span>
      <span className="truncate text-[11.5px] tabular-nums text-text-muted">
        <span className="font-semibold" style={{ color: c.teinte }}>
          {valeur}
        </span>
        /{objectif} {label}
      </span>
    </div>
  );
}

function PanneauPreparer({
  negociateur,
  alertes,
  onClose,
}: {
  negociateur: CarteNegociateur;
  alertes: readonly DirecteurCarte[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statut = STATUT_STYLE[negociateur.statut];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fermer" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-clay-lg">
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex size-11 items-center justify-center rounded-full"
              style={{ backgroundColor: statut.avatar }}
            >
              <ProfileAvatar
                firstName={negociateur.prenom}
                lastName={negociateur.nom}
                avatarUrl={negociateur.avatarUrl}
                size={40}
              />
            </span>
            <div>
              <p className="text-[16px] font-semibold text-text-strong">{negociateur.prenom}</p>
              <p className="text-[13px]" style={{ color: statut.texte }}>
                {STATUT_NEGOCIATEUR_LABELS[negociateur.statut]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-full hover:bg-black/[0.04]"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-5 p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
              Période
            </p>
            <p className="mt-2 text-[28px] font-semibold tabular-nums" style={{ color: statut.barre }}>
              {negociateur.progression}&nbsp;%
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: statut.fond }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${negociateur.progression}%`,
                  backgroundColor: statut.barre,
                }}
              />
            </div>
          </div>
          <ul className="grid gap-3">
            <li className="rounded-xl border border-black/[0.06] px-3 py-2.5">
              <CompteurMini
                label="immeubles"
                valeur={negociateur.contacts.valeur}
                objectif={negociateur.contacts.objectif}
                famille="immeubles_prospectes"
                icon="/bureau.png"
              />
            </li>
            <li className="rounded-xl border border-black/[0.06] px-3 py-2.5">
              <CompteurMini
                label="estimations"
                valeur={negociateur.estimations.valeur}
                objectif={negociateur.estimations.objectif}
                famille="estimations"
                icon="/calculatrice.png"
              />
            </li>
            <li className="rounded-xl border border-black/[0.06] px-3 py-2.5">
              <CompteurMini
                label="mandats"
                valeur={negociateur.mandats.valeur}
                objectif={negociateur.mandats.objectif}
                famille="mandat"
                icon="/contact.png"
              />
            </li>
          </ul>
          {alertes.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                À voir ensemble
              </p>
              <ul className="mt-2 grid gap-2">
                {alertes.map((a) => {
                  const style = ALERTE_STYLE[a.type];
                  const corps = (
                    <>
                      <span
                        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                        style={{ color: style.teinte }}
                      >
                        {style.label}
                      </span>
                      <span className="text-pretty text-[13.5px] font-medium leading-snug text-text-strong">
                        {a.texte}
                      </span>
                      {a.repere ? <span className="text-[12px] text-text-muted">{a.repere}</span> : null}
                    </>
                  );
                  return (
                    <li key={a.key}>
                      {a.href ? (
                        <Link
                          href={a.href}
                          className="flex flex-col gap-1 rounded-xl px-3 py-2.5 transition-[filter] hover:brightness-[0.98]"
                          style={{ backgroundColor: style.voile }}
                        >
                          {corps}
                        </Link>
                      ) : (
                        <div className="flex flex-col gap-1 rounded-xl px-3 py-2.5" style={{ backgroundColor: style.voile }}>
                          {corps}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <p className="text-[12.5px] leading-relaxed text-text-muted">
            Les notes privées comptent dans le volume, leur contenu n&apos;apparaît jamais ici.
          </p>
          <Link
            href={`/dashboard?membre=${encodeURIComponent(negociateur.membreId)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-clay bg-[#1a2a56] px-4 text-[14px] font-semibold text-white"
            onClick={() => {
              document.cookie = `priimo_accueil_vue=agent; path=/; max-age=${60 * 60 * 24 * 400}; SameSite=Lax`;
            }}
          >
            Voir son Accueil (lecture)
          </Link>
        </div>
      </aside>
    </div>
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
  const [preparerId, setPreparerId] = useState<string | null>(null);
  const [reunion, setReunion] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [objectifOpen, setObjectifOpen] = useState(false);

  const negociateur = modele.negociateurs.find((n) => n.membreId === preparerId) ?? null;
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
    <div data-accueil className="flex w-full min-w-0 flex-col gap-4 pb-10" aria-label={modele.titre}>
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
      <section aria-labelledby="zone-equipe" className="rounded-clay-lg bg-surface px-4 pb-3 pt-4 shadow-clay sm:px-5">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="zone-equipe" className="text-[15px] font-semibold text-text-strong sm:text-[16px]">
            L&apos;équipe
          </h2>
          {modele.cartes.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-muted sm:ml-auto">
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
        </div>
        <BullesEquipe
          negociateurs={modele.negociateurs}
          alertes={alertesEquipe}
          periodeLabel={periode === 'mois' ? '30 j' : '7 j'}
          onOuvrir={setPreparerId}
          onInviter={() => setInviteOpen(true)}
          invitations={invitations}
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

      {negociateur ? (
        <PanneauPreparer
          negociateur={negociateur}
          alertes={alertesEquipe.filter((a) => a.membreId === negociateur.membreId)}
          onClose={() => setPreparerId(null)}
        />
      ) : null}

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
