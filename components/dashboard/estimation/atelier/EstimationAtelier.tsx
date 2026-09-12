'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import type { EstimationObjet } from '@/lib/estimation/objet';
import type { AxeRadar } from '@/lib/estimation/grille';
import { fusionnerGrille } from '@/lib/estimation/grille';
import type { DecompositionValeur } from '@/lib/estimation/valeur';
import OngletClient from './OngletClient';
import OngletBien from './OngletBien';
import OngletCaracteristiques from './OngletCaracteristiques';
import OngletEstimation from './OngletEstimation';
import OngletRapport from './OngletRapport';
import PanneauContexteAtelier, { type ContexteAtelier } from './PanneauContexteAtelier';

function decompositionDepuisContexte(e: EstimationObjet): DecompositionValeur | null {
  const lines = e.context.corrections;
  if (!Array.isArray(lines) || e.priceValue == null) return null;
  const hon = Math.max(0, e.honorairesPct) / 100;
  return {
    methode: 'comparaison',
    lignes: lines as DecompositionValeur['lignes'],
    valeur: e.priceValue,
    low: e.priceLow,
    high: e.priceHigh,
    netVendeur: Math.round((e.priceValue * (1 - hon)) / 100) * 100,
  };
}

function capitalisationDepuisContexte(e: EstimationObjet): DecompositionValeur | null {
  const raw = e.context.capitalisation;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Partial<DecompositionValeur>;
  if (!Array.isArray(o.lignes) || typeof o.valeur !== 'number') return null;
  return o as DecompositionValeur;
}

const ONGLETS = [
  { id: 'client', label: 'Client' },
  { id: 'bien', label: 'Le bien' },
  { id: 'caracteristiques', label: 'Caractéristiques' },
  { id: 'estimation', label: 'Estimation' },
  { id: 'rapport', label: 'Rapport' },
] as const;

type OngletId = (typeof ONGLETS)[number]['id'];

