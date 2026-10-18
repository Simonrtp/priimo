'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, Crown, Plus } from 'lucide-react';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import { ACCUEIL_VUE_COOKIE } from '@/lib/today/accueil-vue';
import { CLASSE_BOUTON_RENVOYER } from '@/components/dashboard/equipe/bouton-renvoyer';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import type { CarteNegociateur } from '@/lib/directeur/assembler';
import type { DirecteurCarte } from '@/lib/directeur/cartes';
import { STATUT_NEGOCIATEUR_LABELS } from '@/lib/directeur/statut';
import { STATUT_STYLE } from './statut-style';

const MANDAT_VERT = { teinte: '#0F8F4A', pastelFort: '#D5EADF' } as const;

function ouvrirSonTableau() {
  const maxAge = 60 * 60 * 24 * 400;
  document.cookie = `${ACCUEIL_VUE_COOKIE}=agent; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/** Anneau de la bulle : 80 px, trait de 5. */
const TAILLE = 80;
const TRAIT = 5;
/** Retrait de la photo dans l'anneau. */
const RETRAIT = 8;
const RAYON = (TAILLE - TRAIT) / 2;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

function ilYa(iso: string | null, maintenant: number): string {
  if (!iso) return 'Pas encore d’activité';
  const jours = Math.floor((maintenant - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(jours) || jours <= 0) return 'Actif aujourd’hui';
  if (jours === 1) return 'Actif hier';
  return `Dernière activité il y a ${jours} j`;
}

/**
 * L'équipe d'un coup d'œil : une bulle par négociateur, dont l'anneau dit où
 * il en est de sa période. Un clic ouvre sa fiche. Les autres avatars
 * s'effacent : seul « Inviter » reste à côté. Un second clic, ou un clic
 * à côté, referme. Depuis la fiche, un bouton ouvre son tableau de bord.
 *
 * Les alertes « à traiter » d'un négociateur vivent dans sa bulle (pastille)
 * et dans sa fiche : rien ne se perd, tout est à sa place.
 */
export default function BullesEquipe({
  negociateurs,
  moiId = null,
  alertes,
  onInviter,
}: {
  negociateurs: readonly CarteNegociateur[];
  /** Le membre connecté : son prénom est suivi de « (Moi) ». */
  moiId?: string | null;
  /** Alertes rattachées à un négociateur. */
  alertes: readonly DirecteurCarte[];
  onInviter: () => void;
}) {
  const [survol, setSurvol] = useState<string | null>(null);
  const [maintenant] = useState(() => Date.now());
  const cadreRef = useRef<HTMLDivElement>(null);
  const ulRef = useRef<HTMLUListElement>(null);
  const places = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!survol) return;
    const fermer = (e: MouseEvent) => {
      if (!cadreRef.current?.contains(e.target as Node)) setSurvol(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSurvol(null);
    };
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fermer);
      document.removeEventListener('keydown', esc);
    };
  }, [survol]);

  useLayoutEffect(() => {
    const ul = ulRef.current;
    if (!ul) return;
    const lis = [...ul.querySelectorAll<HTMLElement>(':scope > li[data-id]')];
    const suivant = new Map<string, number>();
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const li of lis) {
      const id = li.dataset.id ?? '';
      const left = li.getBoundingClientRect().left;
      suivant.set(id, left);
      const avant = places.current.get(id);
      if (avant == null || reduit) continue;
      const dx = avant - left;
      if (Math.abs(dx) < 1) continue;
      for (const anim of li.getAnimations()) anim.cancel();
      li.animate(
        [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }],
        { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
    }
    places.current = suivant;
  }, [survol]);

  function choisir(id: string) {
    setSurvol((courant) => (courant === id ? null : id));
  }

  const alertesDe = (id: string) => alertes.filter((a) => a.membreId === id);
  const meilleurId = (() => {
    if (negociateurs.length < 2) return null;
    let meilleur = negociateurs[0]!;
    let exAequo = false;
    for (const n of negociateurs) {
      if (n.progression > meilleur.progression) {
        meilleur = n;
        exAequo = false;
      } else if (n !== meilleur && n.progression === meilleur.progression) {
        exAequo = true;
      }
    }
    if (exAequo || meilleur.progression <= 0) return null;
    return meilleur.membreId;
  })();

  return (
    <div ref={cadreRef} className="relative min-w-0">
    <ul
      ref={ulRef}
      className="flex items-start gap-6 max-sm:-mx-4 max-sm:overflow-x-auto max-sm:px-3 max-sm:[scrollbar-width:none]"
    >
      {negociateurs.map((n, i) => {
        const style = STATUT_STYLE[n.statut];
        const progression = Math.max(0, Math.min(100, n.progression));
        const sesAlertes = alertesDe(n.membreId);
        const actif = survol === n.membreId;
        const moi = n.membreId === moiId;
        if (survol && !actif) return null;
        const colonne = `${TAILLE}px`;
        return (
          <li
            key={n.membreId}
            data-id={n.membreId}
            className={`pt-4 ${actif ? 'relative z-20 min-w-0 flex-1' : 'shrink-0'}`}
            style={{
              order: actif ? -1 : 0,
              width: actif ? undefined : TAILLE,
            }}
          >
            <div
              className="grid w-full items-start text-left"
              style={{
                gridTemplateColumns: actif ? `${colonne} minmax(0, 1fr)` : `${colonne} minmax(0, 0fr)`,
              }}
            >
            <button
              type="button"
              onClick={() => choisir(n.membreId)}
              aria-expanded={actif}
              aria-label={`${n.prenom} ${n.nom}${moi ? ' (Moi)' : ''}, ${STATUT_NEGOCIATEUR_LABELS[n.statut]}, ${progression} %${n.membreId === meilleurId ? ', meilleur de l’équipe' : ''}`}
              className="group flex flex-col items-center justify-self-start gap-1.5 overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
              style={{ width: TAILLE }}
            >
              <span
                className="relative transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.04] motion-reduce:transition-none"
                style={{ width: TAILLE, height: TAILLE }}
              >
                {n.membreId === meilleurId ? (
                  <Crown
                    size={18}
                    strokeWidth={2.2}
                    aria-hidden
                    className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[70%] text-[#E0A100]"
                    fill="#F5C542"
                  />
                ) : null}
                <svg
                  width={TAILLE}
                  height={TAILLE}
                  viewBox={`0 0 ${TAILLE} ${TAILLE}`}
                  aria-hidden
                  className="absolute inset-0 -rotate-90"
                >
                  <circle cx={TAILLE / 2} cy={TAILLE / 2} r={RAYON} fill="none" stroke="rgba(26,42,86,0.08)" strokeWidth={TRAIT} />
                  <circle
                    cx={TAILLE / 2}
                    cy={TAILLE / 2}
                    r={RAYON}
                    fill="none"
                    stroke={style.barre}
                    strokeWidth={TRAIT}
                    strokeLinecap="round"
                    strokeDasharray={CIRCONFERENCE}
                    strokeDashoffset={CIRCONFERENCE * (1 - progression / 100)}
                    className="motion-safe:animate-anneauRemplit"
                    style={{ '--anneau-c': CIRCONFERENCE, animationDelay: `${i * 70}ms` } as CSSProperties}
                  />
                </svg>
                <span
                  className="absolute overflow-hidden rounded-full shadow-clay-sm"
                  style={{
                    inset: RETRAIT,
                    backgroundColor: style.avatar,
                    // Halo de la couleur du statut sous la bulle survolée.
                    boxShadow: actif ? `0 14px 30px -10px ${style.barre}` : undefined,
                  }}
                >
                  <ProfileAvatar
                    firstName={n.prenom}
                    lastName={n.nom}
                    avatarUrl={n.avatarUrl}
                    size={TAILLE - 2 * RETRAIT}
                  />
                </span>
                {sesAlertes.length > 0 ? (
                  <span
                    className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-[#E8743C] text-[10.5px] font-bold text-white ring-2 ring-white"
                    aria-hidden
                  >
                    {sesAlertes.length}
                  </span>
                ) : null}
              </span>
              {actif ? null : (
                <span className="relative block h-4 w-full">
                  <span className="absolute left-1/2 top-0 max-w-[7.5rem] -translate-x-1/2 truncate whitespace-nowrap text-[12.5px] font-semibold text-text-strong">
                    {n.prenom}
                    {moi ? ' (Moi)' : ''}
                  </span>
                </span>
              )}
              {actif ? null : (
                <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: style.texte }}>
                  {progression}&nbsp;%
                </span>
              )}
            </button>
              <FicheNegociateur
                visible={actif}
                negociateur={n}
                moi={moi}
                derniere={ilYa(n.derniereNoteAt, maintenant)}
              />
            </div>
          </li>
        );
      })}

      <li data-id="invite" className="shrink-0 pt-4" style={{ width: TAILLE }}>
        <button
          type="button"
          onClick={onInviter}
          aria-label="Ajouter un collaborateur"
          className="group flex w-full flex-col items-center gap-1.5"
        >
          <span
            className="flex items-center justify-center rounded-full border-2 border-dashed border-black/15 text-text-subtle transition-colors group-hover:border-primary-400 group-hover:text-primary-600"
            style={{ width: TAILLE, height: TAILLE }}
          >
            <Plus size={22} strokeWidth={2.2} aria-hidden />
          </span>
          <span className="text-[12.5px] font-medium text-text-muted">Inviter</span>
        </button>
      </li>
    </ul>
    </div>
  );
}

export function InvitationsEnAttente({
  invitations,
}: {
  invitations: readonly { id: string; email: string }[];
}) {
  if (invitations.length === 0) return null;
  return (
    <ul className="ml-auto flex flex-wrap items-center justify-end gap-2">
      {invitations.map((invitation) => (
        <InviteEnAttente key={invitation.id} invitation={invitation} />
      ))}
    </ul>
  );
}

function InviteEnAttente({ invitation }: { invitation: { id: string; email: string } }) {
  const [etat, setEtat] = useState<'pret' | 'envoi' | 'envoye' | 'erreur'>('pret');

  async function renvoyer() {
    if (etat === 'envoi') return;
    setEtat('envoi');
    try {
      const res = await fetch(`/api/invitations/${invitation.id}/resend`, { method: 'POST' });
      setEtat(res.ok ? 'envoye' : 'erreur');
    } catch {
      setEtat('erreur');
    }
  }

  return (
    <li className="flex min-w-0 items-center gap-2">
      <span className="max-w-[14rem] truncate text-[12.5px] text-text-muted" title={invitation.email}>
        {invitation.email}
      </span>
      <button
        type="button"
        onClick={() => void renvoyer()}
        disabled={etat === 'envoi' || etat === 'envoye'}
        className={CLASSE_BOUTON_RENVOYER}
      >
        {etat === 'envoi' ? 'Envoi…' : etat === 'envoye' ? 'Envoyé' : etat === 'erreur' ? 'Réessayer' : 'Renvoyer'}
      </button>
    </li>
  );
}

function FicheNegociateur({
  visible,
  negociateur: n,
  moi,
  derniere,
}: {
  visible: boolean;
  negociateur: CarteNegociateur;
  moi: boolean;
  derniere: string;
}) {
  const style = STATUT_STYLE[n.statut];
  const kpis = [
    { label: 'Immeubles', ...n.contacts, ...COULEUR_FAMILLE.immeubles_prospectes },
    { label: 'Estimations', ...n.estimations, ...COULEUR_FAMILLE.estimations },
    { label: 'Mandats', ...n.mandats, teinte: MANDAT_VERT.teinte, pastelFort: MANDAT_VERT.pastelFort, pastille: '#E7F6EE', voile: '#F3FBF6' },
  ];
  const progression = Math.max(0, Math.min(100, n.progression));

  return (
    <div
        data-fiche
        className={`min-w-0 overflow-hidden transition-opacity duration-[1000ms] ease-out motion-reduce:transition-none ${
        visible ? 'opacity-100 delay-200' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <div className="flex min-w-0 items-center gap-5 pl-4">
        <div className={`min-w-0 shrink ${moi ? 'w-[12rem] max-w-[12rem]' : 'w-[9.5rem] max-w-[9.5rem]'}`}>
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-[15px] font-semibold text-text-strong">
              {[n.prenom, n.nom].filter(Boolean).join(' ')}
              {moi ? ' (Moi)' : ''}
            </p>
          </div>
          <p className="mt-1 font-display text-[28px] font-bold leading-none tabular-nums" style={{ color: style.barre }}>
            {progression}
            <span className="text-[15px]">&nbsp;%</span>
          </p>
          <p className="mt-1.5 truncate text-[12px] text-text-muted">{derniere}</p>
        </div>
        <ul className="grid min-w-0 flex-1 grid-cols-3 gap-2">
          {kpis.map((k) => {
            const part = k.objectif > 0 ? Math.min(100, Math.round((k.valeur / k.objectif) * 100)) : 0;
            return (
              <li
                key={k.label}
                className="rounded-[18px] px-3 py-2.5"
                style={{ backgroundColor: k.voile }}
              >
                <p className="text-[11.5px] font-medium text-text-muted">{k.label}</p>
                <p className="mt-1 font-display text-[20px] font-bold leading-none tabular-nums" style={{ color: k.teinte }}>
                  {k.valeur}
                  {k.objectif > 0 ? (
                    <span className="text-[12px] font-medium text-text-subtle"> / {k.objectif}</span>
                  ) : null}
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ backgroundColor: k.pastille }}>
                  <div className="h-full rounded-full" style={{ width: `${part}%`, backgroundColor: k.teinte }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {visible ? (
        <Link
          href={`/dashboard?membre=${encodeURIComponent(n.membreId)}`}
          onClick={ouvrirSonTableau}
          className="ml-4 mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#1A2A56] px-3.5 text-[13px] font-semibold text-white"
        >
          {moi ? 'Voir toutes mes métriques' : 'Voir toutes ses métriques'}
          <ArrowRight size={14} strokeWidth={2.4} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
