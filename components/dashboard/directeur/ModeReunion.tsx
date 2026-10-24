'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import type { AccueilDirecteurModele, CarteNegociateur } from '@/lib/directeur/assembler';
import type { VictoireSemaine } from '@/lib/directeur/agence';

/** Les teintes de la projection : pastels des familles, lavande de l'objectif, orange Priimo. */
const TEINTE = {
  immeubles: COULEUR_FAMILLE.immeubles_prospectes.pastelFort,
  estimations: COULEUR_FAMILLE.estimations.pastelFort,
  mandats: COULEUR_FAMILLE.contacts_qualifies.pastelFort,
  objectif: '#DCCFF7',
  or: '#FFD873',
  orange: '#E8743C',
} as const;

/** Fond clair des initiales : lisibles sur le bleu nuit. */
const FOND_AVATAR = '#E9EDFA';

/** Les illustrations de la projection, chargées dès l'ouverture : aucune n'apparaît en retard devant l'équipe. */
const ICONES = ['/trophee.png', '/cibles.png', '/contact.png', '/rendez-vous.png', '/porte-ouverte.png', '/calculatrice.png'];

type Slide =
  | { id: 'ouverture'; kind: 'ouverture' }
  | { id: 'victoires'; kind: 'victoires' }
  | { id: 'objectif'; kind: 'objectif' }
  | { id: `nego-${string}`; kind: 'negociateur'; nego: CarteNegociateur }
  | { id: 'cloture'; kind: 'cloture' };

/** Le halo de chaque diapositive : deux lueurs qui glissent lentement derrière le contenu. */
// Lueurs froides (bleu, sarcelle, lavande) : l'orange et l'or virent au brun sur le bleu nuit ; la chaleur
// passe par les chiffres dorés et les pastels.
const HALOS: Record<Slide['kind'], [string, string]> = {
  ouverture: ['#3D6BFF', '#2BB3A8'],
  victoires: ['#3D6BFF', '#B89AF0'],
  objectif: ['#B89AF0', '#3D6BFF'],
  negociateur: ['#2BB3A8', '#3D6BFF'],
  cloture: ['#B89AF0', '#2BB3A8'],
};

/**
 * Mode réunion — projection plein écran pour le point d'équipe.
 * Ordre : ouverture → victoires → objectif → chaque négociateur → clôture.
 * Jamais la zone 1, jamais les statuts « À voir ».
 */
