'use client';

import { useEffect, useMemo, useState } from 'react';
import { Marker, useMap } from 'react-map-gl';
import { ArrowDown } from 'lucide-react';
import Switch from '@/components/ui/Switch';
import { coucheAnnoncesActive, type MapLayerState } from '@/lib/carte/layers';
import { isUsableCoord } from '@/lib/carte/coords';
import { bilanAnnonces, filtrerAnnonces, JOURS_NOUVELLE } from '@/lib/annonces/filtrer';
import { baisseCumulee, couleurGroupe, eurosCourt, joursEnLigne, regrouperAnnonces, repereApproximatif } from '@/lib/annonces/presenter';
import { useAnnoncesAjoutees, useAnnoncesSecteur } from '@/lib/annonces/useAnnoncesSecteur';
import type { Annonce, GroupeAnnonce } from '@/lib/annonces/types';
import type { Zone } from '@/lib/zones/types';
import ImportAnnonce from './ImportAnnonce';
import PointImport from './PointImport';
import { useAnnonceImportee } from '@/lib/annonces/import/store';

type Qui = {
  zones: readonly Zone[];
  directeur: boolean;
  profileId: string;
  /** Secteur cadré par le bouton « Secteur » en haut du panneau. */
  zoneCadree?: Zone | null;
  /** Directeur : tous les secteurs affichés ensemble. */
  zonesCadrees?: readonly Zone[] | null;
};

