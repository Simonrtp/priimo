'use client';

import { useState, type CSSProperties } from 'react';
import { Crown, Plus } from 'lucide-react';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import type { CarteNegociateur } from '@/lib/directeur/assembler';
import type { DirecteurCarte } from '@/lib/directeur/cartes';
import { STATUT_NEGOCIATEUR_LABELS } from '@/lib/directeur/statut';
import { STATUT_STYLE } from './statut-style';

const MANDAT_VERT = { teinte: '#0F8F4A', pastelFort: '#D5EADF' } as const;

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
 * il en est de sa période. Au survol, sa fiche s'ouvre et les autres bulles
 * s'effacent ; un clic ouvre le panneau pour préparer l'échange.
 *
 * Les alertes « à traiter » d'un négociateur vivent dans sa bulle (pastille)
 * et dans sa fiche : rien ne se perd, tout est à sa place.
 */
export default function BullesEquipe({
  negociateurs,
  alertes,
  periodeLabel,
  onOuvrir,
  onInviter,
  invitations = [],
}: {
  negociateurs: readonly CarteNegociateur[];
  /** Alertes rattachées à un négociateur. */
  alertes: readonly DirecteurCarte[];
  periodeLabel: string;
  onOuvrir: (membreId: string) => void;
  onInviter: () => void;
  invitations?: readonly { id: string; email: string }[];
}) {
  const [survol, setSurvol] = useState<string | null>(null);
  const [maintenant] = useState(() => Date.now());

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

  function survoler(id: string) {
    if (!window.matchMedia('(hover: hover)').matches) return;
    setSurvol(id);
  }

  return (
    <ul
      className="flex items-start max-sm:-mx-4 max-sm:overflow-x-auto max-sm:px-3 max-sm:[scrollbar-width:none]"
      onMouseLeave={() => setSurvol(null)}
    >
      {negociateurs.map((n, i) => {
        const style = STATUT_STYLE[n.statut];
        const progression = Math.max(0, Math.min(100, n.progression));
        const sesAlertes = alertesDe(n.membreId);
        const actif = survol === n.membreId;
        const efface = survol !== null && !actif;
        return (
          <li
            key={n.membreId}
            className={`min-w-0 overflow-hidden transition-[flex-grow,opacity,padding] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              efface ? 'pointer-events-none flex-none p-0 opacity-0' : actif ? 'flex-1 pr-0 opacity-100' : 'flex-none pr-5 opacity-100'
            }`}
          >
            <button
              type="button"
              onMouseEnter={() => survoler(n.membreId)}
              onFocus={() => survoler(n.membreId)}
              onBlur={() => setSurvol(null)}
              onClick={() => onOuvrir(n.membreId)}
              aria-label={`${n.prenom} ${n.nom}, ${STATUT_NEGOCIATEUR_LABELS[n.statut]}, ${progression} %${n.membreId === meilleurId ? ', meilleur de l’équipe' : ''}`}
              className="grid w-full items-center text-left outline-none transition-[grid-template-columns] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-primary-200 motion-reduce:transition-none"
              style={{
                gridTemplateColumns: efface ? '0fr 0fr' : actif ? '5.5rem minmax(0,1fr)' : '5.5rem 0fr',
              }}
            >
              <span className="flex w-[5.5rem] min-w-0 flex-col items-center gap-1.5 overflow-hidden">
              <span className="relative" style={{ width: TAILLE, height: TAILLE }}>
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
                  className="absolute overflow-hidden rounded-full shadow-clay-sm transition-[transform,box-shadow] duration-300 ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
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
              <span className={`max-w-full truncate text-[12.5px] font-semibold text-text-strong ${actif ? 'sr-only' : ''}`}>{n.prenom}</span>
              <span className={`text-[11.5px] font-semibold tabular-nums ${actif ? 'sr-only' : ''}`} style={{ color: style.texte }}>
                {progression}&nbsp;%
              </span>
              </span>
              <FicheNegociateur
                visible={actif}
                negociateur={n}
                periodeLabel={periodeLabel}
                derniere={ilYa(n.derniereNoteAt, maintenant)}
              />
            </button>
          </li>
        );
      })}

      {invitations.map((invitation) => (
        <InviteEnAttente key={invitation.id} invitation={invitation} />
      ))}

      <li
        className={`shrink-0 overflow-hidden transition-[max-width,opacity,padding] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          survol ? 'max-w-0 p-0 opacity-0' : 'max-w-[5.5rem] pr-1 opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={onInviter}
          aria-label="Ajouter un collaborateur"
          className="group flex w-[92px] flex-col items-center gap-1.5 pb-1 pt-1.5"
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
  );
}

function InviteEnAttente({ invitation }: { invitation: { id: string; email: string } }) {
  const [etat, setEtat] = useState<'pret' | 'envoi' | 'envoye' | 'erreur'>('pret');
  const nom = invitation.email.split('@')[0] || invitation.email;

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
    <li className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1.5 pr-5">
      <span
        className="flex items-center justify-center rounded-full border-2 border-dashed border-black/15 bg-black/[0.02] text-[18px] font-semibold uppercase text-text-subtle"
        style={{ width: TAILLE, height: TAILLE }}
        title={invitation.email}
      >
        {nom.slice(0, 1)}
      </span>
      <span className="max-w-full truncate text-[12.5px] font-semibold text-text-strong" title={invitation.email}>
        {nom}
      </span>
      <button
        type="button"
        onClick={() => void renvoyer()}
        disabled={etat === 'envoi' || etat === 'envoye'}
        className="text-[11.5px] font-semibold text-[#1A2A56] underline-offset-2 hover:underline disabled:no-underline disabled:opacity-60"
      >
        {etat === 'envoi' ? 'Envoi…' : etat === 'envoye' ? 'Envoyé' : etat === 'erreur' ? 'Réessayer' : 'Renvoyer'}
      </button>
    </li>
  );
}

function FicheNegociateur({
  visible,
  negociateur: n,
  periodeLabel,
  derniere,
}: {
  visible: boolean;
  negociateur: CarteNegociateur;
  periodeLabel: string;
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
      className={`min-w-0 overflow-hidden transition-opacity duration-500 ease-out motion-reduce:transition-none ${
        visible ? 'opacity-100 delay-100' : 'opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <div className="flex min-w-[32rem] items-center gap-5 pl-4">
        <div className="w-[9.5rem] shrink-0">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-[15px] font-semibold text-text-strong">
              {[n.prenom, n.nom].filter(Boolean).join(' ')}
            </p>
          </div>
          <p className="mt-1 font-display text-[28px] font-bold leading-none tabular-nums" style={{ color: style.barre }}>
            {progression}
            <span className="text-[15px]">&nbsp;%</span>
          </p>
          <p className="mt-1.5 truncate text-[12px] text-text-muted">{derniere}</p>
          <span
            className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: style.fond, color: style.texte }}
          >
            {STATUT_NEGOCIATEUR_LABELS[n.statut]} · {periodeLabel}
          </span>
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
    </div>
  );
}
