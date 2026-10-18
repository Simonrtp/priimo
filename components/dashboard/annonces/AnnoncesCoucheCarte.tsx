'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Marker, useMap } from 'react-map-gl';
import { ArrowDown, ChevronDown } from 'lucide-react';
import Switch from '@/components/ui/Switch';
import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';
import {
  coucheAnnoncesActive,
  type AnnoncesStatut,
  type AnnoncesVendeur,
  type MapLayerState,
} from '@/lib/carte/layers';
import { markerBadgeColor } from '@/lib/carte/colors';
import { isUsableCoord } from '@/lib/carte/coords';
import { dpeFillColor } from '@/lib/carte/dpe-public';
import { bilanAnnonces, filtrerAnnonces, JOURS_NOUVELLE } from '@/lib/annonces/filtrer';
import { baisseCumulee, eurosCourt, joursEnLigne, regrouperAnnonces, repereApproximatif } from '@/lib/annonces/presenter';
import { useAnnoncesSecteur } from '@/lib/annonces/useAnnoncesSecteur';
import type { Annonce, GroupeAnnonce } from '@/lib/annonces/types';
import type { Zone } from '@/lib/zones/types';

const VENDEURS: readonly { id: AnnoncesVendeur; label: string }[] = [
  { id: 'particulier', label: 'Particuliers' },
  { id: 'professionnel', label: 'Agences' },
  { id: 'tous', label: 'Tous' },
];

const STATUTS: readonly { id: AnnoncesStatut; label: string }[] = [
  { id: 'actives', label: 'En vente' },
  { id: 'nouvelles', label: 'Nouvelles' },
  { id: 'baisse', label: 'Baisses' },
  { id: 'retirees', label: 'Retirées' },
];

const PIECES: readonly { id: string; label: string }[] = [
  { id: '', label: 'Toutes' },
  { id: '1', label: '1' },
  { id: '2', label: '2' },
  { id: '3', label: '3' },
  { id: '4', label: '4' },
  { id: '5', label: '5+' },
];

const LETTRES_DPE = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

type Qui = {
  zones: readonly Zone[];
  directeur: boolean;
  profileId: string;
  /** Secteur cadré par le bouton « Secteur » en haut du panneau. */
  zoneCadree?: Zone | null;
};

