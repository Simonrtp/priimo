'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import type { AgentPodium } from '@/lib/activite/podium';
import { LIBELLE_ACTIVITE, type Activite } from '@/lib/activite/types';
import { ACCUEIL_VUE_COOKIE } from '@/lib/today/accueil-vue';

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
    texte: '#FFFFFF',
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

function ouvrirAgence() {
  const maxAge = 60 * 60 * 24 * 400;
  document.cookie = `${ACCUEIL_VUE_COOKIE}=directeur; path=/; max-age=${maxAge}; SameSite=Lax`;
}

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

export default function CarteCompetition({
  podium,
  peutOuvrir = false,
  classement = false,
  vide = false,
}: {
  podium: readonly AgentPodium[];
  /** Le directeur ouvre l'agence d'un clic sur le podium entier. */
  peutOuvrir?: boolean;
  /** L'agent ouvre la liste des noms et des stats. */
  classement?: boolean;
  /** Aucun collaborateur : les trois marches restent, sans personne dessus. */
  vide?: boolean;
}) {
  const router = useRouter();
  const listeId = useId();
  const ancre = useRef<HTMLElement>(null);
  const [listeOuverte, setListeOuverte] = useState(false);
  const places = ORDRE.map((rang) => ({
    rang,
    agent: vide ? null : (podium[rang - 1] ?? null),
  }));
  const voitListe = classement && !peutOuvrir && !vide;
  const cliquable = (peutOuvrir || voitListe) && !vide && (voitListe || places.some((place) => place.agent));

  useEffect(() => {
    if (!listeOuverte) return;
    function fermer(event: MouseEvent) {
      if (!ancre.current?.contains(event.target as Node)) setListeOuverte(false);
    }
    function echap(event: KeyboardEvent) {
      if (event.key === 'Escape') setListeOuverte(false);
    }
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('mousedown', fermer);
      document.removeEventListener('keydown', echap);
    };
  }, [listeOuverte]);

  function allerAgence(event: { preventDefault: () => void }) {
    event.preventDefault();
    ouvrirAgence();
    router.push('/dashboard');
    router.refresh();
  }

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
              <span className="relative z-10 -mb-1 rounded-full shadow-[0_0_0_2px_#fff,0_0_0_3px_var(--anneau)] transition-transform duration-300 ease-out group-hover/podium:-translate-y-0.5 group-hover/podium:scale-105 group-hover/podium:shadow-[0_0_0_2px_#fff,0_0_0_3px_var(--anneau),0_6px_14px_var(--anneau)]">
                <ProfileAvatar
                  firstName={agent.prenom}
                  lastName={agent.nom}
                  avatarUrl={agent.avatarUrl}
                  size={marche.avatar}
                />
              </span>
            ) : null}
            <div
              className="relative flex w-full shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden px-1 pb-1 transition-[filter] duration-300 group-hover/podium:brightness-110"
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
                  className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/45 opacity-0 transition-all duration-500 ease-out group-hover/podium:left-[130%] group-hover/podium:opacity-100"
                />
                <span className="relative font-display font-bold leading-none" style={{ fontSize: marche.chiffre }}>
                  {rang}
                </span>
                {agent ? (
                  <span className="relative max-w-full truncate text-[10px] font-semibold leading-none">
                    {agent.prenom}
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
      ref={ancre}
      aria-label={vide ? 'Compétition, podium vide' : 'Compétition'}
      className="relative col-span-2 flex min-w-0 items-end self-end lg:col-span-1"
    >
      <h2 className="sr-only">Compétition</h2>
      <Socle
        cliquable={cliquable}
        liste={voitListe}
        listeOuverte={listeOuverte}
        listeId={listeId}
        onOuvrir={allerAgence}
        onListe={() => setListeOuverte((ouverte) => !ouverte)}
      >
        {marches}
      </Socle>
      {voitListe && listeOuverte ? <ListeClassement id={listeId} podium={podium} /> : null}
    </section>
  );
}

function Socle({
  cliquable,
  liste,
  listeOuverte,
  listeId,
  onOuvrir,
  onListe,
  children,
}: {
  cliquable: boolean;
  liste: boolean;
  listeOuverte: boolean;
  listeId: string;
  onOuvrir: (event: { preventDefault: () => void }) => void;
  onListe: () => void;
  children: ReactNode;
}) {
  const classe =
    'group/podium flex w-full flex-col outline-none transition-transform duration-300 ease-out hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[#1A2A56] focus-visible:ring-offset-2';
  const contenu = (
    <>
      <div className="flex w-full items-end">{children}</div>
      <div aria-hidden className="h-2.5 w-full shrink-0 bg-[#1A2A56]" />
    </>
  );
  if (liste && cliquable) {
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
  if (!cliquable) return <div className={classe}>{contenu}</div>;
  return (
    <Link href="/dashboard" onClick={onOuvrir} aria-label="Voir l'agence" className={classe}>
      {contenu}
    </Link>
  );
}

function ListeClassement({ id, podium }: { id: string; podium: readonly AgentPodium[] }) {
  return (
    <div
      id={id}
      role="region"
      aria-label="Classement"
      className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-clay-lg bg-surface p-3 shadow-clay"
    >
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">Classement</p>
      {podium.length === 0 ? (
        <p className="px-1 pt-2 text-[13px] text-text-muted">Pas encore de passage cette semaine.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-2">
          {podium.map((agent, index) => (
            <li key={agent.id} className="rounded-2xl bg-surface-2 px-3 py-2">
              <p className="truncate text-[13px] font-semibold text-text-strong">
                <span className="mr-1.5 tabular-nums text-text-muted">{index + 1}</span>
                {agent.prenom} {agent.nom}
              </p>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
                {STATS.map((cle) => (
                  <div key={cle} className="flex items-baseline justify-between gap-2">
                    <dt className="truncate text-[11px] text-text-muted">{LIBELLE_ACTIVITE[cle]}</dt>
                    <dd className="shrink-0 text-[12px] font-semibold tabular-nums text-text-strong">
                      {agent.stats[cle]}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
