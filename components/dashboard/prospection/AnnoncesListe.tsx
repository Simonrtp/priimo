'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { Home, Search, UserRound } from 'lucide-react';
import VoletAnnonceFlottant from '@/components/dashboard/annonces/VoletAnnonceFlottant';
import Select from '@/components/ui/Select';
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
type PorteeSecteurListe = 'mien' | 'agence';

const TRIS: { value: Tri; label: string }[] = [
  { value: 'nouveau', label: 'Les plus récentes' },
  { value: 'baisse', label: 'Plus forte baisse' },
  { value: 'm2', label: 'Prix au m² le plus bas' },
];

const PORTEES_SECTEUR: { value: PorteeSecteurListe; label: string }[] = [
  { value: 'mien', label: 'Les annonces de particuliers sur mon secteur' },
  { value: 'agence', label: 'Les annonces de particuliers sur les secteurs de toute l’agence' },
];

const ORANGE_DOUX = '#FFE0C4';
const BLEU_CANARD = '#0F766E';

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

/* -------------------------------------------------------------------- liste */

/**
 * La Liste de Prospection : mes secteurs par défaut, ou les secteurs de l'agence
 * via le menu déroulant. Dans chaque groupe : d'abord l'adresse retrouvée, puis la
 * rue ou le quartier.
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
  const [portee, setPortee] = useState<PorteeSecteurListe>('mien');
  const [ouverte, setOuverte] = useState<string | null>(initialAnnonceId);

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
      const groupes = preparer(source.flatMap((s) => s.groupes));
      if (cherche && groupes.length === 0) return null;
      return {
        mien,
        couleur: source[0]!.zone.couleur,
        groupes,
      };
    };
    return { mien: duGroupe(true), agence: duGroupe(false) };
  }, [secteurs, enBaisse, tri, recherche]);

  const groupeActif = portee === 'mien' ? affiches.mien : affiches.agence;

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
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <label className="relative w-full min-w-0 sm:w-auto">
          <Search
            size={17}
            strokeWidth={2.2}
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une annonce"
            aria-label="Rechercher une annonce"
            className="w-full rounded-full border border-black/[0.10] bg-white py-2.5 pl-11 pr-4 text-[14px] font-medium text-text-strong shadow-clay-sm outline-none placeholder:font-medium placeholder:text-text-muted hover:border-black/[0.14] focus:border-accent/50 focus:ring-2 focus:ring-accent/15 sm:w-[22rem]"
          />
        </label>
        <button
          type="button"
          aria-pressed={enBaisse}
          onClick={() => setEnBaisse((v) => !v)}
          className={`rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors duration-fluid-subtle ${
            enBaisse ? 'bg-text-strong text-white' : 'bg-black/[0.04] text-text-strong hover:bg-black/[0.07]'
          }`}
        >
          En baisse
        </button>
        <Select
          aria-label="Secteurs affichés"
          value={portee}
          onChange={(v) => setPortee(v as PorteeSecteurListe)}
          options={PORTEES_SECTEUR}
          menuMinWidth={320}
          triggerClassName="flex min-w-[9.5rem] items-center justify-between gap-1.5 rounded-full bg-black/[0.04] px-3.5 py-2 text-left text-[13.5px] font-medium text-text-strong outline-none transition-colors duration-fluid-subtle hover:bg-black/[0.07] focus-visible:ring-2 focus-visible:ring-accent/25"
        />
        <Select
          aria-label="Trier"
          value={tri}
          onChange={(v) => setTri(v as Tri)}
          options={TRIS}
          menuMinWidth={240}
          triggerClassName="flex min-w-[9.5rem] items-center justify-between gap-1.5 rounded-full bg-black/[0.04] px-3.5 py-2 text-left text-[13.5px] font-medium text-text-strong outline-none transition-colors duration-fluid-subtle hover:bg-black/[0.07] focus-visible:ring-2 focus-visible:ring-accent/25"
        />
      </div>

      <div key={`${portee}:${enBaisse}:${tri}`} className="carte-entree overflow-hidden rounded-clay-lg bg-white shadow-clay">
        {portee === 'mien' && miens.length === 0 && !directeur ? (
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
        {portee === 'mien' && miens.length === 0 && directeur ? (
          <p className="px-4 py-5 text-[13px] leading-snug text-text-muted md:px-6">
            Pas encore de secteur dessiné à mon nom.
          </p>
        ) : null}
        {portee === 'agence' && autres.length === 0 ? (
          <p className="px-4 py-5 text-[13px] leading-snug text-text-muted md:px-6">
            Aucun autre secteur dessiné dans l’agence pour l’instant.
          </p>
        ) : null}
        {portee === 'mien' && affiches.mien ? (
          <ListeGroupe
            titre="Les annonces de particuliers sur mon secteur"
            couleur={affiches.mien.couleur}
            mien
            groupes={affiches.mien.groupes}
            vide={
              enBaisse
                ? 'Aucune annonce en baisse sur mon secteur pour l’instant.'
                : 'Aucune annonce de particulier sur mon secteur pour l’instant. Le relevé passe chaque nuit.'
            }
            ouverte={ouverte}
            onOuvrir={setOuverte}
          />
        ) : null}
        {portee === 'agence' && affiches.agence ? (
          <ListeGroupe
            titre="Les annonces de particuliers sur les secteurs de toute l’agence"
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
        {recherche.trim() && !groupeActif && (portee === 'mien' ? miens.length > 0 : autres.length > 0) ? (
          <p className="px-4 py-5 text-[13px] leading-snug text-text-muted md:px-6">
            Aucune annonce ne correspond à cette recherche.
          </p>
        ) : null}
      </div>

      {selection ? (
        <VoletAnnonceFlottant annonce={selection.annonce} soeurs={selection.soeurs} onFermer={fermer} />
      ) : null}
    </div>
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
  const nouvelle = jours != null && jours <= 2;
  const signaux = [
    baisse != null ? `Prix −${String(baisse).replace('.', ',')} %` : null,
  ].filter((s): s is string => s != null);

  return (
    <li className="border-t border-black/[0.05]">
      <button
        type="button"
        onClick={onOuvrir}
        aria-current={active || undefined}
        className={`group relative flex w-full overflow-hidden text-left transition-colors duration-fluid-subtle ${
          active ? 'bg-black/[0.03]' : 'hover:bg-black/[0.018]'
        }`}
      >
        {nouvelle ? (
          <span
            className="pointer-events-none absolute right-4 top-0 z-20 inline-flex items-center rounded-b-lg px-2.5 pb-1 pt-0.5 text-[10.5px] font-bold tracking-[0.02em] text-white shadow-sm md:right-6"
            style={{ backgroundColor: BLEU_CANARD }}
          >
            Nouvelle annonce
          </span>
        ) : null}
        {/* Au repos : vignette inset. Au survol : la photo remplit toute la hauteur de la ligne, angles droits. */}
        <span
          className="relative w-[7.25rem] shrink-0 self-stretch transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:w-[9.5rem] motion-reduce:transition-none md:w-32 md:group-hover:w-44"
          aria-hidden={!photo}
        >
          <span className="absolute bottom-3 left-4 right-0 top-3 overflow-hidden bg-[#F1EFE8] text-text-subtle transition-[top,right,bottom,left] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:bottom-0 group-hover:left-0 group-hover:right-0 group-hover:top-0 motion-reduce:transition-none md:bottom-3.5 md:left-6 md:top-3.5 md:group-hover:bottom-0 md:group-hover:left-0 md:group-hover:top-0">
            {photo ? (
              // Photo du portail, servie telle quelle (pas d'optimisation Next pour une image tierce).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center">
                <Home size={28} strokeWidth={1.8} aria-hidden />
              </span>
            )}
          </span>
        </span>
        <span className="relative z-[1] flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 pr-4 md:gap-4 md:py-3.5 md:pl-4 md:pr-6">
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
        </span>
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

