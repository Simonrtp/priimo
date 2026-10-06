'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Plus, SlidersHorizontal, X } from 'lucide-react';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import InviteCollaboratorDialog from '@/components/dashboard/equipe/InviteCollaboratorDialog';
import { COULEUR_FAMILLE, GRIS_NEUTRE, ROUGE_ALERTE } from '@/lib/activite/couleurs';
import { FIELD } from '@/lib/today/field';
import type { AccueilDirecteurModele, CarteNegociateur } from '@/lib/directeur/assembler';
import type { DirecteurCarte, DirecteurCarteType } from '@/lib/directeur/cartes';
import {
  STATUT_NEGOCIATEUR_LABELS,
  type StatutNegociateur,
} from '@/lib/directeur/statut';
import SelecteurVueAccueil from './SelecteurVueAccueil';
import Pastilles from '@/components/ui/Pastilles';
import ModeReunion from './ModeReunion';
import ObjectifAgenceDialog from './ObjectifAgenceDialog';

/** Violet objectif — mêmes paliers que BandeauObjectif Accueil agent. */
const OBJECTIF = {
  teinte: '#7C4DD3',
  pastelFort: '#DCCFF7',
  pastille: '#EBE3FA',
  voile: '#F5F1FD',
} as const;

const MANDAT_VERT = {
  teinte: '#0F8F4A',
  pastelFort: '#D5EADF',
  pastille: '#C6F6D6',
  voile: '#ECF6F1',
} as const;

const CREME = {
  voile: '#F9F4EB',
} as const;

const ALERTE_STYLE: Record<
  DirecteurCarteType,
  { label: string; teinte: string; pastel: string; voile: string }
> = {
  mandat_fin_validite: {
    label: 'Fin de mandat',
    teinte: ROUGE_ALERTE.teinte,
    pastel: ROUGE_ALERTE.pastelFort,
    voile: ROUGE_ALERTE.voile,
  },
  decrochage: {
    label: 'Décrochage',
    teinte: COULEUR_FAMILLE.immeubles_prospectes.teinte,
    pastel: COULEUR_FAMILLE.immeubles_prospectes.pastelFort,
    voile: COULEUR_FAMILLE.immeubles_prospectes.voile,
  },
  estimation_sans_relance: {
    label: 'Estimation',
    teinte: COULEUR_FAMILLE.estimations.teinte,
    pastel: COULEUR_FAMILLE.estimations.pastelFort,
    voile: COULEUR_FAMILLE.estimations.voile,
  },
  mandat_vieillit: {
    label: 'Mandat',
    teinte: '#C45D2A',
    pastel: FIELD.orangePastel,
    voile: '#FFF4EC',
  },
  prospects_sans_negociateur: {
    label: 'Prospection',
    teinte: GRIS_NEUTRE.teinte,
    pastel: GRIS_NEUTRE.pastelFort,
    voile: GRIS_NEUTRE.voile,
  },
};

const STATUT_STYLE: Record<
  StatutNegociateur,
  { fond: string; texte: string; barre: string; avatar: string }
> = {
  en_avance: {
    fond: COULEUR_FAMILLE.contacts_qualifies.pastelFort,
    texte: COULEUR_FAMILLE.contacts_qualifies.teinte,
    barre: COULEUR_FAMILLE.contacts_qualifies.teinte,
    avatar: COULEUR_FAMILLE.contacts_qualifies.pastille,
  },
  dans_le_rythme: {
    fond: '#D6DEE8',
    texte: '#3A4A66',
    barre: '#5B6B86',
    avatar: '#E8EEF5',
  },
  a_voir: {
    fond: 'rgba(232, 116, 60, 0.18)',
    texte: '#C45D2A',
    barre: FIELD.orange,
    avatar: '#FFE0C4',
  },
  nouveau: {
    fond: OBJECTIF.pastelFort,
    texte: OBJECTIF.teinte,
    barre: OBJECTIF.teinte,
    avatar: OBJECTIF.pastille,
  },
};

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

