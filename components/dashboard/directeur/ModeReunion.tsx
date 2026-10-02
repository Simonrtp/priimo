'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import type { AccueilDirecteurModele, CarteNegociateur } from '@/lib/directeur/assembler';
import type { VictoireSemaine } from '@/lib/directeur/agence';

const OBJECTIF = {
  teinte: '#B89AF0',
  pastille: 'rgba(220, 207, 247, 0.35)',
  barre: '#DCCFF7',
} as const;

const MANDAT = {
  teinte: '#7DDBA8',
  fond: 'rgba(158, 240, 184, 0.18)',
} as const;

type Slide =
  | { id: 'victoires'; kind: 'victoires' }
  | { id: 'objectif'; kind: 'objectif' }
  | { id: `nego-${string}`; kind: 'negociateur'; nego: CarteNegociateur };

/**
 * Mode réunion — projection plein écran pour le point d'équipe.
 * Ordre : victoires → objectif → chaque négociateur (chiffres + progression).
 * Jamais la zone 1, jamais les statuts « À voir ».
 */
export default function ModeReunion({
  modele,
  onClose,
}: {
  modele: AccueilDirecteurModele;
  onClose: () => void;
}) {
  const slides = useMemo<Slide[]>(() => {
    const nego = [...modele.negociateurs].sort((a, b) => {
      if (b.progression !== a.progression) return b.progression - a.progression;
      return a.prenom.localeCompare(b.prenom, 'fr');
    });
    return [
      { id: 'victoires', kind: 'victoires' } as const,
      { id: 'objectif', kind: 'objectif' } as const,
      ...nego.map(
        (n) =>
          ({
            id: `nego-${n.membreId}`,
            kind: 'negociateur',
            nego: n,
          }) as const,
      ),
    ];
  }, [modele.negociateurs]);

  const [index, setIndex] = useState(0);
  const [sens, setSens] = useState<1 | -1>(1);

  const aller = useCallback(
    (delta: number) => {
      setSens(delta >= 0 ? 1 : -1);
      setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + delta)));
    },
    [slides.length],
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') {
        e.preventDefault();
        aller(1);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault();
        aller(-1);
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setSens(-1);
        setIndex(0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        setSens(1);
        setIndex(slides.length - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aller, onClose, slides.length]);

  const slide = slides[index]!;
  const peutAvant = index > 0;
  const peutApres = index < slides.length - 1;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Mode réunion"
      style={{
        background:
          'radial-gradient(120% 80% at 10% -10%, #2a3d72 0%, transparent 55%), radial-gradient(90% 70% at 100% 100%, #152248 0%, transparent 50%), #1a2a56',
      }}
    >
      {/* Atmosphère — grain bitmap (évite feTurbulence plein écran). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Ccircle cx='8' cy='12' r='0.7' fill='%23fff'/%3E%3Ccircle cx='22' cy='4' r='0.6' fill='%23fff'/%3E%3Ccircle cx='41' cy='18' r='0.8' fill='%23fff'/%3E%3Ccircle cx='55' cy='9' r='0.5' fill='%23fff'/%3E%3Ccircle cx='14' cy='31' r='0.6' fill='%23fff'/%3E%3Ccircle cx='33' cy='28' r='0.7' fill='%23fff'/%3E%3Ccircle cx='48' cy='38' r='0.55' fill='%23fff'/%3E%3Ccircle cx='6' cy='48' r='0.65' fill='%23fff'/%3E%3Ccircle cx='27' cy='52' r='0.5' fill='%23fff'/%3E%3Ccircle cx='52' cy='55' r='0.7' fill='%23fff'/%3E%3C/svg%3E\")",
          backgroundSize: '64px 64px',
        }}
      />

      <header className="relative z-[1] flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Mode réunion
          </p>
          <p className="mt-0.5 truncate text-[14px] text-white/70">{modele.titre}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-[13px] tabular-nums text-white/45 sm:block">
            {index + 1} / {slides.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/18"
            aria-label="Quitter le mode réunion"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {/* Zones cliquables gauche / droite — hors en-tête et pied */}
      <button
        type="button"
        aria-label="Diapositive précédente"
        disabled={!peutAvant}
        onClick={() => aller(-1)}
        className="absolute bottom-24 left-0 top-20 z-[1] w-[10%] disabled:pointer-events-none"
      />
      <button
        type="button"
        aria-label="Diapositive suivante"
        disabled={!peutApres}
        onClick={() => aller(1)}
        className="absolute bottom-24 right-0 top-20 z-[1] w-[10%] disabled:pointer-events-none"
      />

      <main className="relative z-[1] flex min-h-0 flex-1 flex-col justify-center px-6 pb-6 sm:px-14 lg:px-20">
        <div
          key={slide.id}
          className={`mx-auto w-full max-w-5xl ${sens >= 0 ? 'reunion-slide-in' : 'reunion-slide-back'}`}
        >
          {slide.kind === 'victoires' ? (
            <SlideVictoires victoires={modele.victoires} />
          ) : null}
          {slide.kind === 'objectif' ? (
            <SlideObjectif
              mandats={modele.indicateurs.mandatsDuMois}
              objectif={modele.indicateurs.objectifMandatsMois}
              progression={modele.progressionEquipe}
            />
          ) : null}
          {slide.kind === 'negociateur' ? <SlideNegociateur nego={slide.nego} /> : null}
        </div>
      </main>

      <footer className="relative z-[2] flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <button
          type="button"
          onClick={() => aller(-1)}
          disabled={!peutAvant}
          className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/18 disabled:opacity-25"
          aria-label="Précédent"
        >
          <ChevronLeft size={22} strokeWidth={2.2} />
        </button>

        <div className="flex flex-col items-center gap-2">
          <ol className="flex items-center gap-2" aria-label="Progression">
            {slides.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-label={`Aller à la diapositive ${i + 1}`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => {
                    setSens(i >= index ? 1 : -1);
                    setIndex(i);
                  }}
                  className={`block h-2 rounded-full transition-[width,background-color] duration-fluid ${
                    i === index ? 'w-7 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'
                  }`}
                />
              </li>
            ))}
          </ol>
          <p className="hidden text-[11px] text-white/35 sm:block">
            ← → pour naviguer · Échap pour quitter
          </p>
        </div>

        <button
          type="button"
          onClick={() => aller(1)}
          disabled={!peutApres}
          className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/18 disabled:opacity-25"
          aria-label="Suivant"
        >
          <ChevronRight size={22} strokeWidth={2.2} />
        </button>
      </footer>
    </div>
  );
}

