'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Mic, NotebookPen } from 'lucide-react';
import { COULEUR_FAMILLE, GRIS_NEUTRE } from '@/lib/activite/couleurs';
import { detailCompteur, type RepartitionEquipe } from '@/lib/activite/repartition';
import type { SecteurPeriode } from '@/lib/activite/secteurs-travailles';
import type { Compteur, FamilleActivite } from '@/lib/activite/types';
import CarteSecteurs from './CarteSecteurs';
import LignesSurvol from './LignesSurvol';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { useNotesLecture } from '@/components/dashboard/notes/NotesLectureProvider';
import { derniereNoteDeLaPeriode, ligneDerniereNote } from '@/lib/notes/derniere-ligne';
import type { Intervalle } from '@/lib/activite/semaines';
import { useOutsideDismiss } from '@/lib/hooks/useOutsideDismiss';
import { armPointerShield } from '@/lib/ui/pointer-guard';
import { EVENEMENT_ENVOL_ARRIVE, type EnvolArrive } from '@/lib/ui/envol-note';
import styles from './envol.module.css';
import { useMonteeEntree } from '@/components/dashboard/entree/useMonteeEntree';

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
} & ({ href: string } | { note: true } | { bientot: true });

const ACTION: Record<FamilleActivite, ActionCompteur> = {
  immeubles_prospectes: {
    libelle: 'Ouvrir la carte',
    href: '/dashboard/prospection?vue=carte',
  },
  contacts_qualifies: {
    libelle: 'Passer en Contacté',
    court: 'Qualifier',
    href: '/dashboard/prospection?vue=pipeline',
  },
  estimations: {
    libelle: 'Passer en Estimation',
    court: 'Estimer',
    href: '/dashboard/prospection?vue=pipeline',
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
      <Icone size={15} strokeWidth={2} className="text-ia" aria-hidden />
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
    function onArrivee(e: Event) {
      const d = (e as CustomEvent<EnvolArrive>).detail;
      if (!d || d.cible !== famille) return;
      const monte = d.compte && accueilleNotes && d.t0 > recuLe.current;
      setCompte(monte);
      if (monte) setBonus((b) => b + (d.pas ?? 1));
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
  montrerActions,
  equipe = null,
  intervalle = null,
  membreId = null,
}: {
  compteur: Compteur;
  accueilleNotes: boolean;
  periode: string;
  montrerActions: boolean;
  equipe?: readonly RepartitionEquipe[] | null;
  intervalle?: Intervalle | null;
  membreId?: string | null;
}) {
  const famille = compteur.activite as FamilleActivite;
  const action = ACTION[famille];
  const bientot = 'bientot' in action;
  const { teinte, pastelFort, pastille, voile } = bientot
    ? GRIS_NEUTRE
    : COULEUR_FAMILLE[famille];
  const illustration = ILLUSTRATION[famille];
  const { ouvrir, notes } = useNotesLecture();
  const { bonus, impact, compte } = useArriveeNote(famille, compteur, accueilleNotes, periode);
  const valeur = compteur.valeur + bonus;
  const refChiffre = useRef<HTMLSpanElement>(null);
  const valeurAffichee = useMonteeEntree(valeur, refChiffre);
  const nombreSeul = compteur.activite === 'informations_terrain';
  const derniere =
    nombreSeul && intervalle ? derniereNoteDeLaPeriode(notes ?? [], { membreId, intervalle }) : null;
  const ligneDerniere = derniere ? ligneDerniereNote(derniere) : '';
  const survol =
    equipe && equipe.length > 1 && (famille === 'contacts_qualifies' || famille === 'informations_terrain')
      ? detailCompteur(equipe, famille === 'contacts_qualifies' ? 'contacts' : 'notes')
      : null;
  const pct = nombreSeul
    ? 0
    : compteur.objectif > 0
      ? Math.min(100, Math.round((valeur / compteur.objectif) * 100))
      : 0;
  // Le chiffre que vise une pastille qui s'envole, et sa couleur.
  const accueilleEnvol = famille === 'informations_terrain' || famille === 'contacts_qualifies';
  const cible = accueilleEnvol
    ? { 'data-envol-cible': famille, 'data-envol-couleur': teinte }
    : {};
  const chiffre = (taille: string) => (
    <span className="relative inline-flex">
      <span
        key={impact}
        ref={refChiffre}
        {...cible}
        className={`font-display ${taille} font-bold leading-none tabular-nums ${impact ? styles.chiffreImpact : ''}`}
        style={{ color: teinte }}
      >
        {valeurAffichee.toLocaleString('fr-FR')}
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
          par-dessus et s'allonge au survol sans pousser la grille.
          Une carte « à venir » reste dans le flux : sa pastille est toujours
          visible, elle ne doit pas recouvrir la carte du dessous. */}
      {bientot ? null : (
        <div className="invisible flex flex-col p-4 [@media(hover:none)]:hidden" aria-hidden>
          <div className="flex items-center gap-2.5">
            <span className="size-12 shrink-0" />
            <p className="font-display text-[28px] font-bold leading-none">0</p>
          </div>
          <p className="mt-2 text-[12px] font-semibold leading-tight">{compteur.libelle}</p>
          {nombreSeul ? (
            ligneDerniere ? <p className="mt-2 truncate text-[12px] font-medium leading-tight">{ligneDerniere}</p> : null
          ) : (
            <div className="mt-3 h-2.5" />
          )}
        </div>
      )}
      <div
        aria-disabled={bientot || undefined}
        className={`flex h-full flex-col rounded-clay-lg p-4 shadow-clay-sm ${
          bientot
            ? 'cursor-default'
            : 'group/compteur hover:z-30 focus-within:z-30 [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-x-0 [@media(hover:hover)]:top-0 [@media(hover:hover)]:h-auto [@media(hover:hover)]:min-h-full'
        }`}
        style={{ backgroundColor: voile }}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`relative flex size-12 shrink-0 items-center justify-center rounded-[14px] ${
              bientot
                ? ''
                : 'transition-transform duration-fluid ease-soft group-hover/compteur:scale-105 motion-reduce:transition-none'
            }`}
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
          <p className="flex min-w-0 items-baseline gap-1 tabular-nums">
            {chiffre('text-[28px]')}
            {nombreSeul ? null : (
              <span className="text-[13px] font-semibold text-[color:color-mix(in_srgb,var(--text-strong)_55%,transparent)]">
                / {compteur.objectif.toLocaleString('fr-FR')}
              </span>
            )}
          </p>
        </div>

        <p
          className={`mt-2 text-[12px] font-semibold leading-tight ${
            bientot ? 'text-text-muted' : 'text-text-strong'
          }`}
        >
          {compteur.libelle}
        </p>

        {survol ? <LignesSurvol detail={survol} /> : null}

        {ligneDerniere ? (
          <button
            type="button"
            onClick={() => ouvrir()}
            aria-label={`Toutes les notes. ${ligneDerniere}`}
            className="mt-2 block w-full truncate text-left text-[12px] font-medium leading-tight text-text-muted hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            {ligneDerniere}
          </button>
        ) : null}

        {nombreSeul ? null : (
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
            className="block h-full w-full origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${Math.max(0, Math.min(1, pct / 100))})`, backgroundColor: teinte }}
          />
        </div>
        )}

        {bientot ? (
          <span
            className={`${PILULE} mt-2.5 w-fit cursor-default text-text-muted`}
            style={{ backgroundColor: pastelFort }}
          >
            À venir
          </span>
        ) : montrerActions && 'note' in action ? (
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
        ) : montrerActions && 'href' in action ? (
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
        ) : null}
      </div>
    </li>
  );
}

