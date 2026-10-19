'use client';

import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import Modal from '@/components/ui/Modal';
import type { AgentPodium } from '@/lib/activite/podium';
import { LIBELLE_ACTIVITE, type Activite } from '@/lib/activite/types';

/** Une place : un aplat, sans bande claire ni ombre sur le dessus. */
const MARCHE = {
  1: {
    fond: '#F5C542',
    texte: '#FFFFFF',
    anneau: '#E0A100',
    avatar: 36,
    chiffre: '1.15rem',
  },
  2: {
    fond: '#D7DBE3',
    texte: '#1A2A56',
    anneau: '#C5CAD3',
    avatar: 28,
    chiffre: '1rem',
  },
  3: {
    fond: '#C4844A',
    texte: '#FFFFFF',
    anneau: '#A86B32',
    avatar: 28,
    chiffre: '0.9rem',
  },
} as const;

const ORDRE = [2, 1, 3] as const;

/** Hauteur de la marche seule. La 3e reste sous la 2e, la 2e sous la 1re, d'un même cran. */
const ECART = 24;
const HAUT_TROISIEME = 32;
const HAUTEUR_PLACE = {
  1: HAUT_TROISIEME + ECART * 2,
  2: HAUT_TROISIEME + ECART,
  3: HAUT_TROISIEME,
} as const;

const STATS: readonly Activite[] = [
  'immeubles_prospectes',
  'contacts_qualifies',
  'estimations',
  'informations_terrain',
  'mandats',
];

const COURT: Record<Activite, string> = {
  immeubles_prospectes: 'Immeubles',
  contacts_qualifies: 'Contacts',
  estimations: 'Estimations',
  informations_terrain: 'Notes',
  mandats: 'Mandats',
};

/** 1 or, 2 argent, 3 bronze. La suite du classement reste neutre. */
const LIGNE = {
  1: { fond: '#F5C542', texte: '#1A2A56', mute: 'rgba(26,42,86,0.72)' },
  2: { fond: '#D7DBE3', texte: '#1A2A56', mute: 'rgba(26,42,86,0.72)' },
  3: { fond: '#C4844A', texte: '#FFFFFF', mute: 'rgba(255,255,255,0.84)' },
} as const;

const LIGNE_SUITE = { fond: '#F4F6FB', texte: '#1A2A56', mute: 'rgba(26,42,86,0.62)' };

function ligneDuRang(index: number) {
  if (index === 0) return LIGNE[1];
  if (index === 1) return LIGNE[2];
  if (index === 2) return LIGNE[3];
  return LIGNE_SUITE;
}

