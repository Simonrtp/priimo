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

/**
 * Le geste qui fait monter le chiffre, et rien d'autre. Chaque libellé nomme
 * l'action, pas la page : un compteur qu'on ne sait pas alimenter reste à zéro.
 * Les destinations suivent la provenance déclarée dans `PROVENANCE_ACTIVITE`.
 *
 * Une note de terrain ne renvoie sur aucune page : elle se prend sur place,
 * écrite ou dictée, sinon le compteur coûte une navigation pour trois mots.
 */
type ActionCompteur = { libelle: string } & ({ href: string } | { note: true });

const ACTION: Record<FamilleActivite, ActionCompteur> = {
  contacts_physiques: {
    libelle: 'Lancer ma sortie',
    href: '/dashboard/prospection?vue=carte&itineraire=1',
  },
  immeubles_prospectes: {
    libelle: 'Ouvrir la carte',
    href: '/dashboard/prospection?vue=carte',
  },
  contacts_qualifies: {
    libelle: 'Qualifier un lead',
    href: '/dashboard/prospection?vue=pipeline',
  },
  estimations: {
    libelle: 'Créer une estimation',
    href: '/dashboard/estimation',
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
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-text-strong shadow-clay-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600';

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
  contacts_physiques: { repos: '/porte-ouverte.png', survol: '/porte-ouverte-contour.png' },
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
          aria-label="Ajouter une information terrain"
          className="absolute bottom-full left-0 z-20 mb-1.5 flex min-w-[8.5rem] flex-col overflow-hidden rounded-clay border border-black/[0.08] bg-surface py-1 shadow-clay"
        >
          <ChoixNote icone={NotebookPen} libelle="Écrire" onClick={() => choisir(openCompose)} />
          <ChoixNote icone={Mic} libelle="Dicter" onClick={() => choisir(openCapture)} />
        </div>
      ) : null}
      <Volet force={ouvert}>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={ouvert}
            aria-controls={ouvert ? menuId : undefined}
            onClick={() => setOuvert((prev) => !prev)}
            className={`${PILULE} shrink-0 whitespace-nowrap`}
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

function ecartLisible(ecart: number): string {
  if (ecart === 0) return 'stable';
  return `${ecart > 0 ? '+' : '−'}${Math.abs(ecart)}`;
}

function CarteCompteur({ compteur }: { compteur: Compteur }) {
  const famille = compteur.activite as FamilleActivite;
  const { teinte, pastelFort, pastille, voile } = COULEUR_FAMILLE[famille];
  const illustration = ILLUSTRATION[famille];
  const action = ACTION[famille];
  const { ouvrir } = useNotesLecture();
  const pct =
    compteur.objectif > 0
      ? Math.min(100, Math.round((compteur.valeur / compteur.objectif) * 100))
      : 0;

  return (
    <li className="relative min-w-0">
      {/* Calibre la case au repos, sans les images : la carte vraie se pose
          par-dessus et s'allonge au survol sans pousser la grille. */}
      <div className="invisible flex flex-col p-4 [@media(hover:none)]:hidden" aria-hidden>
        <span className="size-12 shrink-0" />
        <p className="mt-3 text-[12px] font-semibold leading-tight">{compteur.libelle}</p>
        <p className="mt-1 font-display text-[28px] font-bold leading-none">0</p>
        <div className="mt-3 h-2.5" />
        {compteur.ecartSemainePrecedente !== null ? (
          <p className="mt-2 text-[11px] font-medium">.</p>
        ) : null}
      </div>
      <div
        className="group/compteur flex h-full flex-col rounded-clay-lg p-4 shadow-clay-sm [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-x-0 [@media(hover:hover)]:top-0 [@media(hover:hover)]:h-auto [@media(hover:hover)]:min-h-full hover:z-30 focus-within:z-30"
        style={{ backgroundColor: voile }}
      >
        <span
          aria-hidden
          // Fond clair sous les illustrations : la couleur du dessin reste lisible.
          className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px] transition-transform duration-fluid ease-soft group-hover/compteur:scale-105 motion-reduce:transition-none"
          style={{ backgroundColor: pastelFort }}
        >
          {/* Les deux dessins superposés : fondu croisé, sans saut de mise en page. */}
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

        <p className="mt-3 text-[12px] font-semibold leading-tight text-text-strong">
          {compteur.libelle}
        </p>

        <p className="mt-1 flex items-baseline gap-1.5">
          <span
            className="font-display text-[28px] font-bold leading-none tabular-nums"
            style={{ color: teinte }}
          >
            {compteur.valeur.toLocaleString('fr-FR')}
          </span>
          <span className="text-[13px] font-semibold tabular-nums text-text-strong/55">
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
            className="block h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: teinte }}
          />
        </div>

        {compteur.ecartSemainePrecedente !== null ? (
          <p className="mt-2 text-[11px] font-medium text-text-strong/50">
            {ecartLisible(compteur.ecartSemainePrecedente)} vs période précédente
          </p>
        ) : null}

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
                className={`${PILULE} shrink-0 whitespace-nowrap`}
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
              className={PILULE}
              style={{ backgroundColor: pastelFort }}
            >
              {action.libelle}
              <ArrowRight size={12} strokeWidth={2.6} />
            </Link>
          </Volet>
        )}
      </div>
    </li>
  );
}

/** Les cinq familles. Au survol la carte s'allonge par-dessus la grille. */
export default function CompteursActivite({ familles }: { familles: readonly Compteur[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {familles.map((c) => (
        <CarteCompteur key={c.activite} compteur={c} />
      ))}
    </ul>
  );
}
