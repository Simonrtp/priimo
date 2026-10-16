'use client';

import { useEffect, useState } from 'react';
import { Marker } from 'react-map-gl';
import { ChevronDown } from 'lucide-react';
import Switch from '@/components/ui/Switch';
import { coucheAnnoncesActive, type MapLayerState } from '@/lib/carte/layers';
import { filtrerAnnonces } from '@/lib/annonces/filtrer';
import { euros, regrouperAnnonces, repereApproximatif } from '@/lib/annonces/presenter';
import type { Annonce } from '@/lib/annonces/types';
import type { Zone } from '@/lib/zones/types';

function Ligne({
  checked,
  label,
  onClick,
  compact,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
  compact: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 text-left ${compact ? 'min-h-[44px]' : 'min-h-[40px]'}`}
    >
      <Switch checked={checked} />
      <span className={`text-[13.5px] font-medium ${checked ? 'text-text-strong' : 'text-text-muted'}`}>{label}</span>
    </button>
  );
}

export function AnnoncesLayerControls({
  layers,
  onChange,
  onToggleMenu,
  compact = false,
}: {
  layers: MapLayerState;
  onChange: (patch: Partial<MapLayerState>) => void;
  onToggleMenu: () => void;
  compact?: boolean;
}) {
  const open = layers.annoncesMenuOpen;
  const folderOn = coucheAnnoncesActive(layers);
  const row = compact ? 'min-h-[44px] px-1' : 'min-h-[40px] px-2.5 py-1.5';

  return (
    <li className="rounded-[14px] bg-[#E6E8EB]/90">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Replier Annonces' : 'Déplier Annonces'}
        onClick={onToggleMenu}
        className={`flex w-full ${row} items-center gap-3 rounded-[14px] text-left hover:bg-[#DDE0E4]`}
      >
        <span className={`min-w-0 flex-1 text-[13.5px] font-medium ${folderOn ? 'text-[#4A5560]' : 'text-text-muted'}`}>
          Annonces
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={`shrink-0 text-text-subtle transition-transform duration-fluid-subtle ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`fluid-collapse ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} aria-hidden={!open}>
        <div>
          <ul className={`mt-0.5 flex flex-col gap-0.5 pb-2 ${compact ? 'pl-3 pr-1' : 'pl-6 pr-2'}`}>
            <li>
              <Ligne compact={compact} checked={layers.annoncesMonSecteur} label="Mon secteur" onClick={() => onChange({ annoncesMonSecteur: !layers.annoncesMonSecteur })} />
            </li>
            <li>
              <Ligne compact={compact} checked={layers.annoncesParticuliers} label="Particuliers" onClick={() => onChange({ annoncesParticuliers: !layers.annoncesParticuliers })} />
            </li>
            <li>
              <Ligne compact={compact} checked={layers.annoncesActives} label="Actives" onClick={() => onChange({ annoncesActives: !layers.annoncesActives })} />
            </li>
            <li>
              <Ligne compact={compact} checked={layers.annoncesRetirees} label="Retirées" onClick={() => onChange({ annoncesRetirees: !layers.annoncesRetirees })} />
            </li>
            <li>
              <Ligne compact={compact} checked={layers.annoncesBaisse} label="En baisse" onClick={() => onChange({ annoncesBaisse: !layers.annoncesBaisse })} />
            </li>
            <li className="mt-1 flex flex-wrap gap-1.5">
              <select
                aria-label="DPE"
                className="rounded-full bg-white px-2.5 py-1.5 text-[12.5px]"
                value={layers.annoncesDpe}
                onChange={(e) => onChange({ annoncesDpe: e.target.value })}
              >
                <option value="">DPE</option>
                {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                aria-label="Pièces"
                className="rounded-full bg-white px-2.5 py-1.5 text-[12.5px]"
                value={layers.annoncesPieces}
                onChange={(e) => onChange({ annoncesPieces: e.target.value })}
              >
                <option value="">Pièces</option>
                {['1', '2', '3', '4', '5'].map((n) => (
                  <option key={n} value={n}>{n} p.</option>
                ))}
              </select>
              <input
                aria-label="Prix maximum"
                inputMode="numeric"
                placeholder="Prix max"
                className="w-24 rounded-full bg-white px-2.5 py-1.5 text-[12.5px]"
                value={layers.annoncesPrixMax}
                onChange={(e) => onChange({ annoncesPrixMax: e.target.value.replace(/\D/g, '') })}
              />
            </li>
          </ul>
        </div>
      </div>
    </li>
  );
}

export function AnnoncesMarqueurs({
  layers,
  zones,
  directeur,
  profileId,
  onChoisir,
}: {
  layers: MapLayerState;
  zones: readonly Zone[];
  directeur: boolean;
  profileId: string;
  onChoisir: (annonce: Annonce, soeurs: Annonce[]) => void;
}) {
  const actif = coucheAnnoncesActive(layers);
  const [annonces, setAnnonces] = useState<Annonce[]>([]);

  useEffect(() => {
    if (!actif) return;
    let ignore = false;
    void fetch('/api/dashboard/annonces')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { annonces?: Annonce[] } | null) => {
        if (!ignore) setAnnonces(json?.annonces ?? []);
      })
      .catch(() => {
        if (!ignore) setAnnonces([]);
      });
    return () => {
      ignore = true;
    };
  }, [actif]);

  if (!actif) return null;
  const groupes = regrouperAnnonces(
    filtrerAnnonces(annonces, layers, zones, { directeur, profileId }),
  );
  return (
    <>
      {groupes.map((g) => {
        const a = g.principale;
        if (a.latitude == null || a.longitude == null) return null;
        const approx = repereApproximatif(a) || a.confiance === 'incertaine';
        return (
          <Marker key={g.cle} longitude={a.longitude} latitude={a.latitude} anchor="center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChoisir(a, g.annonces);
              }}
              className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#1A2A56] shadow-sm ring-1 ring-black/10"
              style={{ opacity: approx ? 0.55 : 1 }}
            >
              {a.prix != null ? euros(a.prix) : 'Annonce'}
            </button>
          </Marker>
        );
      })}
    </>
  );
}
