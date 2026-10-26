'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Home, Search, UserRound } from 'lucide-react';
import AnnonceVolet from '@/components/dashboard/annonces/AnnonceVolet';
import Select from '@/components/ui/Select';
import { pastilleClass } from '@/components/ui/pastille-classes';
import {
  adresseVerifiee,
  secteursAProspecter,
  type SecteurAProspecter,
} from '@/lib/annonces/liste-prospection';
import {
  baisseCumulee,
  dateCourte,
  euros,
  joursEnLigne,
  libelleAdresse,
  libellePortail,
  prixM2,
} from '@/lib/annonces/presenter';
import type { Annonce, GroupeAnnonce } from '@/lib/annonces/types';
import type { Zone } from '@/lib/zones/types';

type Tri = 'nouveau' | 'baisse' | 'm2';

const TRIS: { value: Tri; label: string }[] = [
  { value: 'nouveau', label: 'Les plus récentes' },
  { value: 'baisse', label: 'Plus forte baisse' },
  { value: 'm2', label: 'Prix au m² le plus bas' },
];

const ORANGE_DOUX = '#FFE0C4';

function sansAccent(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Adresse, ville, portail ou prix : de quoi retrouver une annonce dans la liste. */
function annonceCorrespond(groupe: GroupeAnnonce, cherche: string): boolean {
  const a = groupe.principale;
  const texte = [
    libelleAdresse(a).ligne,
    a.ville,
    a.codePostal,
    libellePortail(a.portail),
    a.prix != null ? String(a.prix) : '',
    ...groupe.annonces.map((x) => libellePortail(x.portail)),
  ]
    .filter(Boolean)
    .join(' ');
  return sansAccent(texte).includes(cherche);
}

const SOUS_TITRE_CLASS =
  'border-t border-black/[0.05] bg-bg-subtle px-4 py-2 text-[9px] uppercase text-mute first:border-t-0 md:px-6';

/* ------------------------------------------- secteurs retirés (par appareil) */

const CLE_RETIRES = 'priimo-liste-secteurs-retires';
let retiresBruts: string | null = null;
const abonnesRetires = new Set<() => void>();

function lireRetiresBruts(): string {
  if (retiresBruts === null) {
    try {
      retiresBruts = localStorage.getItem(CLE_RETIRES) ?? '[]';
    } catch {
      retiresBruts = '[]';
    }
  }
  return retiresBruts;
}

function abonnerRetires(f: () => void): () => void {
  abonnesRetires.add(f);
  return () => abonnesRetires.delete(f);
}

/** Les secteurs retirés de la Liste, retenus sur cet appareil. */
function useSecteursRetires(): [ReadonlySet<string>, (ids: readonly string[]) => void] {
  const brut = useSyncExternalStore(abonnerRetires, lireRetiresBruts, () => '[]');
  const retires = useMemo(() => {
    try {
      const v: unknown = JSON.parse(brut);
      return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set<string>();
    }
  }, [brut]);
  const ecrire = useCallback((ids: readonly string[]) => {
    retiresBruts = JSON.stringify(ids);
    try {
      localStorage.setItem(CLE_RETIRES, retiresBruts);
    } catch {
      /* stockage indisponible : le choix vaut pour cette visite */
    }
    for (const f of abonnesRetires) f();
  }, []);
  return [retires, ecrire];
}

/* -------------------------------------------------------------------- liste */

/**
 * La Liste de Prospection, secteur par secteur : chacun de mes secteurs, puis
 * les autres secteurs de l'agence qui ont des annonces. Une pastille par
 * secteur le retire de la liste ou l'y remet. Dans chaque secteur : d'abord
 * l'adresse retrouvée, puis la rue ou le quartier.
 */
export default function AnnoncesListe({
  annonces,
  zones,
  profileId,
  directeur,
  prenoms,
  initialAnnonceId,
}: {
  annonces: readonly Annonce[];
  zones: readonly Zone[];
  profileId: string;
  directeur: boolean;
  /** Prénom du titulaire de chaque secteur de l'agence. */
  prenoms: Readonly<Record<string, string | null>>;
  initialAnnonceId: string | null;
}) {
  const [enBaisse, setEnBaisse] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<Tri>('nouveau');
  const [ouverte, setOuverte] = useState<string | null>(initialAnnonceId);
  const [retires, ecrireRetires] = useSecteursRetires();

  const secteurs = useMemo(() => secteursAProspecter(annonces, zones, profileId), [annonces, zones, profileId]);
  const miens = secteurs.filter((s) => s.mien);
  const autres = secteurs.filter((s) => !s.mien);

  const affiches = useMemo(() => {
    const cherche = sansAccent(recherche.trim());
    const preparer = (groupes: GroupeAnnonce[]) => {
      const g = groupes.filter((x) => !enBaisse || baisseCumulee(x.principale) != null);
      if (tri === 'baisse') {
        return [...g].sort((x, y) => (baisseCumulee(y.principale) ?? 0) - (baisseCumulee(x.principale) ?? 0));
      }
      if (tri === 'm2') {
        return [...g].sort(
          (x, y) => (prixM2(x.principale) ?? Infinity) - (prixM2(y.principale) ?? Infinity),
        );
      }
      return g;
    };
    return secteurs
      .filter((s) => !retires.has(s.zone.id))
      .map((s) => {
        let groupes = preparer(s.groupes);
        if (cherche && !sansAccent(s.zone.nom).includes(cherche)) {
          groupes = groupes.filter((g) => annonceCorrespond(g, cherche));
        }
        return { ...s, groupes };
      })
      .filter((s) => !cherche || s.groupes.length > 0);
  }, [secteurs, retires, enBaisse, tri, recherche]);

  const compter = (mien: boolean) =>
    affiches.filter((s) => s.mien === mien).reduce((n, s) => n + s.groupes.length, 0);
  const nbMiennes = compter(true);
  const nbAutres = compter(false);
  const annoncesDe = (n: number) => `${n} annonce${n !== 1 ? 's' : ''} de particuliers`;
  // Le même chiffre que « Mes nouvelles adresses » sur l'Accueil : mes secteurs d'abord, l'agence à part.
  const entete =
    miens.length > 0
      ? `${annoncesDe(nbMiennes)} dans ${miens.length > 1 ? 'mes secteurs' : 'mon secteur'}${
          nbAutres > 0 ? ` · ${nbAutres} sur le secteur de l’agence` : ''
        }`
      : `${annoncesDe(nbAutres)} sur le secteur de l’agence`;
  const basculer = (id: string) =>
    ecrireRetires(retires.has(id) ? [...retires].filter((x) => x !== id) : [...retires, id]);
  const titulaire = (s: SecteurAProspecter) =>
    s.mien ? 'à moi' : s.zone.assignedTo ? (prenoms[s.zone.assignedTo] ?? 'un agent') : 'sans agent';

  const selection = useMemo(() => {
    const annonce = ouverte ? annonces.find((a) => a.id === ouverte) : null;
    if (!annonce) return null;
    const soeurs = annonce.logementCle
      ? annonces.filter((a) => a.logementCle === annonce.logementCle)
      : [annonce];
    return { annonce, soeurs };
  }, [annonces, ouverte]);

  const fermer = useCallback(() => {
    setOuverte(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('annonce')) {
      url.searchParams.delete('annonce');
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  useEffect(() => {
    if (!selection) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [selection, fermer]);

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold tabular-nums text-ink" style={{ fontSize: 14 }}>
          {entete}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search
              size={14}
              strokeWidth={2.2}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher"
              aria-label="Rechercher une annonce"
              className="w-44 rounded-full bg-black/[0.04] py-1.5 pl-8 pr-3 text-[13px] font-medium text-text-strong outline-none placeholder:font-medium placeholder:text-text-muted hover:bg-black/[0.07] focus:bg-white focus:ring-2 focus:ring-accent/25"
            />
          </label>
          <button
            type="button"
            aria-pressed={enBaisse}
            onClick={() => setEnBaisse((v) => !v)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-fluid-subtle ${
              enBaisse ? 'bg-text-strong text-white' : 'bg-black/[0.04] text-text-strong hover:bg-black/[0.07]'
            }`}
          >
            En baisse
          </button>
          <Select
            aria-label="Trier"
            value={tri}
            onChange={(v) => setTri(v as Tri)}
            options={TRIS}
            menuMinWidth={240}
            triggerClassName="flex items-center justify-between gap-1.5 rounded-full bg-black/[0.04] px-3 py-1.5 text-left text-[13px] font-medium text-text-strong outline-none transition-colors duration-fluid-subtle hover:bg-black/[0.07] focus-visible:ring-2 focus-visible:ring-accent/25"
          />
        </div>
      </div>

      {secteurs.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2.5">
          {miens.length > 0 ? (
            <PastillesSecteurs
              titre={miens.length > 1 ? 'Mes secteurs' : 'Mon secteur'}
              secteurs={miens}
              retires={retires}
              onBasculer={basculer}
              titulaire={titulaire}
            />
          ) : null}
          {autres.length > 0 ? (
            <PastillesSecteurs
              titre="Sur le secteur de l’agence"
              secteurs={autres}
              retires={retires}
              onBasculer={basculer}
              titulaire={titulaire}
            />
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-clay-lg bg-white shadow-clay">
        {miens.length === 0 && !directeur ? (
          <div className="flex flex-col items-start gap-3 px-4 py-5 md:px-6">
            <p className="text-[13px] leading-snug text-text-muted">
              Pas encore de secteur dessiné à mon nom. Une fois tracé sur la carte, les annonces de particuliers
              qui s’y trouvent arrivent ici.
            </p>
            <Link
              href="/dashboard/prospection"
              className="rounded-full bg-text-strong px-3.5 py-2 text-[13px] font-semibold text-white transition-colors duration-fluid-subtle hover:bg-black"
            >
              Dessiner mon secteur
            </Link>
          </div>
        ) : null}
        {affiches.map((s) => (
          <ListeSecteur
            key={s.zone.id}
            secteur={s}
            titulaire={titulaire(s)}
            vide={
              enBaisse
                ? 'Aucune annonce en baisse dans ce secteur pour l’instant.'
                : 'Aucune annonce de particulier dans ce secteur pour l’instant. Le relevé passe chaque nuit.'
            }
            ouverte={ouverte}
            onOuvrir={setOuverte}
          />
        ))}
        {recherche.trim() && affiches.length === 0 && secteurs.some((s) => !retires.has(s.zone.id)) ? (
          <p className="px-4 py-5 text-[13px] leading-snug text-text-muted md:px-6">
            Aucune annonce ne correspond à cette recherche.
          </p>
        ) : null}
        {secteurs.length > 0 && affiches.length === 0 && !recherche.trim() ? (
          <div className="flex flex-col items-start gap-3 px-4 py-5 md:px-6">
            <p className="text-[13px] leading-snug text-text-muted">Tous les secteurs sont retirés de la liste.</p>
            <button
              type="button"
              onClick={() => ecrireRetires([])}
              className="rounded-full bg-black/[0.04] px-3.5 py-2 text-[13px] font-semibold text-text-strong transition-colors duration-fluid-subtle hover:bg-black/[0.07]"
            >
              Tout remettre
            </button>
          </div>
        ) : null}
        {secteurs.length === 0 && directeur ? (
          <p className="px-4 py-5 text-[13px] leading-snug text-text-muted md:px-6">
            Aucun secteur dessiné dans l’agence pour l’instant.
          </p>
        ) : null}
      </div>

      {selection ? (
        <>
          <div
            role="presentation"
            aria-hidden
            className="fixed inset-0 z-40 hidden bg-black/15 md:block"
            onClick={fermer}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Annonce"
            className="fixed inset-0 z-[70] flex flex-col bg-black/15 p-3 pt-[max(12px,env(safe-area-inset-top))] md:inset-auto md:bottom-4 md:right-4 md:top-16 md:z-50 md:w-[380px] md:bg-transparent md:p-0"
          >
            <AnnonceVolet annonce={selection.annonce} soeurs={selection.soeurs} onFermer={fermer} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Une pastille par secteur : allumée, il est dans la liste ; éteinte, il en est retiré. */
function PastillesSecteurs({
  titre,
  secteurs,
  retires,
  onBasculer,
  titulaire,
}: {
  titre: string;
  secteurs: readonly SecteurAProspecter[];
  retires: ReadonlySet<string>;
  onBasculer: (id: string) => void;
  titulaire: (s: SecteurAProspecter) => string;
}) {
  return (
    <div>
      <p className="mb-1 px-0.5 text-[11.5px] font-medium text-text-subtle">{titre}</p>
      <div role="group" aria-label={titre} className="flex flex-wrap gap-1.5">
        {secteurs.map((s) => {
          const affiche = !retires.has(s.zone.id);
          return (
            <button
              key={s.zone.id}
              type="button"
              aria-pressed={affiche}
              onClick={() => onBasculer(s.zone.id)}
              title={`${s.zone.nom} · ${titulaire(s)} — ${affiche ? 'retirer de la liste' : 'remettre dans la liste'}`}
              className={`${pastilleClass(affiche)} inline-flex min-w-0 max-w-full items-center gap-1.5 ${
                affiche ? '' : 'bg-surface-2 line-through decoration-1'
              }`}
            >
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: s.zone.couleur }} />
              <span className="truncate">{s.zone.nom}</span>
              {s.mien ? null : (
                <span className={`truncate font-medium ${affiche ? 'text-white/75' : ''}`}>· {titulaire(s)}</span>
              )}
              <span className={`tabular-nums ${affiche ? 'text-white/75' : ''}`}>{s.groupes.length}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListeSecteur({
  secteur,
  titulaire,
  vide,
  ouverte,
  onOuvrir,
}: {
  secteur: SecteurAProspecter;
  titulaire: string;
  vide: string;
  ouverte: string | null;
  onOuvrir: (id: string) => void;
}) {
  const { zone, groupes, mien } = secteur;
  const verifiees = groupes.filter((g) => adresseVerifiee(g.principale));
  const aConfirmer = groupes.filter((g) => !adresseVerifiee(g.principale));
  return (
    <section className="border-t border-black/[0.06] first:border-t-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <h2 className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-text-strong">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: zone.couleur }} />
          <span className="truncate">{zone.nom}</span>
          {mien ? (
            <UserRound size={14} strokeWidth={2.2} aria-label="à moi" className="shrink-0 text-accent-dark" />
          ) : (
            <span className="truncate text-[12.5px] font-medium text-text-muted">· {titulaire}</span>
          )}
        </h2>
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-text-muted">{groupes.length}</span>
      </div>
      {groupes.length === 0 ? (
        <p className="px-4 pb-4 text-[13px] leading-snug text-text-muted md:px-6">{vide}</p>
      ) : (
        <>
          {verifiees.length > 0 ? (
            <Section titre="Adresses vérifiées" groupes={verifiees} ouverte={ouverte} onOuvrir={onOuvrir} />
          ) : null}
          {aConfirmer.length > 0 ? (
            <Section
              titre="Adresses à confirmer"
              detail="Plusieurs numéros possibles, ou la rue seule : à confirmer sur place."
              groupes={aConfirmer}
              ouverte={ouverte}
              onOuvrir={onOuvrir}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function Section({
  titre,
  detail,
  groupes,
  ouverte,
  onOuvrir,
}: {
  titre: string;
  detail?: string;
  groupes: readonly GroupeAnnonce[];
  ouverte: string | null;
  onOuvrir: (id: string) => void;
}) {
  return (
    <section>
      <div className={SOUS_TITRE_CLASS}>
        <p style={{ letterSpacing: '0.14em' }}>
          {titre} ({groupes.length})
        </p>
        {detail ? <p className="mt-0.5 text-[11px] normal-case text-mute">{detail}</p> : null}
      </div>
      <ul>
        {groupes.map((g) => (
          <Ligne
            key={g.cle}
            groupe={g}
            active={g.annonces.some((a) => a.id === ouverte)}
            onOuvrir={() => onOuvrir(g.principale.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function Ligne({
  groupe,
  active,
  onOuvrir,
}: {
  groupe: GroupeAnnonce;
  active: boolean;
  onOuvrir: () => void;
}) {
  const a = groupe.principale;
  const lieu = libelleAdresse(a);
  const baisse = baisseCumulee(a);
  const jours = joursEnLigne(a);
  const enLigne = depuisQuand(a);
  const photo = groupe.annonces.find((x) => (x.photos ?? []).length > 0)?.photos?.[0] ?? null;
  const portails = libellePortail(a.portail);
  const details = [
    a.prix != null ? euros(a.prix) : null,
    a.surface != null ? `${Math.round(a.surface)} m²` : null,
    a.pieces != null ? `${a.pieces} p.` : null,
    a.dpe ? `DPE ${a.dpe}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const signaux = [
    baisse != null ? `Prix −${String(baisse).replace('.', ',')} %` : null,
    jours != null && jours <= 2 ? 'Nouvelle' : null,
    groupe.annonces.some((x) => x.refusDemarchage) ? 'Refuse les appels' : null,
  ].filter((s): s is string => s != null);

  return (
    <li className="border-t border-black/[0.05]">
      <button
        type="button"
        onClick={onOuvrir}
        aria-current={active || undefined}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fluid-subtle md:gap-4 md:px-6 md:py-3.5 ${
          active ? 'bg-black/[0.03]' : 'hover:bg-black/[0.018]'
        }`}
      >
        <span className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-[28px] bg-[#F1EFE8] text-text-subtle">
          {photo ? (
            // Photo du portail, servie telle quelle (pas d'optimisation Next pour une image tierce).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <Home size={28} strokeWidth={1.8} aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-text-strong">{lieu.ligne}</span>
          {details ? <span className="mt-0.5 block truncate text-[12px] text-text-muted">{details}</span> : null}
          <span className="mt-0.5 block truncate text-[11.5px] text-text-subtle">
            {portails}
            {enLigne ? ` · ${enLigne}` : ''}
          </span>
          {signaux.length > 0 ? (
            <span className="mt-1.5 flex flex-wrap gap-1 md:hidden">
              <Signaux signaux={signaux} />
            </span>
          ) : null}
        </span>
        {signaux.length > 0 ? (
          <span className="hidden max-w-[45%] shrink-0 flex-wrap justify-end gap-1 md:flex">
            <Signaux signaux={signaux} />
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** PAP ne donne pas sa date de mise en ligne : on dit alors quand le relevé l'a trouvée. */
function depuisQuand(a: Annonce): string | null {
  if (!a.publieeLe) return a.premiereVueLe ? `relevée le ${dateCourte(a.premiereVueLe)}` : null;
  const jours = joursEnLigne(a);
  if (jours == null) return null;
  if (jours === 0) return 'en ligne depuis aujourd’hui';
  if (jours === 1) return 'en ligne depuis hier';
  return `en ligne depuis ${jours} j`;
}

function Signaux({ signaux }: { signaux: readonly string[] }) {
  return (
    <>
      {signaux.map((s) => (
        <span
          key={s}
          className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-text-strong"
          style={{ backgroundColor: ORANGE_DOUX }}
        >
          {s}
        </span>
      ))}
    </>
  );
}

