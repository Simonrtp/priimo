'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Mic, NotebookPen } from 'lucide-react';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import type { Compteur, FamilleActivite } from '@/lib/activite/types';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { useNotesLecture } from '@/components/dashboard/notes/NotesLectureProvider';
import { useOutsideDismiss } from '@/lib/hooks/useOutsideDismiss';
import { armPointerShield } from '@/lib/ui/pointer-guard';
import { EVENEMENT_ENVOL_ARRIVE, type EnvolArrive } from '@/lib/ui/envol-note';
import styles from './envol.module.css';

/**
 * Le geste qui fait monter le chiffre, et rien d'autre. Chaque libellé nomme
 * l'action, pas la page : un compteur qu'on ne sait pas alimenter reste à zéro.
 * Les destinations suivent la provenance déclarée dans `PROVENANCE_ACTIVITE`.
 *
 * Une note de terrain ne renvoie sur aucune page : elle se prend sur place,
 * écrite ou dictée, sinon le compteur coûte une navigation pour trois mots.
 */
type ActionCompteur = {
  libelle: string;
  /** Sur téléphone, deux cartes par ligne : le libellé doit tenir sur une. */
  court?: string;
} & ({ href: string } | { note: true });

const ACTION: Record<FamilleActivite, ActionCompteur> = {
  immeubles_prospectes: {
    libelle: 'Ouvrir la carte',
    href: '/dashboard/prospection?vue=carte',
  },
  contacts_qualifies: {
    libelle: 'Qualifier un lead',
    court: 'Qualifier',
    href: '/dashboard/prospection?vue=pipeline',
  },
  estimations: {
    libelle: 'Créer une estimation',
    court: 'Estimer',
    href: '/dashboard/estimation?id=nouvelle',
  },
  informations_terrain: {
    libelle: 'Noter',
    note: true,
  },
};

/**
 * La pastille d'action : le seul endroit cliquable de la carte. Elle n'apparaît
 * qu'une fois la carte dépliée — au survol, au focus, ou tout de suite s'il n'y
 * a pas de survol (doigt, stylet).
 */
const PILULE =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold shadow-clay-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Le volet du bouton. Au repos il est fermé : la carte reste courte. Au survol
 * il s'ouvre — `grid-template-rows` de 0fr à 1fr, le même geste que les cartes
 * KPI de l'accueil. `force` le tient ouvert (menu de note déployé).
 */
function Volet({
  force = false,
  children,
}: {
  force?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`fluid-collapse motion-reduce:transition-none ${
        force
          ? 'grid-rows-[1fr]'
          : 'grid-rows-[0fr] group-hover/compteur:grid-rows-[1fr] group-focus-within/compteur:grid-rows-[1fr] [@media(hover:none)]:grid-rows-[1fr]'
      }`}
    >
      <div>
        <div className="pt-2.5">{children}</div>
      </div>
    </div>
  );
}

/**
 * Deux états par famille : le dessin plat au repos, le même dessin cerné d'un
 * contour marqué au survol. Même sujet, même cadrage — seul le trait change,
 * donc le fondu croisé ne donne pas l'impression de changer d'icône.
 */
const ILLUSTRATION: Record<FamilleActivite, { repos: string; survol: string }> = {
  immeubles_prospectes: { repos: '/bureau.png', survol: '/bureau-contour.png' },
  contacts_qualifies: { repos: '/contact.png', survol: '/contact-contour.png' },
  estimations: { repos: '/calculatrice.png', survol: '/calculatrice-contour.png' },
  informations_terrain: { repos: '/info.png', survol: '/info-contour.png' },
};

/**
 * Deux façons de noter, offertes sur place : au clavier ou à la voix. On ouvre
 * les mêmes fenêtres que le bouton « Nouvelle note » du menu latéral, donc une
 * note prise ici est une note ordinaire, pas un cas particulier.
 */
