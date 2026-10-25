'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Home, Inbox } from 'lucide-react';
import AnnonceVolet from '@/components/dashboard/annonces/AnnonceVolet';
import {
  aUnSecteur,
  adresseVerifiee,
  annoncesAProspecter,
  type Portee,
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

const ORANGE_DOUX = '#FFE0C4';

const SOUS_TITRE_CLASS =
  'border-t border-black/[0.05] bg-bg-subtle px-4 py-2 text-[9px] uppercase text-mute first:border-t-0 md:px-6';

/**
 * La Liste de Prospection : les annonces de particuliers de mon secteur,
 * relevées chaque nuit. D'abord celles dont l'adresse est retrouvée, puis
 * celles qui ne donnent que la rue ou le quartier.
 */
export default function AnnoncesListe({
  annonces,
  zones,
  profileId,
  initialAnnonceId,
}: {
  annonces: readonly Annonce[];
  zones: readonly Zone[];
  profileId: string;
  initialAnnonceId: string | null;
}) {
  const monSecteur = aUnSecteur(zones, profileId);
  const [portee, setPortee] = useState<Portee>(monSecteur ? 'mien' : 'agence');
  const [enBaisse, setEnBaisse] = useState(false);
  const [tri, setTri] = useState<Tri>('nouveau');
  const [ouverte, setOuverte] = useState<string | null>(initialAnnonceId);

  const groupes = useMemo(() => {
    const g = annoncesAProspecter(annonces, zones, { profileId, portee }).filter(
      (x) => !enBaisse || baisseCumulee(x.principale) != null,
    );
    if (tri === 'baisse') {
      return [...g].sort((x, y) => (baisseCumulee(y.principale) ?? 0) - (baisseCumulee(x.principale) ?? 0));
    }
    if (tri === 'm2') {
      return [...g].sort(
        (x, y) => (prixM2(x.principale) ?? Infinity) - (prixM2(y.principale) ?? Infinity),
      );
    }
    return g;
  }, [annonces, zones, profileId, portee, enBaisse, tri]);

  const verifiees = groupes.filter((g) => adresseVerifiee(g.principale));
  const aConfirmer = groupes.filter((g) => !adresseVerifiee(g.principale));

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

  const lieu = portee === 'mien' ? 'dans mon secteur' : 'dans l’agence';

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold tabular-nums text-ink" style={{ fontSize: 14 }}>
          {groupes.length} annonce{groupes.length !== 1 ? 's' : ''} de particuliers {lieu}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-black/[0.04] p-1" role="group" aria-label="Portée">
            <Pastille actif={portee === 'mien'} onClick={() => setPortee('mien')}>
              Mon secteur
            </Pastille>
            <Pastille actif={portee === 'agence'} onClick={() => setPortee('agence')}>
              Toute l’agence
            </Pastille>
          </div>
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
          <select
            aria-label="Trier"
            value={tri}
            onChange={(e) => setTri(e.target.value as Tri)}
            className="rounded-full bg-black/[0.04] px-3 py-1.5 text-[13px] text-text-strong"
          >
            <option value="nouveau">Les plus récentes</option>
            <option value="baisse">Plus forte baisse</option>
            <option value="m2">Prix au m² le plus bas</option>
          </select>
        </div>
      </div>

      {groupes.length === 0 ? (
        <Vide
          texte={
            portee === 'mien' && !monSecteur
              ? 'Pas encore de secteur à mon nom. Une fois dessiné sur la carte, les annonces de particuliers qui s’y trouvent arrivent ici.'
              : enBaisse
                ? `Aucune annonce en baisse ${lieu} pour l’instant.`
                : `Aucune annonce de particulier ${lieu} pour l’instant. Le relevé passe chaque nuit.`
          }
        />
      ) : (
        <div className="overflow-hidden rounded-clay-lg bg-white shadow-clay">
          {verifiees.length > 0 ? (
            <Section titre="Adresses vérifiées" groupes={verifiees} ouverte={ouverte} onOuvrir={setOuverte} />
          ) : null}
          {aConfirmer.length > 0 ? (
            <Section
              titre="Adresses à confirmer"
              detail="Plusieurs numéros possibles, ou la rue seule : à confirmer sur place."
              groupes={aConfirmer}
              ouverte={ouverte}
              onOuvrir={setOuverte}
            />
          ) : null}
        </div>
      )}

      {selection ? (
        <>
          <div
            role="presentation"
            aria-hidden
            className="fixed inset-x-0 bottom-0 z-40 hidden md:block"
            style={{ top: 'var(--dashboard-topbar-height)', backgroundColor: 'rgba(0,0,0,0.15)' }}
            onClick={fermer}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Annonce"
            className="fixed inset-0 z-[70] flex flex-col bg-black/15 p-3 pt-[max(12px,env(safe-area-inset-top))] md:inset-auto md:bottom-4 md:right-4 md:top-[calc(var(--dashboard-topbar-height)+12px)] md:z-50 md:w-[380px] md:bg-transparent md:p-0"
          >
            <AnnonceVolet annonce={selection.annonce} soeurs={selection.soeurs} onFermer={fermer} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Pastille({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors duration-fluid-subtle ${
        actif ? 'bg-text-strong text-white' : 'text-text-strong hover:bg-black/[0.04]'
      }`}
    >
      {children}
    </button>
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
  const portails = [...new Set(groupe.annonces.map((x) => libellePortail(x.portail)))].join(' · ');
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
        <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-[#F1EFE8] text-text-subtle">
          {photo ? (
            // Photo du portail, servie telle quelle (pas d'optimisation Next pour une image tierce).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <Home size={18} strokeWidth={1.8} aria-hidden />
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

function Vide({ texte }: { texte: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-black/8 bg-white px-4 py-16 text-center sm:px-6 sm:py-20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-soft-gray">
        <Inbox size={28} className="text-mute" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="max-w-md text-mute" style={{ fontSize: 13, lineHeight: 1.55 }}>
        {texte}
      </p>
    </div>
  );
}