export default function EstimationAtelier({
  initial,
  agencyName,
  members,
  isDirector,
  currentUserId,
  onRetour,
}: {
  initial: EstimationObjet;
  agencyName: string;
  members: AssigneeOption[];
  isDirector: boolean;
  currentUserId: string;
  onRetour: () => void;
}) {
  const [estimation, setEstimation] = useState(initial);
  const [onglet, setOnglet] = useState<OngletId>('bien');
  const [contexte, setContexte] = useState<ContexteAtelier | null>(null);
  const [contexteChargement, setContexteChargement] = useState(false);
  const [radarSecteur, setRadarSecteur] = useState<AxeRadar[]>([]);
  const [parkingMedian, setParkingMedian] = useState<number | null>(null);
  const [decomposition, setDecomposition] = useState<DecompositionValeur | null>(() =>
    decompositionDepuisContexte(initial),
  );
  const [capitalisation, setCapitalisation] = useState<DecompositionValeur | null>(() =>
    capitalisationDepuisContexte(initial),
  );
  const [calculating, setCalculating] = useState(false);
  const [sauve, setSauve] = useState<'ok' | '…' | 'err'>('ok');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch = useCallback((body: Record<string, unknown>) => {
    setEstimation((prev) => ({
      ...prev,
      ...mapLocal(body, prev),
    }));
    setSauve('…');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/dashboard/estimation/${initial.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = (await res.json()) as { estimation?: EstimationObjet; error?: string };
          if (!res.ok || !data.estimation) throw new Error(data.error);
          setEstimation(data.estimation);
          setSauve('ok');
        } catch {
          setSauve('err');
        }
      })();
    }, 450);
  }, [initial.id]);

  useEffect(() => {
    if (estimation.latitude == null || estimation.longitude == null || !estimation.postalCode) {
      setContexte(null);
      return;
    }
    const qs = new URLSearchParams({
      lat: String(estimation.latitude),
      lng: String(estimation.longitude),
      postal: estimation.postalCode,
    });
    if (estimation.banId) qs.set('banId', estimation.banId);
    const ac = new AbortController();
    setContexteChargement(true);
    void fetch(`/api/dashboard/estimation/${estimation.id}/contexte?${qs}`, { signal: ac.signal })
      .then((r) => r.json())
      .then(
        (
          data: ContexteAtelier & {
            radarSecteur?: AxeRadar[];
            parkingMedian?: number | null;
            grille?: EstimationObjet['grille'];
            bien?: EstimationObjet['bien'];
            dpeClass?: string | null;
            surfaceM2?: number | null;
            propertyType?: EstimationObjet['propertyType'];
          },
        ) => {
          setContexte(data);
          setRadarSecteur(data.radarSecteur ?? []);
          setParkingMedian(data.parkingMedian ?? null);
          setEstimation((prev) => ({
            ...prev,
            ...(data.grille ? { grille: fusionnerGrille(prev.grille, data.grille) } : {}),
            ...(data.bien
              ? {
                  bien: {
                    ...data.bien,
                    ...prev.bien,
                    qualiteEmplacement: prev.bien.qualiteEmplacement ?? data.bien.qualiteEmplacement,
                    dpeVersion: prev.bien.dpeVersion ?? data.bien.dpeVersion,
                    ges: prev.bien.ges ?? data.bien.ges,
                  },
                }
              : {}),
            ...(data.dpeClass && !prev.dpeClass ? { dpeClass: data.dpeClass } : {}),
            ...(data.surfaceM2 != null && prev.surfaceM2 == null ? { surfaceM2: data.surfaceM2 } : {}),
            ...(data.propertyType && !prev.propertyType ? { propertyType: data.propertyType } : {}),
          }));
        },
      )
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      })
      .finally(() => {
        if (!ac.signal.aborted) setContexteChargement(false);
      });
    return () => ac.abort();
  }, [estimation.id, estimation.latitude, estimation.longitude, estimation.banId, estimation.postalCode]);

  async function calculer(input: {
    netVendeur: boolean;
    travauxEur: number;
    decoteOccupationEur: number;
    autresEur: number;
    justification: string;
  }) {
    setCalculating(true);
    try {
      const res = await fetch(`/api/dashboard/estimation/${estimation.id}/calculer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as {
        estimation?: EstimationObjet;
        decomposition?: DecompositionValeur;
        capitalisation?: DecompositionValeur | null;
      };
      if (data.estimation) setEstimation(data.estimation);
      if (data.decomposition) setDecomposition(data.decomposition);
      setCapitalisation(data.capitalisation ?? null);
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WorkspaceButton type="button" variant="secondary" onClick={onRetour}>
          Toutes les estimations
        </WorkspaceButton>
        {sauve !== 'ok' ? (
          <p className="text-[12.5px] text-text-muted" aria-live="polite">
            {sauve === '…' ? 'Enregistrement…' : 'Non enregistré'}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-black/[0.06] pb-2" role="tablist" aria-label="Atelier">
        {ONGLETS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={onglet === t.id}
            onClick={() => setOnglet(t.id)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
              onglet === t.id ? 'bg-text-strong text-white' : 'text-text-muted hover:bg-black/[0.04]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div>
          {onglet === 'client' ? (
            <OngletClient
              estimation={estimation}
              members={members}
              isDirector={isDirector}
              currentUserId={currentUserId}
              onPatch={patch}
            />
          ) : null}
          {onglet === 'bien' ? (
            <OngletBien estimation={estimation} parkingMedian={parkingMedian} onPatch={patch} />
          ) : null}
          {onglet === 'caracteristiques' ? (
            <OngletCaracteristiques
              grille={estimation.grille}
              radarSecteur={radarSecteur}
              onChange={(grille) => patch({ grille })}
            />
          ) : null}
          {onglet === 'estimation' ? (
            <OngletEstimation
              estimation={estimation}
              decomposition={decomposition}
              capitalisation={capitalisation}
              calculating={calculating}
              onPatch={patch}
              onCalculer={calculer}
            />
          ) : null}
          {onglet === 'rapport' ? (
            <OngletRapport estimation={estimation} agencyName={agencyName} />
          ) : null}
        </div>
        <PanneauContexteAtelier
          contexte={contexte}
          chargement={contexteChargement}
          couvertureActive={estimation.bien.facadeCouverture}
          onCouverture={() =>
            patch({ bien: { ...estimation.bien, facadeCouverture: !estimation.bien.facadeCouverture } })
          }
        />
      </div>
    </div>
  );
}

function mapLocal(body: Record<string, unknown>, prev: EstimationObjet): Partial<EstimationObjet> {
  const next: Partial<EstimationObjet> = {};
  if ('address' in body) next.address = (body.address as string) ?? null;
  if ('postalCode' in body) next.postalCode = (body.postalCode as string) ?? null;
  if ('city' in body) next.city = (body.city as string) ?? null;
  if ('banId' in body) next.banId = (body.banId as string) ?? null;
  if ('latitude' in body) next.latitude = body.latitude as number;
  if ('longitude' in body) next.longitude = body.longitude as number;
  if ('propertyType' in body) next.propertyType = body.propertyType as EstimationObjet['propertyType'];
  if ('surfaceM2' in body) next.surfaceM2 = body.surfaceM2 as number | null;
  if ('rooms' in body) next.rooms = body.rooms as number | null;
  if ('floor' in body) next.floor = body.floor as string | null;
  if ('dpeClass' in body) next.dpeClass = body.dpeClass as string | null;
  if ('motif' in body) next.motif = body.motif as EstimationObjet['motif'];
  if ('etat' in body) next.etat = body.etat as EstimationObjet['etat'];
  if ('dateValeur' in body) next.dateValeur = body.dateValeur as string | null;
  if ('occupation' in body) next.occupation = body.occupation as EstimationObjet['occupation'];
  if ('loyerAnnuel' in body) next.loyerAnnuel = body.loyerAnnuel as number | null;
  if ('honorairesPct' in body) next.honorairesPct = body.honorairesPct as number;
  if ('commentairesConfidentiels' in body) {
    next.commentairesConfidentiels = body.commentairesConfidentiels as string | null;
  }
  if ('commentairesPublics' in body) next.commentairesPublics = body.commentairesPublics as string | null;
  if ('bien' in body) next.bien = body.bien as EstimationObjet['bien'];
  if ('grille' in body) next.grille = body.grille as EstimationObjet['grille'];
  if ('annexes' in body) next.annexes = body.annexes as EstimationObjet['annexes'];
  if ('pointsForts' in body) next.pointsForts = body.pointsForts as string[];
  if ('pointsFaibles' in body) next.pointsFaibles = body.pointsFaibles as string[];
  if ('photos' in body) next.photos = body.photos as EstimationObjet['photos'];
  if ('contactId' in body) next.contactId = body.contactId as string | null;
  if ('leadId' in body) next.leadId = body.leadId as string | null;
  if ('bienId' in body) next.bienId = body.bienId as string | null;
  if ('referentId' in body) next.referentId = body.referentId as string | null;
  return next;
}