export function AnnoncesLayerControls({
  layers,
  onChange,
  compact = false,
  qui,
}: {
  layers: MapLayerState;
  onChange: (patch: Partial<MapLayerState>) => void;
  compact?: boolean;
  /** Pour compter comme la carte (« Mon secteur »). */
  qui?: Qui;
}) {
  const actif = coucheAnnoncesActive(layers);
  const { annonces, pret } = useAnnoncesSecteur(actif);
  const zones = qui?.zones;
  const directeur = qui?.directeur ?? false;
  const profileId = qui?.profileId ?? '';
  const zoneCadree = qui?.zoneCadree ?? null;
  const zonesCadrees = qui?.zonesCadrees ?? null;
  const bilan = useMemo(
    () => bilanAnnonces(annonces, layers, zones ?? [], { directeur, profileId, zoneCadree, zonesCadrees }),
    [annonces, layers, zones, directeur, profileId, zoneCadree, zonesCadrees],
  );
  const textSize = compact ? 'text-[14.5px]' : 'text-[13.5px]';

  return (
    <li className="rounded-[14px] bg-[#E6E8EB]/90">
      <div className={`flex flex-col gap-2.5 ${compact ? 'px-1 py-2' : 'px-2.5 py-2.5'}`}>
        <p className={`${textSize} font-medium text-text-strong`}>Annonces</p>
        <ImportAnnonce compact={compact} onAfficher={() => onChange({ annonces: true })} />
        <div className="flex items-center justify-between gap-3">
          <span className={`${textSize} text-text-strong`}>Sur la carte</span>
          {actif && pret ? (
            <span className="ml-auto tabular-nums text-[12.5px] text-text-subtle">{bilan.surCarte}</span>
          ) : null}
          <Switch
            checked={actif}
            onChange={(next) => onChange({ annonces: next })}
            aria-label={actif ? 'Masquer les annonces' : 'Afficher les annonces'}
          />
        </div>
        {pret && bilan.sansPosition > 0 ? (
          <p className="text-pretty text-[11.5px] text-text-subtle">
            {bilan.sansPosition} annonce{bilan.sansPosition > 1 ? 's' : ''} pas encore localisée
            {bilan.sansPosition > 1 ? 's' : ''} : hors carte pour l’instant.
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** Au-delà, seules les pastilles de la vue sont dessinées (les particuliers d'abord). */
const MAX_PASTILLES = 400;

type Emprise = { ouest: number; sud: number; est: number; nord: number };

function dansEmprise(a: Annonce, e: Emprise | null): boolean {
  if (!e || a.latitude == null || a.longitude == null) return true;
  return a.longitude >= e.ouest && a.longitude <= e.est && a.latitude >= e.sud && a.latitude <= e.nord;
}

function useEmprise(): Emprise | null {
  const { current: map } = useMap();
  const [emprise, setEmprise] = useState<Emprise | null>(null);
  useEffect(() => {
    if (!map) return;
    const carte = map.getMap();
    const lire = () => {
      try {
        const b = carte.getBounds();
        if (!b) return;
        // Une marge d'un quart de vue : pas de pastilles qui surgissent au moindre glissement.
        const dx = (b.getEast() - b.getWest()) / 4;
        const dy = (b.getNorth() - b.getSouth()) / 4;
        setEmprise({ ouest: b.getWest() - dx, est: b.getEast() + dx, sud: b.getSouth() - dy, nord: b.getNorth() + dy });
      } catch {
        /* style pas prêt */
      }
    };
    lire();
    carte.on('moveend', lire);
    return () => {
      carte.off('moveend', lire);
    };
  }, [map]);
  return emprise;
}

function Pastille({
  groupe,
  choisie,
  onClick,
}: {
  groupe: GroupeAnnonce;
  choisie: boolean;
  onClick: () => void;
}) {
  const a = groupe.principale;
  const teinte = couleurGroupe(groupe);
  const [survol, setSurvol] = useState(false);
  const marque = choisie || survol;
  const particulier = a.typeVendeur === 'particulier';
  const retiree = a.statut === 'retiree';
  const baisse = !retiree && baisseCumulee(a) != null;
  const jours = joursEnLigne(a);
  const nouvelle = !retiree && jours != null && jours <= JOURS_NOUVELLE;
  const approx = repereApproximatif(a) || a.confiance === 'incertaine';
  const prix = a.prix != null ? eurosCourt(a.prix) : 'Annonce';
  const libelle = [
    particulier ? 'Particulier' : a.agenceNom || 'Agence',
    prix,
    baisse ? 'prix en baisse' : null,
    nouvelle ? 'nouvelle' : null,
    retiree ? 'retirée' : null,
    approx ? 'emplacement approximatif' : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
      onFocus={() => setSurvol(true)}
      onBlur={() => setSurvol(false)}
      aria-label={libelle}
      aria-pressed={choisie}
      title={libelle}
      className={`relative inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-[16px] shadow-sm transition-transform duration-fluid-subtle hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${
        teinte ? 'ring-1 ring-white/80' : particulier ? 'bg-blue text-white ring-1 ring-white/70' : 'bg-white text-text-strong ring-1 ring-black/10'
      } ${retiree ? 'line-through' : ''}`}
      style={{
        opacity: retiree ? 0.5 : approx ? 0.7 : 1,
        background: teinte ? (marque ? teinte.vive : teinte.douce) : undefined,
        color: teinte ? (marque ? '#fff' : '#1A2A56') : undefined,
      }}
    >
      {baisse ? (
        <ArrowDown
          size={11}
          strokeWidth={2.5}
          aria-hidden
          className={teinte ? '' : particulier ? 'text-accent-light' : 'text-accent'}
        />
      ) : null}
      {prix}
      {nouvelle ? (
        <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-white" />
      ) : null}
    </button>
  );
}

export function AnnoncesMarqueurs({
  layers,
  zones,
  directeur,
  profileId,
  zoneCadree = null,
  zonesCadrees = null,
  onChoisir,
  ouverteId = null,
}: {
  layers: MapLayerState;
  zones: readonly Zone[];
  directeur: boolean;
  profileId: string;
  /** Secteur choisi en haut : seules ses annonces restent. */
  zoneCadree?: Zone | null;
  /** Tous les secteurs du directeur, affichés ensemble. */
  zonesCadrees?: readonly Zone[] | null;
  onChoisir: (annonce: Annonce, soeurs: Annonce[]) => void;
  /** Annonce dont le volet est ouvert : sa pastille reste vive. */
  ouverteId?: string | null;
}) {
  const actif = coucheAnnoncesActive(layers);
  const { annonces } = useAnnoncesSecteur(actif);
  const emprise = useEmprise();
  // Les annonces ajoutées ont leur propre repère (AnnoncesAjoutees), toujours affiché : pas de doublon.
  const ajouteeId = useAnnonceImportee()?.annonceId ?? null;
  const ajoutees = useAnnoncesAjoutees();
  const idsAjoutees = useMemo(
    () => new Set([...ajoutees.map((a) => a.id), ...(ajouteeId ? [ajouteeId] : [])]),
    [ajoutees, ajouteeId],
  );

  const groupes = useMemo(() => {
    if (!actif) return [];
    const tous = regrouperAnnonces(
      filtrerAnnonces(annonces, layers, zones, { directeur, profileId, zoneCadree, zonesCadrees }),
    ).filter((g) => isUsableCoord(g.principale.latitude, g.principale.longitude) && !g.annonces.some((a) => idsAjoutees.has(a.id)));
    const visibles = tous.length > MAX_PASTILLES ? tous.filter((g) => dansEmprise(g.principale, emprise)) : tous;
    // Les particuliers par-dessus les agences, et gardés en priorité.
    return visibles
      .sort((x, y) => Number(x.principale.typeVendeur === 'particulier') - Number(y.principale.typeVendeur === 'particulier'))
      .slice(-MAX_PASTILLES);
  }, [actif, annonces, layers, zones, directeur, profileId, zoneCadree, zonesCadrees, emprise, idsAjoutees]);

  const ouvrirAjoutee = (id: string) => {
    const g = regrouperAnnonces([...annonces, ...ajoutees]).find((x) => x.annonces.some((a) => a.id === id));
    if (g) onChoisir(g.principale, g.annonces);
  };

  if (!actif) return <PointImport onOuvrir={ouvrirAjoutee} />;
  return (
    <>
      <PointImport onOuvrir={ouvrirAjoutee} />
      {groupes.map((g) => (
        <Marker
          key={g.cle}
          longitude={g.principale.longitude!}
          latitude={g.principale.latitude!}
          anchor="center"
          style={{ zIndex: g.annonces.some((a) => a.id === ouverteId) ? 4 : g.principale.typeVendeur === 'particulier' ? 2 : 1 }}
        >
          <Pastille
            groupe={g}
            choisie={g.annonces.some((a) => a.id === ouverteId)}
            onClick={() => onChoisir(g.principale, g.annonces)}
          />
        </Marker>
      ))}
    </>
  );
}
