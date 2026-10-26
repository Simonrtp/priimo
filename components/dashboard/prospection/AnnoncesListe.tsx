'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Home, Search, UserRound } from 'lucide-react';
import VoletAnnonceFlottant from '@/components/dashboard/annonces/VoletAnnonceFlottant';
import Select from '@/components/ui/Select';
import { pastilleClass } from '@/components/ui/pastille-classes';
import { adresseVerifiee, secteursAProspecter } from '@/lib/annonces/liste-prospection';
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

function dateGroupe(g: GroupeAnnonce): string {
  return g.annonces.reduce((m, a) => {
    const d = a.publieeLe ?? a.premiereVueLe ?? '';
    return d > m ? d : m;
  }, '');
}

function trierGroupes(groupes: GroupeAnnonce[], tri: Tri): GroupeAnnonce[] {
  if (tri === 'baisse') {
    return [...groupes].sort((x, y) => (baisseCumulee(y.principale) ?? 0) - (baisseCumulee(x.principale) ?? 0));
  }
  if (tri === 'm2') {
    return [...groupes].sort((x, y) => (prixM2(x.principale) ?? Infinity) - (prixM2(y.principale) ?? Infinity));
  }
  return [...groupes].sort((x, y) => dateGroupe(y).localeCompare(dateGroupe(x)));
}

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
 * La Liste de Prospection : mon secteur, puis le secteur de l'agence. Une
 * pastille par groupe le retire de la liste ou l'y remet. Dans chaque groupe :
 * d'abord l'adresse retrouvée, puis la rue ou le quartier.
 */
export default function AnnoncesListe({
  annonces,
  zones,
  profileId,
  directeur,
  initialAnnonceId,
}: {
  annonces: readonly Annonce[];
  zones: readonly Zone[];
  profileId: string;
  directeur: boolean;
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
      let g = groupes.filter((x) => !enBaisse || baisseCumulee(x.principale) != null);
      if (cherche) g = g.filter((x) => annonceCorrespond(x, cherche));
      return trierGroupes(g, tri);
    };
    const duGroupe = (mien: boolean) => {
      const source = secteurs.filter((s) => s.mien === mien);
      if (source.length === 0) return null;
      const visibles = source.filter((s) => !retires.has(s.zone.id));
      if (visibles.length === 0) return null;
      const groupes = preparer(visibles.flatMap((s) => s.groupes));
      if (cherche && groupes.length === 0) return null;
      return {
        mien,
        ids: source.map((s) => s.zone.id),
        couleur: source[0]!.zone.couleur,
        groupes,
      };
    };
    return { mien: duGroupe(true), agence: duGroupe(false) };
  }, [secteurs, retires, enBaisse, tri, recherche]);

  const basculerGroupe = (ids: readonly string[]) => {
    const tousRetires = ids.every((id) => retires.has(id));
    ecrireRetires(
      tousRetires ? [...retires].filter((id) => !ids.includes(id)) : [...new Set([...retires, ...ids])],
    );
  };

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

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0">
          <Search
            size={16}
            strokeWidth={2.2}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une annonce"
            aria-label="Rechercher une annonce"
            className="w-[min(100%,18rem)] rounded-full border border-black/[0.10] bg-white py-2 pl-10 pr-4 text-[13.5px] font-medium text-text-strong shadow-clay-sm outline-none placeholder:font-medium placeholder:text-text-muted hover:border-black/[0.14] focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
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

      {secteurs.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {miens.length > 0 ? (
            <PastilleGroupe
              label="Mes secteurs"
              couleur={miens[0]!.zone.couleur}
              ids={miens.map((s) => s.zone.id)}
              total={miens.reduce((n, s) => n + s.groupes.length, 0)}
              retires={retires}
              onBasculer={basculerGroupe}
            />
          ) : null}
          {autres.length > 0 ? (
            <PastilleGroupe
              label="Les secteurs de toute l’agence"
              couleur={autres[0]!.zone.couleur}
              ids={autres.map((s) => s.zone.id)}
              total={autres.reduce((n, s) => n + s.groupes.length, 0)}
              retires={retires}
              onBasculer={basculerGroupe}
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
        {affiches.mien ? (
          <ListeGroupe
            titre="Mes secteurs"
            couleur={affiches.mien.couleur}
            mien
            groupes={affiches.mien.groupes}
            vide={
              enBaisse
                ? 'Aucune annonce en baisse dans mes secteurs pour l’instant.'
                : 'Aucune annonce de particulier dans mes secteurs pour l’instant. Le relevé passe chaque nuit.'
            }
            ouverte={ouverte}
            onOuvrir={setOuverte}
          />
        ) : null}
        {affiches.agence ? (
          <ListeGroupe
            titre="Les secteurs de toute l’agence"
            couleur={affiches.agence.couleur}
            mien={false}
            groupes={affiches.agence.groupes}
            vide={
              enBaisse
                ? 'Aucune annonce en baisse sur les secteurs de toute l’agence pour l’instant.'
                : 'Aucune annonce de particulier sur les secteurs de toute l’agence pour l’instant. Le relevé passe chaque nuit.'
            }
            ouverte={ouverte}
            onOuvrir={setOuverte}
          />
        ) : null}
        {recherche.trim() && !affiches.mien && !affiches.agence && secteurs.some((s) => !retires.has(s.zone.id)) ? (
          <p className="px-4 py-5 text-[13px] leading-snug text-text-muted md:px-6">
            Aucune annonce ne correspond à cette recherche.
          </p>
        ) : null}
        {secteurs.length > 0 && !affiches.mien && !affiches.agence && !recherche.trim() ? (
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
        <VoletAnnonceFlottant annonce={selection.annonce} soeurs={selection.soeurs} onFermer={fermer} />
      ) : null}
    </div>
  );
}

/** Une pastille par groupe : allumée, il est dans la liste ; éteinte, il en est retiré. */
function PastilleGroupe({
  label,
  couleur,
  ids,
  total,
  retires,
  onBasculer,
}: {
  label: string;
  couleur: string;
  ids: readonly string[];
  total: number;
  retires: ReadonlySet<string>;
  onBasculer: (ids: readonly string[]) => void;
}) {
  const affiche = ids.some((id) => !retires.has(id));
  return (
    <button
      type="button"
      aria-pressed={affiche}
      onClick={() => onBasculer(ids)}
      title={`${label} — ${affiche ? 'retirer de la liste' : 'remettre dans la liste'}`}
      className={`${pastilleClass(affiche)} inline-flex min-w-0 max-w-full items-center gap-1.5 ${
        affiche ? '' : 'bg-surface-2 line-through decoration-1'
      }`}
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: couleur }} />
      <span className="truncate">{label}</span>
      <span className={`tabular-nums ${affiche ? 'text-white/75' : ''}`}>{total}</span>
    </button>
  );
}

function ListeGroupe({
  titre,
  couleur,
  mien,
  groupes,
  vide,
  ouverte,
  onOuvrir,
}: {
  titre: string;
  couleur: string;
  mien: boolean;
  groupes: readonly GroupeAnnonce[];
  vide: string;
  ouverte: string | null;
  onOuvrir: (id: string) => void;
}) {
  const verifiees = groupes.filter((g) => adresseVerifiee(g.principale));
  const aConfirmer = groupes.filter((g) => !adresseVerifiee(g.principale));
  return (
    <section className="border-t border-black/[0.06] first:border-t-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <h2 className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-text-strong">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: couleur }} />
          <span className="truncate">{titre}</span>
          {mien ? (
            <UserRound size={14} strokeWidth={2.2} aria-label="à moi" className="shrink-0 text-accent-dark" />
          ) : null}
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

