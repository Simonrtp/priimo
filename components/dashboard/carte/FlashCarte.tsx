'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronsLeft, Megaphone, TrendingDown } from 'lucide-react';
import { viserSurLaCarte } from '@/lib/carte/cible';
import { markerBadgeColor } from '@/lib/carte/colors';
import { dpeFillColor, parseDpeLetter } from '@/lib/carte/dpe-public';
import { quandFlash, type FlashItem, type TypeFlash } from '@/lib/carte/flash';
import { useFlashCarte } from '@/lib/carte/useFlashCarte';
import { euros, eurosCourt } from '@/lib/annonces/presenter';
import type { Annonce } from '@/lib/annonces/types';

/** Le temps d'une nouvelle à l'antenne. */
const DUREE_TITRE_MS = 3800;
/** La carte se pose avant que le logo la traverse. */
const DELAI_ANNONCE_MS = 400;
/** Le logo a passé le milieu de la carte et accélère vers la sortie : les nouvelles arrivent dans son sillage. */
const INTRO_MS = 2000;
/** Le temps que les nouvelles s'effacent pendant que la carte se range. */
const RENTRE_MS = 260;
/** Sans nouvelle : le message reste le temps de le lire. */
const VIDE_MS = 3500;
/** La carte rouvre depuis l'onglet : les nouvelles attendent qu'elle soit à peu près large. */
const DELAI_ROUVERTURE_MS = 250;

/**
 * attente : rien tant que les nouvelles ne sont pas là ;
 * intro : une petite carte, le logo « Breaking news » la traverse ;
 * news : les nouvelles défilent une fois, le logo n'est plus là ;
 * rentre : la carte se range sur le côté ;
 * range : il ne reste qu'un petit onglet (le nombre de nouvelles) ; un clic ramène les nouvelles.
 */
type Phase = 'attente' | 'intro' | 'news' | 'rentre' | 'range';

const SUITE: Partial<Record<Phase, readonly [Phase, number]>> = {
  intro: ['news', INTRO_MS],
  rentre: ['range', RENTRE_MS],
};

/** Une fois par chargement de page : revenir sur la carte depuis la Liste ne rejoue pas la séquence. */
let introJouee = false;

const SECTIONS: readonly { type: TypeFlash; titre: string }[] = [
  { type: 'dpe', titre: 'Nouveaux DPE' },
  { type: 'baisse', titre: 'Annonces en baisse' },
  { type: 'nouvelle', titre: 'Nouvelles annonces' },
];

const ROUGE = 'linear-gradient(180deg, #FF3B30 0%, #E3121B 52%, #B00710 100%)';
const NOIR = 'linear-gradient(180deg, #4A4A4A 0%, #1B1B1B 48%, #050505 100%)';
const BLEU = 'linear-gradient(100deg, #1F40C4 0%, #2F5FEA 55%, #4A7FF8 100%)';

function kicker(item: FlashItem): string {
  if (item.type === 'dpe') return item.nombre > 1 ? `${item.nombre} nouveaux DPE` : 'Nouveau DPE';
  return item.type === 'baisse' ? 'En baisse' : 'Nouvelle annonce';
}

function pourcent(p: number): string {
  return `−${String(p).replace('.', ',')} %`;
}

/**
 * Le logo du visuel de référence : « BREAKING » rouge penché, « NEWS » noir
 * droit dans un bloc penché. Il ne paraît que pendant l'intro : une fois la
 * carte rangée, il n'en reste aucune trace.
 */