function Choix<T extends string>({
  label,
  value,
  options,
  onChange,
  grille = false,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (id: T) => void;
  /** Deux colonnes : quatre choix ne tiennent pas sur une ligne du panneau bureau. */
  grille?: boolean;
}) {
  const piste = grille
    ? 'grid w-full grid-cols-2 gap-0.5 rounded-clay bg-surface-2 p-1 shadow-clay-inset'
    : `${PASTILLE_TRACK} max-w-full flex-wrap`;
  return (
    <div role="group" aria-label={label} className={piste}>
      {options.map((o) => (
        <button
          key={o.id || 'tous'}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={pastilleClass(o.id === value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Rubrique({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11.5px] font-medium text-text-subtle">{titre}</p>
      {children}
    </div>
  );
}

function filtresActifs(layers: MapLayerState): boolean {
  return Boolean(layers.annoncesDpe || layers.annoncesPieces || layers.annoncesPrixMax);
}

export function AnnoncesLayerControls({
  layers,
  onChange,
  onToggleMenu,
  compact = false,
  qui,
}: {
  layers: MapLayerState;
  onChange: (patch: Partial<MapLayerState>) => void;
  onToggleMenu: () => void;
  compact?: boolean;
  /** Pour compter comme la carte (« Mon secteur »). */
  qui?: Qui;
}) {
  const open = layers.annoncesMenuOpen;
  const actif = coucheAnnoncesActive(layers);
  const { annonces, pret } = useAnnoncesSecteur(actif || open);
  const zones = qui?.zones;
  const directeur = qui?.directeur ?? false;
  const profileId = qui?.profileId ?? '';
  const zoneCadree = qui?.zoneCadree ?? null;
  const bilan = useMemo(
    () => bilanAnnonces(annonces, layers, zones ?? [], { directeur, profileId, zoneCadree }),
    [annonces, layers, zones, directeur, profileId, zoneCadree],
  );
  const row = compact ? 'min-h-[44px] px-1' : 'min-h-[40px] px-2.5 py-1.5';
  const textSize = compact ? 'text-[14.5px]' : 'text-[13.5px]';
  // Toucher un réglage montre la couche : sinon on règle dans le vide.
  const regler = (patch: Partial<MapLayerState>) => onChange({ ...patch, annonces: true });
  const dpeCochees = layers.annoncesDpe;

  return (
    <li className="rounded-[14px] bg-[#E6E8EB]/90">
      <div className={`flex w-full ${row} items-center gap-3 rounded-[14px]`}>
        <Switch
          checked={actif}
          onChange={(next) => onChange({ annonces: next })}
          aria-label={actif ? 'Masquer les annonces' : 'Afficher les annonces'}
        />
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Replier les réglages des annonces' : 'Déplier les réglages des annonces'}
          onClick={onToggleMenu}
          className="-my-1.5 flex min-h-[40px] min-w-0 flex-1 items-center gap-2 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]/40"
        >
          <span className={`min-w-0 flex-1 ${textSize} font-medium ${actif ? 'text-text-strong' : 'text-text-muted'}`}>
            Annonces
          </span>
          {actif && pret ? (
            <span className="tabular-nums text-[12.5px] text-text-subtle">{bilan.surCarte}</span>
          ) : null}
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden
            className={`shrink-0 text-text-subtle transition-transform duration-fluid-subtle ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      <div className={`fluid-collapse ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} aria-hidden={!open}>
        <div>
          <div className={`flex flex-col gap-3 pb-3 ${compact ? 'pl-3 pr-1' : 'pl-6 pr-2.5'} ${actif ? '' : 'opacity-60'}`}>
            <Rubrique titre="Vendeur">
              <Choix
                label="Vendeur"
                value={layers.annoncesVendeur}
                options={VENDEURS}
                onChange={(id) => regler({ annoncesVendeur: id })}
              />
            </Rubrique>
            <Rubrique titre="Statut">
              <Choix
                label="Statut"
                value={layers.annoncesStatut}
                options={STATUTS}
                grille={!compact}
                onChange={(id) => regler({ annoncesStatut: id })}
              />
            </Rubrique>

            <button
              type="button"
              role="switch"
              aria-checked={layers.annoncesMonSecteur}
              onClick={() => regler({ annoncesMonSecteur: !layers.annoncesMonSecteur })}
              className="-mx-0.5 flex min-h-[40px] w-full cursor-pointer items-center gap-3 rounded-xl px-0.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
            >
              <Switch checked={layers.annoncesMonSecteur} />
              <span className="min-w-0 flex-1">
                <span className={`block ${textSize} font-medium ${layers.annoncesMonSecteur ? 'text-text-strong' : 'text-text-muted'}`}>
                  Mon secteur
                </span>
                {pret ? (
                  <span className="block text-[11.5px] text-text-subtle">
                    {bilan.dansMonSecteur} sur {bilan.tousSecteurs} avec ces réglages
                  </span>
                ) : null}
              </span>
            </button>

            <Rubrique titre="DPE">
              <div role="group" aria-label="Classes DPE" className="flex flex-wrap gap-1">
                {LETTRES_DPE.map((l) => {
                  const coche = dpeCochees.includes(l);
                  const fond = dpeFillColor(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={coche}
                      aria-label={`Classe ${l}`}
                      onClick={() =>
                        regler({
                          annoncesDpe: coche
                            ? dpeCochees.replace(l, '')
                            : LETTRES_DPE.filter((x) => x === l || dpeCochees.includes(x)).join(''),
                        })
                      }
                      className={`flex size-7 items-center justify-center rounded-full text-[11.5px] font-bold transition-colors duration-fluid-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${
                        coche ? '' : 'bg-white/70 text-text-muted hover:text-text-strong'
                      }`}
                      style={coche ? { backgroundColor: fond, color: markerBadgeColor(fond) } : undefined}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </Rubrique>

            <Rubrique titre="Pièces">
              <Choix
                label="Pièces"
                value={layers.annoncesPieces}
                options={PIECES}
                onChange={(id) => regler({ annoncesPieces: id })}
              />
            </Rubrique>

            <Rubrique titre="Prix maximum">
              <label className="relative block">
                <input
                  aria-label="Prix maximum"
                  inputMode="numeric"
                  placeholder="Sans limite"
                  className="h-9 w-full rounded-[12px] bg-white px-3 pr-8 text-[12.5px] text-text-strong shadow-clay-inset outline-none placeholder:text-text-subtle focus:ring-2 focus:ring-[#1A2A56]/25"
                  value={layers.annoncesPrixMax ? new Intl.NumberFormat('fr-FR').format(Number(layers.annoncesPrixMax)) : ''}
                  onChange={(e) => regler({ annoncesPrixMax: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                />
                <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12.5px] text-text-subtle">
                  €
                </span>
              </label>
            </Rubrique>

            {pret && (bilan.sansPosition > 0 || filtresActifs(layers)) ? (
              <div className="flex items-start justify-between gap-3">
                {bilan.sansPosition > 0 ? (
                  <p className="text-pretty text-[11.5px] text-text-subtle">
                    {bilan.sansPosition} annonce{bilan.sansPosition > 1 ? 's' : ''} pas encore localisée
                    {bilan.sansPosition > 1 ? 's' : ''} : hors carte pour l’instant.
                  </p>
                ) : (
                  <span />
                )}
                {filtresActifs(layers) ? (
                  <button
                    type="button"
                    onClick={() => onChange({ annoncesDpe: '', annoncesPieces: '', annoncesPrixMax: '' })}
                    className="shrink-0 rounded-lg text-[11.5px] font-semibold text-text-strong underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
                  >
                    Effacer
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
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

function Pastille({ groupe, onClick }: { groupe: GroupeAnnonce; onClick: () => void }) {
  const a = groupe.principale;
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
      aria-label={libelle}
      title={libelle}
      className={`relative inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-[16px] shadow-sm transition-transform duration-fluid-subtle hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${
        particulier ? 'bg-blue text-white ring-1 ring-white/70' : 'bg-white text-text-strong ring-1 ring-black/10'
      } ${retiree ? 'line-through' : ''}`}
      style={{ opacity: retiree ? 0.5 : approx ? 0.7 : 1 }}
    >
      {baisse ? (
        <ArrowDown size={11} strokeWidth={2.5} aria-hidden className={particulier ? 'text-accent-light' : 'text-accent'} />
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
  onChoisir,
}: {
  layers: MapLayerState;
  zones: readonly Zone[];
  directeur: boolean;
  profileId: string;
  /** Secteur choisi en haut : seules ses annonces restent. */
  zoneCadree?: Zone | null;
  onChoisir: (annonce: Annonce, soeurs: Annonce[]) => void;
}) {
  const actif = coucheAnnoncesActive(layers);
  const { annonces } = useAnnoncesSecteur(actif);
  const emprise = useEmprise();

  const groupes = useMemo(() => {
    if (!actif) return [];
    const tous = regrouperAnnonces(
      filtrerAnnonces(annonces, layers, zones, { directeur, profileId, zoneCadree }),
    ).filter((g) => isUsableCoord(g.principale.latitude, g.principale.longitude));
    const visibles = tous.length > MAX_PASTILLES ? tous.filter((g) => dansEmprise(g.principale, emprise)) : tous;
    // Les particuliers par-dessus les agences, et gardés en priorité.
    return visibles
      .sort((x, y) => Number(x.principale.typeVendeur === 'particulier') - Number(y.principale.typeVendeur === 'particulier'))
      .slice(-MAX_PASTILLES);
  }, [actif, annonces, layers, zones, directeur, profileId, zoneCadree, emprise]);

  if (!actif) return null;
  return (
    <>
      {groupes.map((g) => (
        <Marker
          key={g.cle}
          longitude={g.principale.longitude!}
          latitude={g.principale.latitude!}
          anchor="center"
          style={{ zIndex: g.principale.typeVendeur === 'particulier' ? 2 : 1 }}
        >
          <Pastille groupe={g} onClick={() => onChoisir(g.principale, g.annonces)} />
        </Marker>
      ))}
    </>
  );
}