/** L’estimation ferme la rangée, à droite. L’ordre de calcul, lui, ne change pas. */
const ORDRE_CARTES: readonly FamilleActivite[] = [
  'immeubles_prospectes',
  'contacts_qualifies',
  'informations_terrain',
  'estimations',
];

/** Les quatre familles d’activité. */
export default function CompteursActivite({
  familles,
  accueilleNotes = false,
  periode = '',
  montrerActions = true,
  compact = false,
  secteurs = null,
  equipe = null,
  intervalle = null,
  membreId = null,
}: {
  familles: readonly Compteur[];
  /** Mes chiffres de la période en cours : une note rangée les fait monter. */
  accueilleNotes?: boolean;
  /** Clé de la période affichée : un +1 n'appartient qu'à elle. */
  periode?: string;
  /** Les raccourcis (carte, noter) sont ceux de la personne connectée. */
  montrerActions?: boolean;
  /** Deux colonnes : la carte vit dans une moitié d’écran (vue agence). */
  compact?: boolean;
  /** À la place du score « secteurs » : travaillé ou non, un par secteur. */
  secteurs?: readonly SecteurPeriode[] | null;
  /** Agence : au survol, qui a fait les contacts et les notes. */
  equipe?: readonly RepartitionEquipe[] | null;
  /** Période affichée : la ligne sous les notes en est la dernière. */
  intervalle?: Intervalle | null;
  /** La personne dont on lit la semaine. */
  membreId?: string | null;
}) {
  return (
    <ul
      className={`grid grid-cols-2 items-stretch gap-3 sm:gap-5 ${compact ? '' : 'lg:grid-cols-4'}`}
    >
      {ORDRE_CARTES.flatMap((cle) => {
        const c = familles.find((f) => f.activite === cle);
        return c ? [c] : [];
      }).map((c) =>
        c.activite === 'immeubles_prospectes' && secteurs ? (
          <CarteSecteurs key={c.activite} secteurs={secteurs} montrerActions={montrerActions} equipe={equipe} />
        ) : (
          <CarteCompteur
            key={c.activite}
            compteur={c}
            accueilleNotes={accueilleNotes}
            periode={periode}
            montrerActions={montrerActions}
            equipe={equipe}
            intervalle={intervalle}
            membreId={membreId}
          />
        ),
      )}
    </ul>
  );
}