function Logo() {
  return (
    <span className="flex items-center">
      <span
        className="inline-block -skew-x-12 px-3 py-[6px] text-[17px] font-black uppercase leading-none tracking-[0.02em] text-white"
        style={{
          background: ROUGE,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
          textShadow: '0 1px 0 rgba(0,0,0,0.25)',
        }}
      >
        Breaking
      </span>
      <span
        className="breaking-noir relative ml-1.5 inline-block -skew-x-12 overflow-hidden border border-white/20 px-2 py-[4px] text-[11px] font-black uppercase leading-none tracking-[0.04em] text-white"
        style={{ background: NOIR, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)' }}
      >
        <span className="inline-block skew-x-12">News</span>
      </span>
    </span>
  );
}

function PastilleDpe({ lettre, taille = 20, bague = false }: { lettre: string | null; taille?: number; bague?: boolean }) {
  const l = parseDpeLetter(lettre);
  if (!l) return null;
  const fond = dpeFillColor(l);
  return (
    <span
      aria-label={`Classe ${l}`}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none ${bague ? 'ring-1 ring-white/50' : ''}`}
      style={{ width: taille, height: taille, fontSize: taille * 0.52, backgroundColor: fond, color: markerBadgeColor(fond) }}
    >
      {l}
    </span>
  );
}

/** Le fond bleu du visuel : dégradé et trame de points ; la lueur et le trait de lumière n'éclairent que le passage du logo. */
function Fond({ eclat }: { eclat: boolean }) {
  const trame = {
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1.3px)',
    backgroundSize: '9px 9px',
    maskImage: 'radial-gradient(80% 120% at 50% 50%, #000 30%, transparent 85%)',
    WebkitMaskImage: 'radial-gradient(80% 120% at 50% 50%, #000 30%, transparent 85%)',
  };
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span className="absolute inset-0" style={{ background: BLEU }} />
      <span
        className={`absolute inset-0 transition-opacity duration-500 ${eclat ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'radial-gradient(55% 95% at 50% 50%, rgba(90,150,255,0.85) 0%, rgba(30,80,255,0.35) 42%, transparent 75%)' }}
      />
      <span className={`absolute inset-0 transition-opacity duration-500 ${eclat ? 'opacity-60' : 'opacity-30'}`} style={trame} />
      <span
        className={`breaking-trait absolute inset-x-0 h-[2px] transition-opacity duration-500 ${eclat ? 'opacity-100' : 'opacity-0'}`}
        style={{
          top: 'calc(50% - 1px)',
          background: 'linear-gradient(90deg, transparent, rgba(200,222,255,0.95) 50%, transparent)',
          boxShadow: '0 0 14px 3px rgba(120,170,255,0.55)',
        }}
      />
    </span>
  );
}

/** Le logo traverse la carte : arrivée vive, glisse lente au centre, sortie qui accélère. */
function Passage({ onFin }: { onFin: () => void }) {
  return (
    <span
      aria-hidden
      // Le reflet de « NEWS » finit avant : seule l'animation du passage lui-même compte.
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) onFin();
      }}
      className="breaking-passage pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span className="relative">
        <span className="absolute -top-[5px] left-[42%] h-[2px] w-[58%] rounded-full bg-[#FF2A2A]" />
        <span className="absolute -bottom-[5px] -left-[10%] h-[2px] w-[50%] rounded-full bg-[#FF2A2A]" />
        <Logo />
      </span>
    </span>
  );
}

/** Ce qui suit l'adresse dans la barre : la lettre, la baisse ou le prix. */
function Queue({ item }: { item: FlashItem }) {
  if (item.type === 'dpe') return <PastilleDpe lettre={item.lettre} bague />;
  if (item.type === 'baisse') {
    return item.pourcent != null ? (
      <span
        className="inline-block shrink-0 -skew-x-12 px-1.5 py-[3px] text-[11.5px] font-black leading-none tabular-nums text-white"
        style={{ background: ROUGE }}
      >
        <span className="inline-block skew-x-12">{pourcent(item.pourcent)}</span>
      </span>
    ) : null;
  }
  return item.annonce.prix != null ? (
    <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-white/75">{eurosCourt(item.annonce.prix)}</span>
  ) : null;
}

function Titre({ item, classe }: { item: FlashItem; classe: string }) {
  return (
    <span className={`absolute inset-0 flex flex-col justify-center ${classe}`}>
      <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase leading-none tracking-[0.08em] text-white/85">
        {kicker(item)}
        <span className="font-semibold normal-case tracking-normal text-white/70">· {quandFlash(item.date)}</span>
      </span>
      <span className="mt-1 flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-[13.5px] font-bold leading-tight text-white">{item.rue}</span>
        <Queue item={item} />
      </span>
    </span>
  );
}