export default function ModeReunion({
  modele,
  onClose,
}: {
  modele: AccueilDirecteurModele;
  onClose: () => void;
}) {
  const equipe = useMemo(
    () =>
      [...modele.negociateurs].sort((a, b) => {
        if (b.progression !== a.progression) return b.progression - a.progression;
        return a.prenom.localeCompare(b.prenom, 'fr');
      }),
    [modele.negociateurs],
  );
  const slides = useMemo<Slide[]>(
    () => [
      { id: 'ouverture', kind: 'ouverture' },
      { id: 'victoires', kind: 'victoires' },
      { id: 'objectif', kind: 'objectif' },
      ...equipe.map((n) => ({ id: `nego-${n.membreId}`, kind: 'negociateur', nego: n }) as const),
      { id: 'cloture', kind: 'cloture' },
    ],
    [equipe],
  );

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
    for (const src of ICONES) new Image().src = src;
  }, []);

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
  const [halo1, halo2] = HALOS[slide.kind];

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[#111B3F] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Mode réunion"
    >
      {/* Halos : deux lueurs floues qui prennent la couleur de la diapositive. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="reunion-halo-a absolute -left-[18vmax] -top-[22vmax] size-[62vmax] rounded-full opacity-[0.32] blur-[110px] transition-[background-color] duration-[900ms]"
          style={{ backgroundColor: halo1 }}
        />
        <div
          className="reunion-halo-b absolute -bottom-[26vmax] -right-[16vmax] size-[58vmax] rounded-full opacity-[0.28] blur-[120px] transition-[background-color] duration-[900ms]"
          style={{ backgroundColor: halo2 }}
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 0.6px, transparent 0.7px)',
            backgroundSize: '22px 22px',
          }}
        />
      </div>

      <header className="relative z-[2] px-5 pt-4 sm:px-8 sm:pt-5">
        {/* Barre de progression façon « stories » : chaque segment mène à sa diapositive. */}
        <ol className="flex items-center gap-1.5" aria-label="Progression">
          {slides.map((s, i) => (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                aria-label={`Aller à la diapositive ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => {
                  setSens(i >= index ? 1 : -1);
                  setIndex(i);
                }}
                className="group block w-full py-1.5"
              >
                <span className="block h-1 overflow-hidden rounded-full bg-white/15 transition-colors group-hover:bg-white/25">
                  <span
                    className="block h-full rounded-full bg-white transition-[width] duration-500 ease-out"
                    style={{ width: i < index ? '100%' : i === index ? '100%' : '0%', opacity: i < index ? 0.55 : 1 }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="min-w-0 truncate text-[13px] text-white/55">
            <span className="font-semibold uppercase tracking-[0.16em] text-white/75">Point d’équipe</span>
            <span className="mx-2 text-white/25">·</span>
            {libelleSemaine()}
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <p className="hidden text-[13px] tabular-nums text-white/45 sm:block">
              {index + 1} / {slides.length}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10 transition hover:bg-white/20"
              aria-label="Quitter le mode réunion"
            >
              <X size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </header>

      {/* Zones cliquables gauche / droite — hors en-tête et pied */}
      <button
        type="button"
        aria-label="Diapositive précédente"
        disabled={!peutAvant}
        onClick={() => aller(-1)}
        className="absolute bottom-24 left-0 top-24 z-[1] w-[9%] disabled:pointer-events-none"
      />
      <button
        type="button"
        aria-label="Diapositive suivante"
        disabled={!peutApres}
        onClick={() => aller(1)}
        className="absolute bottom-24 right-0 top-24 z-[1] w-[9%] disabled:pointer-events-none"
      />

      <main className="relative z-[1] flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-4 sm:px-16 lg:px-24">
        <div key={slide.id} className={`mx-auto w-full max-w-6xl ${sens >= 0 ? 'reunion-slide-in' : 'reunion-slide-back'}`}>
          {slide.kind === 'ouverture' ? <SlideOuverture modele={modele} equipe={equipe} /> : null}
          {slide.kind === 'victoires' ? <SlideVictoires victoires={modele.victoires} equipe={equipe} /> : null}
          {slide.kind === 'objectif' ? (
            <SlideObjectif
              mandats={modele.indicateurs.mandatsDuMois}
              objectif={modele.indicateurs.objectifMandatsMois}
              progression={modele.progressionEquipe}
            />
          ) : null}
          {slide.kind === 'negociateur' ? <SlideNegociateur nego={slide.nego} /> : null}
          {slide.kind === 'cloture' ? <SlideCloture modele={modele} equipe={equipe} /> : null}
        </div>
      </main>

      <footer className="relative z-[2] flex items-center justify-between gap-4 px-5 pb-5 sm:px-8">
        <button
          type="button"
          onClick={() => aller(-1)}
          disabled={!peutAvant}
          className="inline-flex size-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10 transition hover:bg-white/20 disabled:opacity-20"
          aria-label="Précédent"
        >
          <ChevronLeft size={22} strokeWidth={2.2} />
        </button>
        <p className="hidden text-[12px] text-white/35 sm:block">← → pour naviguer · Échap pour quitter</p>
        <button
          type="button"
          onClick={() => aller(1)}
          disabled={!peutApres}
          className="inline-flex size-12 items-center justify-center rounded-full bg-white text-[#111B3F] shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition hover:scale-105 disabled:bg-white/10 disabled:text-white disabled:opacity-20 disabled:shadow-none"
          aria-label="Suivant"
        >
          <ChevronRight size={22} strokeWidth={2.4} />
        </button>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Diapositives                              */
/* -------------------------------------------------------------------------- */

function SlideOuverture({ modele, equipe }: { modele: AccueilDirecteurModele; equipe: CarteNegociateur[] }) {
  const immeubles = equipe.reduce((s, n) => s + n.contacts.valeur, 0);
  const estimations = equipe.reduce((s, n) => s + n.estimations.valeur, 0);
  return (
    <div className="flex flex-col items-center text-center">
      <Equipe equipe={equipe} taille={52} />
      <h1 className="mt-6 font-display text-white text-[clamp(48px,7vw,96px)] font-extrabold leading-[0.95] tracking-tight">
        Bonjour l’équipe
      </h1>
      <p className="mt-4 text-[clamp(16px,1.6vw,21px)] text-white/60">
        {equipe.length > 1 ? `${equipe.length} négociateurs` : equipe.length === 1 ? '1 négociateur' : 'L’agence'} · {modele.titre.replace(/^L’équipe |^L'équipe /, '')}
      </p>
      <div className="mt-12 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        <TuileChiffre
          icone="/contact.png"
          teinte={TEINTE.mandats}
          label="Mandats ce mois"
          valeur={modele.indicateurs.mandatsDuMois}
          sur={modele.indicateurs.objectifMandatsMois}
          delai={0}
        />
        <TuileChiffre icone="/porte-ouverte.png" teinte={TEINTE.immeubles} label="Immeubles prospectés" valeur={immeubles} delai={80} />
        <TuileChiffre icone="/calculatrice.png" teinte={TEINTE.estimations} label="Estimations" valeur={estimations} delai={160} />
      </div>
    </div>
  );
}

function SlideVictoires({ victoires, equipe }: { victoires: readonly VictoireSemaine[]; equipe: CarteNegociateur[] }) {
  const visage = (prenom: string) => equipe.find((n) => n.prenom === prenom) ?? null;
  const nombre = useCompteur(victoires.length);
  const visibles = victoires.slice(0, 8);
  return (
    <div>
      <div className="flex items-end justify-between gap-6">
        <EnTete icone="/trophee.png" teinte={TEINTE.or} eyebrow="Cette semaine" titre="Victoires" />
        {victoires.length > 0 ? (
          <p className="reunion-pop font-display text-[clamp(56px,7vw,96px)] font-extrabold leading-none tabular-nums" style={{ color: TEINTE.or }}>
            {nombre}
          </p>
        ) : null}
      </div>
      {victoires.length === 0 ? (
        <Verre className="mt-10 px-8 py-10 text-center">
          <p className="font-display text-[clamp(22px,2.4vw,30px)] font-bold">Pas encore de victoire cette semaine</p>
          <p className="mt-2 text-[17px] text-white/55">La suite du point d’équipe reste à construire.</p>
        </Verre>
      ) : (
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {visibles.map((v, i) => {
            const n = visage(v.prenom);
            const mandat = v.kind === 'mandat';
            return (
              <li key={`${v.kind}-${v.prenom}-${i}`} className="motion-safe:animate-ficheSurgit" style={{ animationDelay: `${120 + i * 70}ms` }}>
                <Verre className="flex items-center gap-4 px-5 py-4">
                  <span className="relative shrink-0">
                    <ProfileAvatar firstName={v.prenom} lastName={n?.nom ?? ''} avatarUrl={n?.avatarUrl} size={56} fond={FOND_AVATAR} />
                    <span
                      aria-hidden
                      className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full ring-[3px] ring-[#1A2650]"
                      style={{ backgroundColor: mandat ? TEINTE.mandats : TEINTE.estimations }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mandat ? '/contact.png' : '/rendez-vous.png'} alt="" className="size-[18px] object-contain" />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[clamp(20px,1.9vw,26px)] font-bold leading-tight">{v.prenom}</p>
                    <p className="mt-0.5 truncate text-[clamp(14px,1.2vw,17px)] text-white/60">{v.label}</p>
                  </div>
                </Verre>
              </li>
            );
          })}
        </ul>
      )}
      {victoires.length > visibles.length ? (
        <p className="mt-4 text-[15px] text-white/50">et {victoires.length - visibles.length} de plus</p>
      ) : null}
    </div>
  );
}

function SlideObjectif({ mandats, objectif, progression }: { mandats: number; objectif: number; progression: number }) {
  const reste = Math.max(0, objectif - mandats);
  const { semaines, fin } = finDuMois();
  const rythme = reste > 0 ? Math.ceil(reste / semaines) : 0;
  const cases = objectif > 0 && objectif <= 24 ? objectif : 0;
  const pct = useCompteur(progression);
  return (
    <div>
      <EnTete icone="/cibles.png" teinte={TEINTE.objectif} eyebrow="Ce mois" titre="Objectif d’équipe" />
      <div className="mt-10 grid items-center gap-10 md:grid-cols-[auto_1fr] md:gap-16">
        <Anneau valeur={progression} taille={300} epaisseur={20} couleur={TEINTE.objectif}>
          <p className="font-display text-[72px] font-extrabold leading-none tabular-nums">
            {pct}
            <span className="text-[30px] font-bold text-white/50">&nbsp;%</span>
          </p>
          <p className="mt-2 text-[16px] tabular-nums text-white/60">
            {mandats} / {objectif} mandats
          </p>
        </Anneau>
        <div>
          {reste > 0 ? (
            <>
              <p className="font-display text-[clamp(32px,3.6vw,52px)] font-bold leading-[1.05]">
                Encore {reste} mandat{reste > 1 ? 's' : ''}
              </p>
              <p className="mt-3 text-[clamp(16px,1.5vw,20px)] text-white/60">
                soit {rythme} par semaine d’ici le {fin}
              </p>
            </>
          ) : (
            <p className="font-display text-[clamp(32px,3.6vw,52px)] font-bold leading-[1.05]" style={{ color: TEINTE.mandats }}>
              Objectif atteint, bravo !
            </p>
          )}
          {cases > 0 ? (
            <ul className="mt-8 flex flex-wrap gap-2.5" aria-label={`${mandats} mandats signés sur ${objectif}`}>
              {Array.from({ length: cases }, (_, i) => {
                const signe = i < mandats;
                return (
                  <li
                    key={i}
                    className="flex size-11 items-center justify-center rounded-[14px] motion-safe:animate-ficheSurgit"
                    style={{
                      animationDelay: `${200 + i * 45}ms`,
                      backgroundColor: signe ? TEINTE.mandats : 'transparent',
                      boxShadow: signe ? 'none' : 'inset 0 0 0 1.5px rgba(255,255,255,0.22)',
                    }}
                  >
                    {signe ? <Check size={20} strokeWidth={3} className="text-[#0E5A31]" aria-hidden /> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const STATUT_POSITIF: Partial<Record<CarteNegociateur['statut'], { libelle: string; teinte: string }>> = {
  en_avance: { libelle: 'En avance', teinte: TEINTE.mandats },
  dans_le_rythme: { libelle: 'Dans le rythme', teinte: TEINTE.estimations },
  nouveau: { libelle: 'Nouveau', teinte: TEINTE.or },
};

function SlideNegociateur({ nego }: { nego: CarteNegociateur }) {
  const nom = [nego.prenom, nego.nom].filter(Boolean).join(' ');
  const statut = STATUT_POSITIF[nego.statut];
  const pct = useCompteur(nego.progression);
  return (
    <div className="grid items-center gap-10 md:grid-cols-[auto_1fr] md:gap-16">
      <div className="flex flex-col items-center text-center">
        <Anneau valeur={nego.progression} taille={260} epaisseur={12} couleur="#FFFFFF">
          <ProfileAvatar firstName={nego.prenom} lastName={nego.nom} avatarUrl={nego.avatarUrl} size={196} fond={FOND_AVATAR} />
        </Anneau>
        <p className="relative z-[1] -mt-7 rounded-full bg-white px-4 py-1.5 font-display text-[26px] font-extrabold tabular-nums text-[#111B3F] shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          {pct}&nbsp;%
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/50">La semaine de</p>
        <h2 className="mt-1 truncate font-display text-white text-[clamp(40px,5vw,68px)] font-extrabold leading-[1.02] tracking-tight">{nom}</h2>
        {statut ? (
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[14px] font-semibold ring-1 ring-white/10">
            <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: statut.teinte }} />
            {statut.libelle}
          </span>
        ) : null}
        <ul className="mt-8 grid gap-3">
          <Jauge icone="/porte-ouverte.png" teinte={TEINTE.immeubles} label="Immeubles prospectés" valeur={nego.contacts.valeur} objectif={nego.contacts.objectif} delai={150} />
          <Jauge icone="/calculatrice.png" teinte={TEINTE.estimations} label="Estimations" valeur={nego.estimations.valeur} objectif={nego.estimations.objectif} delai={230} />
          <Jauge icone="/contact.png" teinte={TEINTE.mandats} label="Mandats" valeur={nego.mandats.valeur} objectif={nego.mandats.objectif} delai={310} />
        </ul>
      </div>
    </div>
  );
}

function SlideCloture({ modele, equipe }: { modele: AccueilDirecteurModele; equipe: CarteNegociateur[] }) {
  const victoires = modele.victoires.length;
  return (
    <div className="flex flex-col items-center text-center">
      <span aria-hidden className="flex size-20 items-center justify-center rounded-[24px]" style={{ backgroundColor: TEINTE.or }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/trophee.png" alt="" className="size-12 object-contain" />
      </span>
      <h2 className="mt-7 font-display text-white text-[clamp(44px,6vw,84px)] font-extrabold leading-[0.98] tracking-tight">Bonne semaine !</h2>
      <p className="mt-4 max-w-2xl text-[clamp(16px,1.6vw,21px)] text-white/60">
        {victoires > 0 ? `${victoires} victoire${victoires > 1 ? 's' : ''} cette semaine, ` : ''}
        l’équipe est à {modele.progressionEquipe}&nbsp;% de l’objectif du mois.
      </p>
      <div className="mt-10">
        <Equipe equipe={equipe} taille={60} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Éléments                                 */
/* -------------------------------------------------------------------------- */

/** Une carte de verre : très arrondie, à peine plus claire que le fond. */
function Verre({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[26px] bg-white/[0.07] ring-1 ring-white/10 backdrop-blur-sm ${className}`}>{children}</div>;
}

function EnTete({ icone, teinte, eyebrow, titre }: { icone: string; teinte: string; eyebrow: string; titre: string }) {
  return (
    <div className="flex items-center gap-4 sm:gap-5">
      <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-[20px]" style={{ backgroundColor: teinte }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icone} alt="" width={40} height={40} className="size-10 object-contain" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/50">{eyebrow}</p>
        <h2 className="font-display text-[clamp(36px,4.4vw,60px)] text-white font-extrabold leading-[1.02] tracking-tight">{titre}</h2>
      </div>
    </div>
  );
}

/** Les visages de l'équipe, qui se chevauchent. */
function Equipe({ equipe, taille }: { equipe: CarteNegociateur[]; taille: number }) {
  const visibles = equipe.slice(0, 8);
  return (
    <ul className="flex items-center justify-center" aria-label="L’équipe">
      {visibles.map((n, i) => (
        <li
          key={n.membreId}
          className="motion-safe:animate-ficheSurgit rounded-full ring-4 ring-[#111B3F]"
          style={{ marginLeft: i === 0 ? 0 : -taille * 0.1, animationDelay: `${i * 60}ms` }}
          title={[n.prenom, n.nom].filter(Boolean).join(' ')}
        >
          <ProfileAvatar firstName={n.prenom} lastName={n.nom} avatarUrl={n.avatarUrl} size={taille} fond={FOND_AVATAR} />
        </li>
      ))}
      {equipe.length > visibles.length ? (
        <li
          className="flex items-center justify-center rounded-full bg-white/15 text-[15px] font-semibold ring-4 ring-[#111B3F]"
          style={{ width: taille, height: taille, marginLeft: -taille * 0.1 }}
        >
          +{equipe.length - visibles.length}
        </li>
      ) : null}
    </ul>
  );
}

function TuileChiffre({ icone, teinte, label, valeur, sur, delai }: { icone: string; teinte: string; label: string; valeur: number; sur?: number; delai: number }) {
  const v = useCompteur(valeur);
  return (
    <div className="motion-safe:animate-ficheSurgit" style={{ animationDelay: `${200 + delai}ms` }}>
      <Verre className="flex flex-col items-center gap-3 px-6 py-7">
        <span aria-hidden className="flex size-12 items-center justify-center rounded-[16px]" style={{ backgroundColor: teinte }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icone} alt="" className="size-8 object-contain" />
        </span>
        <p className="font-display text-[clamp(40px,4.2vw,58px)] font-extrabold leading-none tabular-nums">
          {v}
          {sur != null ? <span className="text-[0.45em] font-bold text-white/45"> / {sur}</span> : null}
        </p>
        <p className="text-[14px] font-semibold uppercase tracking-[0.1em] text-white/55">{label}</p>
      </Verre>
    </div>
  );
}

function Jauge({ icone, teinte, label, valeur, objectif, delai }: { icone: string; teinte: string; label: string; valeur: number; objectif: number; delai: number }) {
  const v = useCompteur(valeur);
  const atteint = objectif > 0 && valeur >= objectif;
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setLargeur(objectif > 0 ? Math.min(100, (valeur / objectif) * 100) : 0));
    return () => cancelAnimationFrame(id);
  }, [valeur, objectif]);
  return (
    <li className="motion-safe:animate-ficheSurgit" style={{ animationDelay: `${delai}ms` }}>
      <Verre className="flex items-center gap-4 px-5 py-4">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-[16px]" style={{ backgroundColor: teinte }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icone} alt="" className="size-8 object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[clamp(15px,1.3vw,18px)] font-semibold text-white/80">{label}</p>
            <p className="shrink-0 font-display text-[clamp(24px,2.4vw,32px)] font-extrabold leading-none tabular-nums">
              {v}
              <span className="text-[0.55em] font-bold text-white/45"> / {objectif}</span>
            </p>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${largeur}%`, backgroundColor: teinte }}
              />
            </div>
            {atteint ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold" style={{ color: teinte }}>
                <Check size={15} strokeWidth={3} aria-hidden />
                Atteint
              </span>
            ) : null}
          </div>
        </div>
      </Verre>
    </li>
  );
}

/** Un anneau de progression qui se remplit à l'arrivée sur la diapositive. */
function Anneau({ valeur, taille, epaisseur, couleur, children }: { valeur: number; taille: number; epaisseur: number; couleur: string; children: ReactNode }) {
  const r = (taille - epaisseur) / 2;
  const circonference = 2 * Math.PI * r;
  const [affiche, setAffiche] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAffiche(Math.max(0, Math.min(100, valeur))));
    return () => cancelAnimationFrame(id);
  }, [valeur]);
  return (
    <div className="relative mx-auto shrink-0" style={{ width: taille, height: taille }}>
      <svg width={taille} height={taille} className="-rotate-90" aria-hidden>
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={epaisseur} />
        <circle
          cx={taille / 2}
          cy={taille / 2}
          r={r}
          fill="none"
          stroke={couleur}
          strokeWidth={epaisseur}
          strokeLinecap="round"
          strokeDasharray={circonference}
          strokeDashoffset={circonference * (1 - affiche / 100)}
          style={{ transition: 'stroke-dashoffset 1200ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Un nombre qui monte jusqu'à sa valeur à l'arrivée (immédiat si les animations sont réduites). */
function useCompteur(cible: number, dureeMs = 900): number {
  const [valeur, setValeur] = useState(0);
  useEffect(() => {
    let raf = 0;
    const reduit = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const debut = performance.now();
    const pas = (t: number) => {
      const p = reduit ? 1 : Math.min(1, (t - debut) / dureeMs);
      setValeur(Math.round(cible * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [cible, dureeMs]);
  return valeur;
}

/** « Semaine du 20 au 26 octobre » (lundi → dimanche). */
function libelleSemaine(maintenant = new Date()): string {
  const decalage = (maintenant.getDay() + 6) % 7;
  const lundi = new Date(maintenant);
  lundi.setDate(maintenant.getDate() - decalage);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  const jourMois = (d: Date) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(d);
  return lundi.getMonth() === dimanche.getMonth()
    ? `Semaine du ${lundi.getDate()} au ${jourMois(dimanche)}`
    : `Semaine du ${jourMois(lundi)} au ${jourMois(dimanche)}`;
}

/** Les semaines qui restent dans le mois (au moins une) et son dernier jour, en clair. */
function finDuMois(maintenant = new Date()): { semaines: number; fin: string } {
  const dernier = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0);
  const jours = dernier.getDate() - maintenant.getDate() + 1;
  return {
    semaines: Math.max(1, Math.ceil(jours / 7)),
    fin: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(dernier),
  };
}