function SlideVictoires({ victoires }: { victoires: readonly VictoireSemaine[] }) {
  return (
    <div>
      <EnTeteSlide
        icone="/trophee.png"
        fond="rgba(255, 224, 140, 0.22)"
        eyebrow="Cette semaine"
        titre="Victoires"
      />
      {victoires.length === 0 ? (
        <p className="mt-10 max-w-2xl text-[22px] leading-snug text-white/55 sm:text-[26px]">
          Pas encore de victoire cette semaine — la suite du point d&apos;équipe reste à construire.
        </p>
      ) : (
        <ul className="mt-10 grid gap-3 sm:gap-4">
          {victoires.map((v, i) => (
            <li
              key={`${v.kind}-${v.prenom}-${i}`}
              className="flex items-center gap-4 rounded-2xl bg-white/[0.06] px-4 py-3.5 sm:gap-5 sm:px-5 sm:py-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-[14px] sm:size-14"
                style={{
                  backgroundColor:
                    v.kind === 'mandat' ? MANDAT.fond : 'rgba(155, 231, 242, 0.2)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.kind === 'mandat' ? '/contact.png' : '/rendez-vous.png'}
                  alt=""
                  width={36}
                  height={36}
                  className="size-8 object-contain sm:size-9"
                />
              </span>
              <div className="min-w-0">
                <p className="font-display text-[22px] font-bold leading-tight text-white sm:text-[28px]">
                  {v.prenom}
                </p>
                <p className="mt-0.5 text-[15px] text-white/60 sm:text-[17px]">{v.label}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SlideObjectif({
  mandats,
  objectif,
  progression,
}: {
  mandats: number;
  objectif: number;
  progression: number;
}) {
  return (
    <div>
      <EnTeteSlide
        icone="/cibles.png"
        fond="rgba(220, 207, 247, 0.22)"
        eyebrow="Ce mois"
        titre="Objectif d'équipe"
      />
      <p className="mt-10 font-display text-[72px] font-bold leading-none tracking-tight tabular-nums text-white sm:text-[96px]">
        {mandats}
        <span className="text-[32px] font-semibold text-white/45 sm:text-[40px]">
          {' '}
          / {objectif}
        </span>
      </p>
      <p className="mt-3 text-[18px] text-white/55 sm:text-[20px]">
        mandats signés ·{' '}
        <span className="font-semibold tabular-nums" style={{ color: OBJECTIF.teinte }}>
          {progression}&nbsp;%
        </span>
      </p>
      <div
        className="mt-8 h-3 max-w-2xl overflow-hidden rounded-full"
        style={{ backgroundColor: OBJECTIF.pastille }}
        role="progressbar"
        aria-valuenow={progression}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression d'équipe : ${progression} %`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-fluid"
          style={{
            width: `${progression}%`,
            backgroundColor: OBJECTIF.barre,
          }}
        />
      </div>
    </div>
  );
}

function SlideNegociateur({ nego }: { nego: CarteNegociateur }) {
  const nom = [nego.prenom, nego.nom].filter(Boolean).join(' ');
  return (
    <div>
      <div className="flex items-center gap-4 sm:gap-5">
        <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 sm:size-24">
          <ProfileAvatar
            firstName={nego.prenom}
            lastName={nego.nom}
            avatarUrl={nego.avatarUrl}
            size={88}
          />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
            La semaine de
          </p>
          <h2 className="truncate font-display text-[36px] font-bold leading-tight text-white sm:text-[48px]">
            {nom}
          </h2>
        </div>
      </div>

      <p className="mt-10 font-display text-[72px] font-bold leading-none tabular-nums text-white sm:text-[88px]">
        {nego.progression}
        <span className="text-[28px] font-semibold text-white/45 sm:text-[36px]">&nbsp;%</span>
      </p>
      <div className="mt-5 h-2.5 max-w-md overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-white"
          style={{ width: `${nego.progression}%` }}
        />
      </div>

      <ul className="mt-10 grid gap-3 sm:grid-cols-3 sm:gap-4">
        <CompteurProjection
          label="Immeubles"
          valeur={nego.contacts.valeur}
          objectif={nego.contacts.objectif}
          icone="/porte-ouverte.png"
          fond={COULEUR_FAMILLE.immeubles_prospectes.pastelFort}
        />
        <CompteurProjection
          label="Estimations"
          valeur={nego.estimations.valeur}
          objectif={nego.estimations.objectif}
          icone="/calculatrice.png"
          fond={COULEUR_FAMILLE.estimations.pastelFort}
        />
        <CompteurProjection
          label="Mandats"
          valeur={nego.mandats.valeur}
          objectif={nego.mandats.objectif}
          icone="/contact.png"
          fond={MANDAT.fond}
        />
      </ul>
    </div>
  );
}

function CompteurProjection({
  label,
  valeur,
  objectif,
  icone,
  fond,
}: {
  label: string;
  valeur: number;
  objectif: number;
  icone: string;
  fond: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3.5 sm:flex-col sm:items-start sm:gap-3 sm:px-5 sm:py-5">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-[12px]"
        style={{ backgroundColor: fond }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icone} alt="" width={28} height={28} className="size-7 object-contain" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">
          {label}
        </p>
        <p className="mt-0.5 text-[28px] font-bold tabular-nums leading-none text-white sm:text-[32px]">
          {valeur}
          <span className="text-[16px] font-medium text-white/45"> / {objectif}</span>
        </p>
      </div>
    </li>
  );
}

function EnTeteSlide({
  icone,
  fond,
  eyebrow,
  titre,
}: {
  icone: string;
  fond: string;
  eyebrow: string;
  titre: string;
}) {
  return (
    <div className="flex items-center gap-4 sm:gap-5">
      <span
        aria-hidden
        className="flex size-14 shrink-0 items-center justify-center rounded-[16px] sm:size-16"
        style={{ backgroundColor: fond }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icone} alt="" width={40} height={40} className="size-9 object-contain sm:size-10" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {eyebrow}
        </p>
        <h2 className="font-display text-[36px] font-bold leading-tight text-white sm:text-[48px]">
          {titre}
        </h2>
      </div>
    </div>
  );
}