function detailLigne(item: FlashItem): string {
  const quand = quandFlash(item.date);
  if (item.type === 'dpe') {
    return [
      item.nombre > 1 ? `${item.nombre} diagnostics` : 'Diagnostic',
      quand,
      item.surfaceM2 ? `${Math.round(item.surfaceM2)} m²` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const a = item.annonce;
  return [
    item.type === 'baisse' && item.pourcent != null ? pourcent(item.pourcent) : null,
    a.prix != null ? euros(a.prix) : null,
    item.type === 'nouvelle' && a.pieces != null ? `${a.pieces} p.` : null,
    item.type === 'nouvelle' && a.surface != null ? `${a.surface} m²` : null,
    quand,
  ]
    .filter(Boolean)
    .join(' · ');
}

function IconeLigne({ item }: { item: FlashItem }) {
  if (item.type === 'dpe') {
    return parseDpeLetter(item.lettre) ? (
      <PastilleDpe lettre={item.lettre} taille={28} />
    ) : (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[9.5px] font-bold text-text-muted">
        DPE
      </span>
    );
  }
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
        item.type === 'baisse' ? 'bg-[#E3121B]/10 text-[#C40F17]' : 'bg-[#0E2FB0]/10 text-[#0E2FB0]'
      }`}
    >
      {item.type === 'baisse' ? (
        <TrendingDown size={14} strokeWidth={2.4} aria-hidden />
      ) : (
        <Megaphone size={14} strokeWidth={2.2} aria-hidden />
      )}
    </span>
  );
}

/**
 * Le flash de la carte, collé au coin haut-gauche : une seule petite carte.
 * Les nouvelles chargées, « Breaking news » la traverse (arrivée vive, glisse
 * lente, sortie qui accélère) ; dans son sillage les nouvelles défilent une
 * fois, sans le logo ; la dernière passée, la carte se range sur le côté en
 * un petit onglet qui ne porte aucun mot : un point rouge et le nombre de
 * nouvelles. Un clic sur l'onglet fait revenir les nouvelles ; un clic sur une
 * nouvelle y emmène ; la flèche déplie la liste ; la double flèche range la carte à la main.
 */
export default function FlashCarte({
  requete,
  perimetre,
  onAnnonce,
}: {
  /** `zones=…` ou `cp=1`, comme la carte. */
  requete: string;
  perimetre: 'secteur' | 'code_postal';
  onAnnonce: (annonce: Annonce, point: { latitude: number; longitude: number }) => void;
}) {
  const { items, pret } = useFlashCarte(requete);
  const [phase, setPhase] = useState<Phase>('attente');
  const [logoEnVol, setLogoEnVol] = useState(false);
  const [rang, setRang] = useState(0);
  const [precedent, setPrecedent] = useState<{ item: FlashItem; tour: number } | null>(null);
  const [tour, setTour] = useState(0);
  /** La première nouvelle d'un défilé se dévoile de gauche à droite ; les suivantes se chassent. */
  const [premier, setPremier] = useState(true);
  const [depuisOnglet, setDepuisOnglet] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);

  // Nouveau périmètre : le défilé repart du début.
  const [itemsVus, setItemsVus] = useState(items);
  if (itemsVus !== items) {
    setItemsVus(items);
    setRang(0);
    setPrecedent(null);
    setPremier(true);
    setTour((t) => t + 1);
  }

  // Tout est là : le logo traverse la carte (une fois par page), ou l'onglet s'installe directement.
  useEffect(() => {
    if (phase !== 'attente' || !pret) return;
    const t = window.setTimeout(() => {
      const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const jouer = items.length > 0 && !introJouee && !calme;
      if (items.length > 0) introJouee = true;
      if (jouer) setLogoEnVol(true);
      setPhase(jouer ? 'intro' : 'range');
    }, DELAI_ANNONCE_MS);
    return () => window.clearTimeout(t);
  }, [phase, pret, items.length]);

  // Chaque temps de la séquence appelle le suivant.
  useEffect(() => {
    const etape = SUITE[phase];
    if (!etape) return;
    const t = window.setTimeout(() => setPhase(etape[0]), etape[1]);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Pas de nouvelle : le message se lit, puis la carte se range.
  useEffect(() => {
    if (phase !== 'news' || items.length > 0) return;
    const t = window.setTimeout(() => setPhase('rentre'), VIDE_MS);
    return () => window.clearTimeout(t);
  }, [phase, items.length]);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('pointerdown', dehors);
    document.addEventListener('keydown', clavier);
    return () => {
      document.removeEventListener('pointerdown', dehors);
      document.removeEventListener('keydown', clavier);
    };
  }, [ouvert]);

  if (phase === 'attente') return null;

  const rangee = phase === 'rentre' || phase === 'range';
  const vide = items.length === 0;
  const courant = items[rang] ?? items[0] ?? null;
  const lieu = perimetre === 'secteur' ? 'mon secteur' : 'le code postal';
  const amorce = phase === 'news' && premier;

  function suivant() {
    if (!courant) return;
    if (rang >= items.length - 1) {
      // Toutes les nouvelles sont passées : la carte se range.
      setOuvert(false);
      setPhase('rentre');
      return;
    }
    setPrecedent({ item: courant, tour });
    setTour((t) => t + 1);
    setRang((r) => r + 1);
    setPremier(false);
  }

  function ranger() {
    setOuvert(false);
    setPhase('rentre');
  }

  function rouvrir() {
    setOuvert(false);
    setRang(0);
    setPrecedent(null);
    setPremier(true);
    setDepuisOnglet(true);
    setTour((t) => t + 1);
    setPhase('news');
  }

  function ouvrir(item: FlashItem) {
    setOuvert(false);
    const point = { latitude: item.latitude, longitude: item.longitude };
    if (item.type === 'dpe') {
      const libelle = /\b\d{5}\b/.test(item.adresse) ? item.adresse : [item.adresse, item.codePostal].filter(Boolean).join(' ');
      viserSurLaCarte({ ...point, libelle, banId: item.banId });
      return;
    }
    onAnnonce(item.annonce, point);
  }

  return (
    <div ref={racine} className="relative">
      <div
        role="region"
        aria-label={perimetre === 'secteur' ? 'Flash de mon secteur' : 'Flash du code postal'}
        data-phase={phase}
        data-flash-pause={ouvert || undefined}
        className={`breaking-barre group/flash pointer-events-auto relative overflow-hidden text-white shadow-[0_16px_36px_-14px_rgba(30,64,190,0.55)] transition-[width,height,border-radius] duration-[560ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none ${
          rangee
            ? `h-9 rounded-br-[14px] ${vide ? 'w-10' : 'w-[4.25rem]'}`
            : 'h-12 w-[min(25rem,calc(100%-15rem))] rounded-br-[20px] lg:w-[min(28rem,calc(100%-23rem))]'
        }`}
      >
        <Fond eclat={logoEnVol} />
        {logoEnVol ? <Passage onFin={() => setLogoEnVol(false)} /> : null}

        {phase === 'news' || phase === 'rentre' ? (
          <div
            className={`absolute inset-0 flex items-center gap-2.5 pl-4 pr-1.5 ${
              phase === 'rentre' ? 'breaking-fondu' : amorce ? 'breaking-resume' : ''
            }`}
            style={amorce && depuisOnglet ? { animationDelay: `${DELAI_ROUVERTURE_MS}ms` } : undefined}
          >
            {vide ? (
              <>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/90">
                  Rien de neuf dans {lieu} pour l’instant
                </span>
                <button
                  type="button"
                  onClick={ranger}
                  title="Ranger"
                  aria-label="Ranger les nouvelles"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <ChevronsLeft size={16} strokeWidth={2.2} aria-hidden />
                </button>
              </>
            ) : courant ? (
              <>
                <button
                  type="button"
                  onClick={() => ouvrir(courant)}
                  aria-label={`${kicker(courant)}, ${courant.rue}, ${quandFlash(courant.date)}`}
                  className="relative h-9 min-w-0 flex-1 overflow-hidden rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {precedent ? <Titre key={`sortie-${precedent.tour}`} item={precedent.item} classe="flash-sortie" /> : null}
                  <Titre key={`entree-${tour}`} item={courant} classe={premier ? '' : 'flash-entree'} />
                </button>
                {items.length > 1 ? (
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/80">
                    {rang + 1}/{items.length}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOuvert((v) => !v)}
                  aria-expanded={ouvert}
                  aria-controls="flash-carte-liste"
                  aria-label={ouvert ? 'Replier les nouvelles' : 'Voir toutes les nouvelles'}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <ChevronDown
                    size={16}
                    strokeWidth={2.2}
                    aria-hidden
                    className={`transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${ouvert ? 'rotate-180' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={ranger}
                  title="Ranger"
                  aria-label="Ranger les nouvelles"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <ChevronsLeft size={16} strokeWidth={2.2} aria-hidden />
                </button>
                {/* La barre rouge court sous la nouvelle ; à son bout, la suivante prend l'antenne. Le survol la met en pause. */}
                <span aria-hidden className="pointer-events-none absolute inset-x-4 bottom-0 h-[2px] overflow-hidden rounded-full bg-white/10">
                  <span
                    key={`barre-${tour}`}
                    onAnimationEnd={suivant}
                    className="flash-progression block h-full w-full rounded-full bg-[#FF3B30] group-hover/flash:[animation-play-state:paused] group-focus-within/flash:[animation-play-state:paused]"
                    style={{ animationDuration: `${DUREE_TITRE_MS}ms` }}
                  />
                </span>
              </>
            ) : null}
          </div>
        ) : null}

        {phase === 'range' ? (
          <button
            type="button"
            onClick={rouvrir}
            title={vide ? 'Voir les nouvelles' : 'Revoir les nouvelles'}
            aria-label={vide ? 'Voir les nouvelles' : `Revoir les nouvelles, ${items.length} en tout`}
            className="breaking-compact absolute inset-0 flex items-center justify-center transition-colors hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white"
          >
            {vide ? (
              <span aria-hidden className="size-2 rounded-full bg-white/45" />
            ) : (
              // Rangé, plus aucun mot : le point rouge « en direct » et le nombre de nouvelles.
              <span
                aria-hidden
                className="breaking-pouls inline-block -skew-x-12 px-2 py-[3px] text-[12.5px] font-black leading-none tabular-nums text-white"
                style={{ background: ROUGE, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
              >
                <span className="inline-flex skew-x-12 items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-white" />
                  {items.length}
                </span>
              </span>
            )}
          </button>
        ) : null}
      </div>

      {ouvert && phase === 'news' ? (
        <div
          id="flash-carte-liste"
          className="flash-panneau pointer-events-auto ml-2 mt-2 max-h-[min(60vh,26rem)] w-[min(24rem,calc(100%-15.5rem))] overflow-y-auto overscroll-contain rounded-[24px] bg-white p-1.5 shadow-clay-lg lg:w-[min(27rem,calc(100%-23.5rem))]"
        >
          {SECTIONS.map(({ type, titre }) => {
            const famille = items.filter((i) => i.type === type);
            if (famille.length === 0) return null;
            return (
              <section key={type} className="py-1">
                <h3 className="flex items-center justify-between px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
                  {titre}
                  <span className="tabular-nums">{famille.length}</span>
                </h3>
                <ul>
                  {famille.map((item, n) => (
                    <li key={item.id} className="flash-ligne" style={{ animationDelay: `${n * 35}ms` }}>
                      <button
                        type="button"
                        onClick={() => ouvrir(item)}
                        className="flex w-full items-center gap-3 rounded-[16px] px-2.5 py-2 text-left transition-colors hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1A2A56]"
                      >
                        <IconeLigne item={item} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-text-strong">{item.rue}</span>
                          <span className="block truncate text-[12px] text-text-muted">{detailLigne(item)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
