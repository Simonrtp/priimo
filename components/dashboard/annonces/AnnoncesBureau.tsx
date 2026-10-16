'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  badgeAnnonce,
  baisseCumulee,
  dateCourte,
  euros,
  joursEnLigne,
  libelleAdresse,
  libellePortail,
  prixM2,
  bandeauMiseAJour,
  regrouperAnnonces,
} from '@/lib/annonces/presenter';
import { dansMonSecteur } from '@/lib/annonces/secteur';
import type { Annonce, RunAnnonce } from '@/lib/annonces/types';
import type { Zone } from '@/lib/zones/types';
import AnnoncesCarte from './AnnoncesCarte';
import AnnonceVolet from './AnnonceVolet';

export type FiltresAnnonces = {
  secteur: 'mien' | 'agence';
  vendeur: 'particulier' | 'tous';
  statut: 'active' | 'retiree' | 'toutes';
  baisse: boolean;
  nouvelles: boolean;
  dpe: string;
  pieces: string;
  prixMax: string;
  tri: 'baisse' | 'nouveau' | 'm2';
  annonce: string | null;
};

function Fiche({
  annonce,
  portails,
  onOuvrir,
}: {
  annonce: Annonce;
  portails: Annonce[];
  onOuvrir: () => void;
}) {
  const lieu = libelleAdresse(annonce);
  const baisse = baisseCumulee(annonce);
  const badge = badgeAnnonce(annonce);
  const jours = joursEnLigne(annonce);
  return (
    <button
      type="button"
      onClick={onOuvrir}
      className="w-full rounded-clay border border-black/[0.06] bg-surface px-3.5 py-3 text-left"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[16px] font-semibold text-text-strong">
          {annonce.prix != null ? euros(annonce.prix) : 'Prix non indiqué'}
        </p>
        {baisse != null && annonce.prixInitial != null ? (
          <p className="text-[12.5px] text-text-muted">
            <span className="line-through">{euros(annonce.prixInitial)}</span>
            {` −${baisse} %`}
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-[13.5px] text-text-strong">
        {lieu.ligne}
        {lieu.probable ? ' · adresse probable' : ''}
      </p>
      <p className="mt-1 text-[12.5px] text-text-muted">
        {[
          annonce.surface != null ? `${annonce.surface} m²` : null,
          annonce.pieces != null ? `${annonce.pieces} p.` : null,
          annonce.etage ? `ét. ${annonce.etage}` : null,
          annonce.dpe ? `DPE ${annonce.dpe}` : null,
          annonce.quartier,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="mt-1 text-[12.5px] text-text-muted">
        {jours != null ? `En ligne depuis ${jours} jour${jours > 1 ? 's' : ''}` : 'Mise en ligne inconnue'}
        {' · '}
        {portails.map((p) => libellePortail(p.portail)).join(', ')}
      </p>
      {badge?.kind === 'nouvelle' ? <p className="mt-2 text-[12px] font-semibold text-text-strong">Nouvelle</p> : null}
      {badge?.kind === 'baisse' ? (
        <p className="mt-2 text-[12px] font-semibold text-text-strong">Prix en baisse −{badge.pourcent} %</p>
      ) : null}
      {badge?.kind === 'modifiee' ? <p className="mt-2 text-[12px] font-semibold">Modifiée</p> : null}
      {badge?.kind === 'retiree' ? (
        <p className="mt-2 text-[12px] font-semibold text-text-strong">
          Retirée le {badge.le ? dateCourte(badge.le) : '…'}
        </p>
      ) : null}
    </button>
  );
}

export default function AnnoncesBureau({
  annonces,
  runs,
  zones,
  directeur,
  profileId,
  mobile,
  initial,
}: {
  annonces: Annonce[];
  runs: RunAnnonce[];
  zones: Zone[];
  directeur: boolean;
  profileId: string;
  mobile: boolean;
  initial: FiltresAnnonces;
}) {
  const [filtres, setFiltres] = useState(initial);
  const [ouverte, setOuverte] = useState<string | null>(initial.annonce);
  const bandeau = bandeauMiseAJour(runs);

  const groupes = useMemo(() => {
    const filtrees = annonces.filter((a) => {
      if (filtres.vendeur === 'particulier' && a.typeVendeur !== 'particulier') return false;
      if (filtres.statut !== 'toutes' && a.statut !== filtres.statut) return false;
      if (filtres.baisse && baisseCumulee(a) == null) return false;
      if (filtres.nouvelles && badgeAnnonce(a)?.kind !== 'nouvelle') return false;
      if (filtres.dpe && a.dpe !== filtres.dpe) return false;
      if (filtres.pieces && String(a.pieces ?? '') !== filtres.pieces) return false;
      if (filtres.prixMax && (a.prix == null || a.prix > Number(filtres.prixMax))) return false;
      if (filtres.secteur === 'mien' && !dansMonSecteur(a, zones, { directeur, profileId })) return false;
      return true;
    });
    const g = regrouperAnnonces(filtrees);
    g.sort((x, y) => {
      if (filtres.tri === 'm2') return (prixM2(y.principale) ?? 0) - (prixM2(x.principale) ?? 0);
      if (filtres.tri === 'baisse') return (baisseCumulee(y.principale) ?? 0) - (baisseCumulee(x.principale) ?? 0);
      const dx = x.principale.publieeLe ?? x.principale.premiereVueLe ?? '';
      const dy = y.principale.publieeLe ?? y.principale.premiereVueLe ?? '';
      return dy.localeCompare(dx);
    });
    return g;
  }, [annonces, filtres, zones, directeur, profileId]);

  const selection = groupes.find((g) => g.annonces.some((a) => a.id === ouverte)) ?? null;
  const points = groupes.map((g) => g.principale);

  const liste = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div>
        <h1 className="text-[22px] font-semibold text-text-strong">Annonces du secteur</h1>
        <p className="mt-1 text-[13px] text-text-muted">{bandeau.texte}</p>
        {bandeau.alertes.map((a) => (
          <p key={a} className="text-[13px] text-text-strong">
            {a}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Filtre
          actif={filtres.secteur === 'mien'}
          onClick={() => setFiltres((f) => ({ ...f, secteur: f.secteur === 'mien' ? 'agence' : 'mien' }))}
        >
          {filtres.secteur === 'mien' ? 'Mon secteur' : 'Toute l’agence'}
        </Filtre>
        <Filtre
          actif={filtres.vendeur === 'particulier'}
          onClick={() =>
            setFiltres((f) => ({ ...f, vendeur: f.vendeur === 'particulier' ? 'tous' : 'particulier' }))
          }
        >
          {filtres.vendeur === 'particulier' ? 'Particuliers' : 'Tous les vendeurs'}
        </Filtre>
        <Filtre
          actif={filtres.statut === 'retiree'}
          onClick={() =>
            setFiltres((f) => ({ ...f, statut: f.statut === 'active' ? 'retiree' : f.statut === 'retiree' ? 'toutes' : 'active' }))
          }
        >
          {filtres.statut === 'active' ? 'Actives' : filtres.statut === 'retiree' ? 'Retirées' : 'Actives et retirées'}
        </Filtre>
        <Filtre actif={filtres.baisse} onClick={() => setFiltres((f) => ({ ...f, baisse: !f.baisse }))}>
          En baisse
        </Filtre>
        <select
          aria-label="Tri"
          className="rounded-full bg-black/[0.04] px-3 py-1.5 text-[13px]"
          value={filtres.tri}
          onChange={(e) => setFiltres((f) => ({ ...f, tri: e.target.value as FiltresAnnonces['tri'] }))}
        >
          <option value="baisse">Dernière baisse</option>
          <option value="nouveau">Nouveauté</option>
          <option value="m2">Prix au m²</option>
        </select>
        <select
          aria-label="DPE"
          className="rounded-full bg-black/[0.04] px-3 py-1.5 text-[13px]"
          value={filtres.dpe}
          onChange={(e) => setFiltres((f) => ({ ...f, dpe: e.target.value }))}
        >
          <option value="">DPE</option>
          {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Pièces"
          className="rounded-full bg-black/[0.04] px-3 py-1.5 text-[13px]"
          value={filtres.pieces}
          onChange={(e) => setFiltres((f) => ({ ...f, pieces: e.target.value }))}
        >
          <option value="">Pièces</option>
          {['1', '2', '3', '4', '5'].map((n) => (
            <option key={n} value={n}>
              {n} p.
            </option>
          ))}
        </select>
        <input
          aria-label="Prix maximum"
          inputMode="numeric"
          placeholder="Prix max"
          className="w-28 rounded-full bg-black/[0.04] px-3 py-1.5 text-[13px]"
          value={filtres.prixMax}
          onChange={(e) => setFiltres((f) => ({ ...f, prixMax: e.target.value.replace(/\D/g, '') }))}
        />
      </div>
      <div className={`flex flex-col gap-2 ${mobile ? '' : 'min-h-0 flex-1 overflow-y-auto'}`}>
        {groupes.length === 0 ? (
          <p className="text-[13.5px] text-text-muted">Aucune annonce pour ces filtres.</p>
        ) : null}
        {groupes.map((g) => (
          <Fiche
            key={g.cle}
            annonce={g.principale}
            portails={g.annonces}
            onOuvrir={() => setOuverte(g.principale.id)}
          />
        ))}
      </div>
    </div>
  );

  if (mobile) {
    return (
      <div className="flex flex-col gap-3 px-4 pb-28 pt-4">
        {liste}
        {selection ? (
          <AnnonceVolet
            annonce={selection.principale}
            soeurs={selection.annonces}
            onFermer={() => setOuverte(null)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-7.5rem)] grid-cols-[minmax(340px,420px)_1fr] gap-4">
      {liste}
      <div className="relative min-h-0">
        <AnnoncesCarte annonces={points} activeId={ouverte} onChoisir={setOuverte} />
        {selection ? (
          <div className="absolute inset-y-3 right-3 w-[340px]">
            <AnnonceVolet
              annonce={selection.principale}
              soeurs={selection.annonces}
              onFermer={() => setOuverte(null)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Filtre({
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
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
        actif ? 'bg-text-strong text-white' : 'bg-black/[0.04] text-text-strong'
      }`}
    >
      {children}
    </button>
  );
}