export default function CarteCompetition({
  podium,
  classement = false,
  vide = false,
}: {
  podium: readonly AgentPodium[];
  /** Un clic sur le podium entier ouvre la liste des noms et des stats. */
  classement?: boolean;
  /** Aucun collaborateur : les trois marches restent, sans personne dessus. */
  vide?: boolean;
}) {
  const listeId = useId();
  const [listeOuverte, setListeOuverte] = useState(false);
  const places = ORDRE.map((rang) => ({
    rang,
    agent: vide ? null : (podium[rang - 1] ?? null),
  }));
  const voitListe = classement && !vide;

  const marches = (
    <>
      {places.map(({ rang, agent }, index) => {
        const marche = MARCHE[rang];
        const exterieurGauche = index === 0;
        const exterieurDroit = index === places.length - 1;
        return (
          <div
            key={agent?.id ?? rang}
            className="flex h-auto min-w-0 flex-1 flex-col items-center justify-end self-end"
            style={{ '--anneau': marche.anneau } as CSSProperties}
            aria-hidden={agent ? undefined : true}
          >
            {agent ? (
              <span className="relative z-10 -mb-1 rounded-full shadow-[0_0_0_2px_#fff,0_0_0_3px_var(--anneau)] transition-transform duration-300 ease-out group-hover/podium:scale-[1.03]">
                <ProfileAvatar
                  firstName={agent.prenom}
                  lastName={agent.nom}
                  avatarUrl={agent.avatarUrl}
                  size={marche.avatar}
                />
              </span>
            ) : null}
            <div
              className="relative flex w-full shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden px-1 pb-1 transition-[filter] duration-300 group-hover/podium:brightness-105"
              style={{
                height: HAUTEUR_PLACE[rang],
                background: marche.fond,
                color: marche.texte,
                borderTopLeftRadius: exterieurGauche || rang === 1 ? 4 : 0,
                borderTopRightRadius: exterieurDroit || rang === 1 ? 4 : 0,
              }}
            >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition-all duration-700 ease-out group-hover/podium:left-[130%] group-hover/podium:opacity-60"
                />
                <span className="relative font-display font-bold leading-none" style={{ fontSize: marche.chiffre }}>
                  {rang}
                </span>
                {agent ? (
                  <span className="relative flex max-w-full items-baseline gap-1 leading-none">
                    <span className="truncate text-[10px] font-semibold">{agent.prenom}</span>
                    <span className="shrink-0 text-[10px] font-semibold tabular-nums">{agent.score}</span>
                  </span>
                ) : null}
            </div>
          </div>
        );
      })}
    </>
  );

  return (
    <section
      aria-label={vide ? 'Compétition, podium vide' : 'Compétition'}
      className="relative col-span-2 flex min-w-0 items-end self-end lg:col-span-1"
    >
      <h2 className="sr-only">Compétition</h2>
      <Socle
        cliquable={voitListe}
        listeOuverte={listeOuverte}
        listeId={listeId}
        onListe={() => setListeOuverte(true)}
      >
        {marches}
      </Socle>
      {voitListe ? (
        <ListeClassement
          id={listeId}
          open={listeOuverte}
          podium={podium}
          onClose={() => setListeOuverte(false)}
        />
      ) : null}
    </section>
  );
}

function Socle({
  cliquable,
  listeOuverte,
  listeId,
  onListe,
  children,
}: {
  cliquable: boolean;
  listeOuverte: boolean;
  listeId: string;
  onListe: () => void;
  children: ReactNode;
}) {
  const classe =
    'group/podium flex w-full flex-col outline-none transition-transform duration-300 ease-out hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-[#1A2A56] focus-visible:ring-offset-2';
  const contenu = (
    <>
      <div className="flex w-full items-end">{children}</div>
      <div aria-hidden className="h-2.5 w-full shrink-0 bg-[#1A2A56]" />
    </>
  );
  if (!cliquable) return <div className={classe}>{contenu}</div>;
  return (
    <button
      type="button"
      className={`${classe} cursor-pointer text-left`}
      aria-label="Voir le classement"
      aria-expanded={listeOuverte}
      aria-controls={listeId}
      onClick={onListe}
    >
      {contenu}
    </button>
  );
}

function ListeClassement({
  id,
  open,
  podium,
  onClose,
}: {
  id: string;
  open: boolean;
  podium: readonly AgentPodium[];
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Classement" maxWidth="xl" compact>
      {podium.length === 0 ? (
        <p className="py-6 text-[13.5px] font-medium text-[#1A2A56]">
          Pas encore de passage cette semaine.
        </p>
      ) : (
        <ol id={id} className="flex flex-col gap-1.5">
          {podium.map((agent, index) => {
            const ligne = ligneDuRang(index);
            return (
              <li
                key={agent.id}
                className="flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-1.5"
                style={{ background: ligne.fond, color: ligne.texte }}
              >
                <ProfileAvatar
                  firstName={agent.prenom}
                  lastName={agent.nom}
                  avatarUrl={agent.avatarUrl}
                  size={28}
                />
                <span className="w-4 shrink-0 text-[13px] font-bold tabular-nums">{index + 1}</span>
                <span className="min-w-0 truncate text-[13.5px] font-semibold">
                  {agent.prenom} {agent.nom}
                </span>
                <dl className="ml-auto flex min-w-0 flex-wrap items-baseline justify-end gap-x-3 gap-y-0.5">
                  {STATS.map((cle) => (
                    <div key={cle} className="flex items-baseline gap-1" title={LIBELLE_ACTIVITE[cle]}>
                      <dt className="text-[11px]" style={{ color: ligne.mute }}>
                        {COURT[cle]}
                      </dt>
                      <dd className="text-[13px] font-semibold tabular-nums">{agent.stats[cle]}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