function BoutonNote({
  libelle,
  fond,
  extra,
}: {
  libelle: string;
  fond: string;
  extra?: ReactNode;
}) {
  const { openCapture, openCompose } = useVoiceCapture();
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const fermer = useCallback(() => setOuvert(false), []);

  useOutsideDismiss(ouvert, fermer, racine);

  useEffect(() => {
    if (!ouvert) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fermer();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ouvert, fermer]);

  function choisir(ouvrir: () => void) {
    fermer();
    armPointerShield();
    ouvrir();
  }

  return (
    <div ref={racine} className="relative">
      {/* Le menu flotte au-dessus du volet : un overflow:hidden sur le dépli
          couperait « Écrire » / « Dicter ». */}
      {ouvert ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Ajouter une note"
          className="absolute bottom-full left-0 z-20 mb-1.5 flex min-w-[8.5rem] flex-col overflow-hidden rounded-clay border border-black/[0.08] bg-surface py-1 shadow-clay"
        >
          <ChoixNote icone={NotebookPen} libelle="Écrire" onClick={() => choisir(openCompose)} />
          <ChoixNote icone={Mic} libelle="Dicter" onClick={() => choisir(openCapture)} />
        </div>
      ) : null}
      <Volet force={ouvert}>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={ouvert}
            aria-controls={ouvert ? menuId : undefined}
            onClick={() => setOuvert((prev) => !prev)}
            className={`${PILULE} shrink-0 whitespace-nowrap text-text-strong focus-visible:outline-primary-600`}
            style={{ backgroundColor: fond }}
          >
            {libelle}
            <ChevronDown
              size={12}
              strokeWidth={2.6}
              aria-hidden
              className={ouvert ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </button>
          {extra}
        </div>
      </Volet>
    </div>
  );
}

function ChoixNote({
  icone: Icone,
  libelle,
  onClick,
}: {
  icone: typeof Mic;
  libelle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex min-h-10 w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] font-medium text-text transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04]"
    >
      <Icone size={15} strokeWidth={2} className="text-accent" aria-hidden />
      {libelle}
    </button>
  );
}

/**
 * Une note rangée arrive en vol sur Notes terrain : à l'impact, le chiffre
 * monte d'un cran sans attendre le serveur. Dès que le bilan rafraîchi arrive,
 * c'est lui qui fait foi.
 */
function useArriveeNote(
  famille: FamilleActivite,
  compteur: Compteur,
  accueilleNotes: boolean,
  periode: string,
) {
  const [bonus, setBonus] = useState(0);
  const [impact, setImpact] = useState(0);
  const [compte, setCompte] = useState(false);
  const recuLe = useRef(0);
  const affichee = useRef(compteur.valeur);
  const periodeVue = useRef(periode);

  // Nouveau bilan du serveur : le bonus s'efface dès qu'il a rattrapé le
  // chiffre affiché — jamais de chiffre qui redescend sous les yeux de l'agent.
  useEffect(() => {
    recuLe.current = Date.now();
    const avant = affichee.current;
    const memePeriode = periodeVue.current === periode;
    periodeVue.current = periode;
    setBonus(!memePeriode || compteur.valeur >= avant ? 0 : avant - compteur.valeur);
  }, [compteur, periode]);
  useEffect(() => {
    affichee.current = compteur.valeur + bonus;
  });

  useEffect(() => {
    if (famille !== 'informations_terrain') return;
    function onArrivee(e: Event) {
      const d = (e as CustomEvent<EnvolArrive>).detail;
      if (!d || d.cible !== famille) return;
      const monte = d.compte && accueilleNotes && d.t0 > recuLe.current;
      setCompte(monte);
      if (monte) setBonus((b) => b + 1);
      setImpact((i) => i + 1);
    }
    window.addEventListener(EVENEMENT_ENVOL_ARRIVE, onArrivee);
    return () => window.removeEventListener(EVENEMENT_ENVOL_ARRIVE, onArrivee);
  }, [famille, accueilleNotes]);

  return { bonus, impact, compte };
}