function CarteATraiter({
  carte,
  onPreparer,
}: {
  carte: DirecteurCarte;
  onPreparer: (carte: DirecteurCarte) => void;
}) {
  const style = ALERTE_STYLE[carte.type];
  return (
    <article
      className="flex min-h-0 flex-col gap-2 rounded-clay-lg px-3.5 py-3 shadow-clay-sm"
      style={{ backgroundColor: style.voile }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: style.teinte }}
      >
        {style.label}
      </p>
      <p className="text-pretty text-[13.5px] font-medium leading-snug text-text-strong">
        {carte.texte}
      </p>
      {carte.repere ? (
        <p className="text-[12px] text-text-muted">{carte.repere}</p>
      ) : null}
      {carte.action === 'assigner' && carte.href ? (
        <Link
          href={carte.href}
          className="mt-auto inline-flex min-h-9 items-center justify-center rounded-full px-3 text-[12px] font-semibold text-white"
          style={{ backgroundColor: FIELD.orange }}
        >
          Assigner
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onPreparer(carte)}
          className="mt-auto inline-flex min-h-9 items-center justify-center rounded-full px-3 text-[12px] font-semibold"
          style={{ backgroundColor: style.pastel, color: style.teinte }}
        >
          Préparer l&apos;échange
        </button>
      )}
    </article>
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
  onClose,
}: {
  negociateur: CarteNegociateur;
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
  secteur,
}: {
  modele: AccueilDirecteurModele;
  agences: readonly { id: string; name: string }[];
  agenceActiveId: string;
  periode: 'semaine' | 'mois';
  secteur?: ReactNode;
}) {
  const router = useRouter();
  const [preparerId, setPreparerId] = useState<string | null>(null);
  const [reunion, setReunion] = useState(false);
  const [voirTout, setVoirTout] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [objectifOpen, setObjectifOpen] = useState(false);

  const negociateur = modele.negociateurs.find((n) => n.membreId === preparerId) ?? null;
  const cartes = voirTout ? modele.cartes : modele.cartesVisibles;
  const collaborateurs = modele.negociateurs.filter((n) => n.membreId);
  const sansCollaborateur = modele.solo || collaborateurs.length <= 1;

  function changerPeriode(next: 'semaine' | 'mois') {
    const q = new URLSearchParams(window.location.search);
    q.set('periode', next === 'mois' ? '30j' : '7j');
    router.push(`/dashboard?${q.toString()}`);
  }

  if (reunion) {
    return <ModeReunion modele={modele} onClose={() => setReunion(false)} />;
  }

  return (
    <div data-accueil className="flex w-full min-w-0 flex-col gap-4 pb-10" aria-label={modele.titre}>
      <header className="flex flex-row flex-wrap items-center gap-2 sm:gap-3">
        <SelecteurVueAccueil vue="directeur" />
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          <Pastilles
            label="Période"
            value={periode}
            options={
              [
                { id: 'semaine' as const, label: '7j' },
                { id: 'mois' as const, label: '30j' },
              ] as const
            }
            onChange={changerPeriode}
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

      {/* Zone 1 — pleine largeur, compacte */}
      <section aria-labelledby="zone-a-traiter">
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2 id="zone-a-traiter" className="text-[15px] font-semibold text-text-strong sm:text-[16px]">
            À traiter cette semaine
          </h2>
          {modele.cartesReste > 0 && !voirTout ? (
            <button
              type="button"
              onClick={() => setVoirTout(true)}
              className="text-[12.5px] font-medium text-accent-dark hover:underline"
            >
              Voir tout ({modele.cartes.length})
            </button>
          ) : null}
        </div>
        {cartes.length === 0 ? (
          <p className="flex items-center gap-2 rounded-clay-lg bg-surface px-4 py-3 text-[13.5px] text-text-muted shadow-clay-sm">
            <span
              className="inline-flex size-6 items-center justify-center rounded-full"
              style={{ backgroundColor: COULEUR_FAMILLE.contacts_qualifies.pastelFort }}
              aria-hidden
            >
              <Check size={14} strokeWidth={2.4} style={{ color: COULEUR_FAMILLE.contacts_qualifies.teinte }} />
            </span>
            Rien à signaler cette semaine
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cartes.map((c) => (
              <CarteATraiter
                key={c.key}
                carte={c}
                onPreparer={(carte) => {
                  if (carte.membreId) setPreparerId(carte.membreId);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {secteur ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0">{secteur}</div>
        </div>
      ) : null}

      {/* Zones 2 + 3 — deux colonnes desktop */}
      <div className="grid gap-4 lg:grid-cols-5 lg:items-start">
        <section className="min-w-0 lg:col-span-3" aria-labelledby="zone-negociateurs">
          <div className="mb-2 flex items-center gap-2">
            <h2 id="zone-negociateurs" className="text-[15px] font-semibold text-text-strong sm:text-[16px]">
              Les négociateurs
            </h2>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              title="Ajouter un collaborateur"
              aria-label="Ajouter un collaborateur"
              className="inline-flex size-8 items-center justify-center rounded-clay bg-surface text-text-muted shadow-clay-sm transition hover:text-text-strong"
            >
              <Plus size={16} strokeWidth={2.4} />
            </button>
            {sansCollaborateur ? (
              <p className="text-[12.5px] text-text-muted">
                Invitez votre premier collaborateur
              </p>
            ) : null}
          </div>

          {!sansCollaborateur ? (
            <ul className="divide-y divide-black/[0.08]">
              {modele.negociateurs.map((n) => {
                const nomComplet = [n.prenom, n.nom].filter(Boolean).join(' ');
                return (
                  <li key={n.membreId}>
                    <button
                      type="button"
                      onClick={() => setPreparerId(n.membreId)}
                      className="flex w-full items-center gap-3 py-3.5 text-left transition-colors hover:bg-black/[0.02] sm:gap-3.5"
                    >
                      <ProfileAvatar
                        firstName={n.prenom}
                        lastName={n.nom}
                        avatarUrl={n.avatarUrl}
                        size={44}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold text-text-strong">
                          {nomComplet}
                        </p>
                        <div className="mt-2">
                          <div className="mb-1 flex items-baseline justify-between gap-2">
                            <span className="text-[11px] text-text-muted">Cette semaine</span>
                            <span className="text-[12.5px] font-semibold tabular-nums text-text-strong">
                              {n.progression}&nbsp;%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.08]">
                            <div
                              className="h-full rounded-full bg-text-strong"
                              style={{ width: `${n.progression}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <section className="min-w-0 lg:col-span-2" aria-labelledby="zone-agence">
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
        <PanneauPreparer negociateur={negociateur} onClose={() => setPreparerId(null)} />
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