function CarteCompteur({
  compteur,
  accueilleNotes,
  periode,
}: {
  compteur: Compteur;
  accueilleNotes: boolean;
  periode: string;
}) {
  const famille = compteur.activite as FamilleActivite;
  const { teinte, pastelFort, pastille, voile } = COULEUR_FAMILLE[famille];
  const illustration = ILLUSTRATION[famille];
  const action = ACTION[famille];
  const { ouvrir } = useNotesLecture();
  const { bonus, impact, compte } = useArriveeNote(famille, compteur, accueilleNotes, periode);
  const valeur = compteur.valeur + bonus;
  const pct =
    compteur.objectif > 0
      ? Math.min(100, Math.round((valeur / compteur.objectif) * 100))
      : 0;
  // Le chiffre que vise une note qui s'envole, et sa couleur.
  const accueilleEnvol = famille === 'informations_terrain';
  const cible = accueilleEnvol
    ? { 'data-envol-cible': famille, 'data-envol-couleur': teinte }
    : {};
  const chiffre = (taille: string) => (
    <span className="relative inline-flex">
      <span
        key={impact}
        {...cible}
        className={`font-display ${taille} font-bold leading-none tabular-nums ${impact ? styles.chiffreImpact : ''}`}
        style={{ color: teinte }}
      >
        {valeur.toLocaleString('fr-FR')}
      </span>
      {impact && compte ? (
        <span key={`plus-${impact}`} className={styles.plusUn} style={{ color: teinte }} aria-hidden>
          +1
        </span>
      ) : null}
    </span>
  );

  return (
    <li className="relative min-w-0">
      {/* Calibre la case au repos, sans les images : la carte vraie se pose
          par-dessus et s'allonge au survol sans pousser la grille. */}
      <div className="invisible flex flex-col p-4 [@media(hover:none)]:hidden" aria-hidden>
        <span className="size-12 shrink-0" />
        <p className="mt-3 text-[12px] font-semibold leading-tight">{compteur.libelle}</p>
        <p className="mt-1 font-display text-[28px] font-bold leading-none">0</p>
        <div className="mt-3 h-2.5" />
      </div>
      <div
        className="group/compteur flex h-full flex-col rounded-clay-lg p-4 shadow-clay-sm [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-x-0 [@media(hover:hover)]:top-0 [@media(hover:hover)]:h-auto [@media(hover:hover)]:min-h-full hover:z-30 focus-within:z-30"
        style={{ backgroundColor: voile }}
      >
        <div className="flex items-center gap-2.5 lg:block">
          <span
            aria-hidden
            className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px] transition-transform duration-fluid ease-soft group-hover/compteur:scale-105 motion-reduce:transition-none"
            style={{ backgroundColor: pastelFort }}
          >
            {impact ? (
              <span key={`onde-${impact}`} className={styles.onde} style={{ backgroundColor: teinte }} />
            ) : null}
            <img
              src={illustration.repos}
              alt=""
              width={36}
              height={36}
              className="absolute inset-0 m-auto size-9 transition-[opacity,transform] duration-fluid ease-soft group-hover/compteur:scale-110 group-hover/compteur:opacity-0 motion-reduce:transition-none"
            />
            <img
              src={illustration.survol}
              alt=""
              width={36}
              height={36}
              className="absolute inset-0 m-auto size-9 opacity-0 transition-[opacity,transform] duration-fluid ease-soft group-hover/compteur:scale-110 group-hover/compteur:opacity-100 motion-reduce:transition-none"
            />
          </span>
          <p className="flex min-w-0 items-baseline gap-1 tabular-nums lg:hidden">
            {chiffre('text-[28px]')}
            <span className="text-[13px] font-semibold text-[color:color-mix(in_srgb,var(--text-strong)_55%,transparent)]">
              / {compteur.objectif.toLocaleString('fr-FR')}
            </span>
          </p>
        </div>

        <p className="mt-2 text-[12px] font-semibold leading-tight text-text-strong lg:mt-3">
          {compteur.libelle}
        </p>

        <p className="mt-1 hidden items-baseline gap-1.5 lg:flex">
          {chiffre('text-[28px]')}
          <span className="text-[13px] font-semibold tabular-nums text-[color:color-mix(in_srgb,var(--text-strong)_55%,transparent)]">
            / {compteur.objectif.toLocaleString('fr-FR')}
          </span>
        </p>

        <div
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: pastille }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${compteur.libelle} : ${pct} % de l’objectif`}
        >
          <span
            className="block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%`, backgroundColor: teinte }}
          />
        </div>

        {'note' in action ? (
          <BoutonNote
            libelle={action.libelle}
            fond={pastelFort}
            extra={
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  ouvrir();
                }}
                className={`${PILULE} shrink-0 whitespace-nowrap text-text-strong focus-visible:outline-primary-600`}
                style={{ backgroundColor: pastelFort }}
              >
                Mes notes
              </button>
            }
          />
        ) : (
          <Volet>
            <Link
              href={action.href}
              className={`${PILULE} text-text-strong focus-visible:outline-primary-600`}
              style={{ backgroundColor: pastelFort }}
            >
              {action.court ? (
                <>
                  <span className="sm:hidden">{action.court}</span>
                  <span className="max-sm:hidden">{action.libelle}</span>
                </>
              ) : (
                action.libelle
              )}
              <ArrowRight size={12} strokeWidth={2.6} />
            </Link>
          </Volet>
        )}
      </div>
    </li>
  );
}

/** Les quatre familles d’activité. */
export default function CompteursActivite({
  familles,
  accueilleNotes = false,
  periode = '',
}: {
  familles: readonly Compteur[];
  /** Mes chiffres de la période en cours : une note rangée les fait monter. */
  accueilleNotes?: boolean;
  /** Clé de la période affichée : un +1 n'appartient qu'à elle. */
  periode?: string;
}) {
  return (
    <ul className="grid grid-cols-2 items-stretch gap-3 sm:gap-5 lg:grid-cols-4">
      {familles.map((c) => (
        <CarteCompteur key={c.activite} compteur={c} accueilleNotes={accueilleNotes} periode={periode} />
      ))}
    </ul>
  );
}
