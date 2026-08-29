'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronDown,
  ChevronLeft,
  Copy,
  ExternalLink,
  Link2Off,
} from 'lucide-react';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import type { EstimationStep, ComparableSale } from '@/lib/estimation/dvf-engine';
import type { EstimationSourceId } from '@/lib/estimation/sources';
import { normalizeEstimationSources, sourcesFromContext } from '@/lib/estimation/sources';
import SourceBadges from '@/components/estimation/SourceBadges';
import Progression from '@/components/estimation/parts/Progression';
import PanneauContexte, {
  type ContextePanneau,
} from '@/components/estimation/parts/PanneauContexte';
import EtapesCalcul from '@/components/estimation/parts/EtapesCalcul';
import Methode from '@/components/estimation/parts/Methode';
import ValeurCentrale from '@/components/estimation/parts/ValeurCentrale';
import DetailCalcul from '@/components/estimation/parts/DetailCalcul';
import AjustementAgent from '@/components/estimation/parts/AjustementAgent';
import SecteurNonCouvert from '@/components/estimation/parts/SecteurNonCouvert';
import { formatEuro as formatEuroFr } from '@/lib/estimation/resultat';
import type { CorrectionLine } from '@/lib/estimation/corrections';
import {
  HINT_OPTIONAL,
  PROGRESS_TOTAL,
  STEP_LABELS,
  allStepsFor,
  progressIndex,
  questionStepsFor,
  type EstimationStepId,
} from '@/lib/estimation/parcours';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { toast } from 'sonner';
import SectionWidget from '@/components/dashboard/settings/SectionWidget';
import EstimationViewSwitch, {
  type EstimationVue,
} from '@/components/dashboard/estimation/EstimationViewSwitch';
import { replaceEstimationVueUrl } from '@/lib/estimation/vue';
import { useUser } from '@/lib/hooks/useUser';
import type { EstimationFeatureKey } from '@/lib/estimation';

const CONDITION_OPTIONS: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: 'À rénover' },
  { value: 2, label: 'Correct' },
  { value: 3, label: 'Bon état' },
  { value: 4, label: 'Excellent' },
];

const DPE_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'inconnu'] as const;
const FLOOR_OPTIONS = ['inconnu', 'RDC', ...Array.from({ length: 15 }, (_, i) => String(i + 1))];

const INPUT_CLASS =
  'w-full rounded-lg border border-black/10 px-4 py-3 text-[16px] tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

type ResultState = {
  id: string;
  shareToken: string | null;
  available: boolean;
  value: number | null;
  low: number | null;
  high: number | null;
  pricePerM2: number | null;
  reliability: number;
  reliabilityLabel: string;
  comparables: ComparableSale[];
  context: Record<string, unknown>;
  sources: EstimationSourceId[];
  steps: EstimationStep[];
  corrections: CorrectionLine[];
};

type BienEnVente = {
  id: string;
  address: string;
  price: number | null;
  surfaceM2: number | null;
  rooms: number | null;
};

type HistoryRow = {
  id: string;
  address: string;
  postal_code: string | null;
  city: string | null;
  price_low: number | null;
  price_high: number | null;
  reliability: number;
  available: boolean;
  share_token: string | null;
  share_expires_at: string | null;
  share_revoked_at: string | null;
  view_count: number;
  created_at: string;
};

function readNumber(context: Record<string, unknown>, key: string): number | null {
  const value = context[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBiensEnVente(context: Record<string, unknown>): BienEnVente[] {
  const raw = context.biensEnVenteDetail;
  if (!Array.isArray(raw)) return [];
  return raw.filter((b): b is BienEnVente => Boolean(b) && typeof b === 'object' && 'id' in b);
}

function readCorrections(context: Record<string, unknown>, fallback: CorrectionLine[]): CorrectionLine[] {
  const raw = context.corrections;
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  return raw as CorrectionLine[];
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(t);
}

function OptionalHint() {
  return <p className="text-[12px] text-text-subtle">{HINT_OPTIONAL}</p>;
}

function TriBool({
  value,
  onChange,
  labels = { yes: 'Oui', no: 'Non', unknown: 'Je ne sais pas' },
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  labels?: { yes: string; no: string; unknown: string };
}) {
  const opts: { v: boolean | null; label: string }[] = [
    { v: true, label: labels.yes },
    { v: false, label: labels.no },
    { v: null, label: labels.unknown },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-lg border px-3 py-2 text-[13.5px] font-medium ${
            value === o.v
              ? 'border-accent bg-accent/5 text-ink'
              : 'border-black/10 bg-white text-ink hover:bg-black/[0.02]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function EstimationDashboardClient({
  agencyName,
  initialVue = 'outil',
}: {
  agencyName: string;
  sectorPostcodes?: string[];
  initialVue?: EstimationVue;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isDirector } = useUser();

  const [vue, setVueState] = useState<EstimationVue>(() =>
    isDirector && initialVue === 'widget' ? 'widget' : 'outil',
  );

  // Pas de sync via navigation Next : on évite le rechargement RSC à chaque onglet.
  const setVue = useCallback((next: EstimationVue) => {
    if (next === 'widget' && !isDirector) return;
    setVueState(next);
    replaceEstimationVueUrl(next);
  }, [isDirector]);

  useEffect(() => {
    if (!isDirector && vue === 'widget') {
      setVueState('outil');
      replaceEstimationVueUrl('outil');
    }
  }, [isDirector, vue]);

  const step = (searchParams.get('step') as EstimationStepId) || 'adresse';
  const address = searchParams.get('address') ?? '';
  const postalCode = searchParams.get('cp') ?? '';
  const city = searchParams.get('city') ?? '';
  const banId = searchParams.get('ban') ?? '';
  const lat = searchParams.get('lat') ?? '';
  const lng = searchParams.get('lng') ?? '';
  const propertyType = (searchParams.get('type') as 'appartement' | 'maison' | '') || '';
  const floor = searchParams.get('floor') ?? '';
  const elevatorParam = searchParams.get('ascenseur');
  const condition = searchParams.get('etat') ?? '';
  const dpe = searchParams.get('dpe') ?? '';

  // Champs saisis en local — jamais de router.replace à chaque frappe.
  const [surfaceLocal, setSurfaceLocal] = useState(searchParams.get('surface') ?? '');
  const [roomsLocal, setRoomsLocal] = useState(searchParams.get('rooms') ?? '');
  const [elevatorLocal, setElevatorLocal] = useState<boolean | null>(
    elevatorParam === '1' ? true : elevatorParam === '0' ? false : null,
  );
  const [duplex, setDuplex] = useState(searchParams.get('duplex') === '1');
  const [cave, setCave] = useState<boolean | null>(
    searchParams.get('cave') === '1' ? true : searchParams.get('cave') === '0' ? false : null,
  );
  const [parking, setParking] = useState<boolean | null>(
    searchParams.get('parking') === '1' ? true : searchParams.get('parking') === '0' ? false : null,
  );
  const [balcon, setBalcon] = useState<boolean | null>(
    searchParams.get('balcon') === '1' ? true : searchParams.get('balcon') === '0' ? false : null,
  );
  const [balconM2, setBalconM2] = useState(searchParams.get('balconM2') ?? '');
  const [charges, setCharges] = useState(searchParams.get('charges') ?? '');
  const [terrainM2, setTerrainM2] = useState(searchParams.get('terrain') ?? '');
  const [niveaux, setNiveaux] = useState(searchParams.get('niveaux') ?? '');
  const [sousSol, setSousSol] = useState<boolean | null>(
    searchParams.get('ss') === '1' ? true : searchParams.get('ss') === '0' ? false : null,
  );
  const [sousSolM2, setSousSolM2] = useState(searchParams.get('ssM2') ?? '');
  const [sousSolAmenage, setSousSolAmenage] = useState(
    searchParams.get('ssAmenage') === '1',
  );
  const [garagePlaces, setGaragePlaces] = useState(searchParams.get('garage') ?? '');
  const [dependances, setDependances] = useState<boolean | null>(
    searchParams.get('dep') === '1' ? true : searchParams.get('dep') === '0' ? false : null,
  );
  const [etatLocal, setEtatLocal] = useState(condition);
  const [dpeLocal, setDpeLocal] = useState(dpe);
  const [floorLocal, setFloorLocal] = useState(floor);

  const [contexte, setContexte] = useState<ContextePanneau | null>(null);
  const [liveSteps, setLiveSteps] = useState<EstimationStep[]>([]);
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [comparablesOpen, setComparablesOpen] = useState(false);
  const [mandatsOpen, setMandatsOpen] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showHistory, setShowHistory] = useState(
    () => searchParams.get('historique') === '1' || Boolean(searchParams.get('id')),
  );
  const [agentPct, setAgentPct] = useState(0);
  const [agentJustification, setAgentJustification] = useState('');
  const [savingAgent, setSavingAgent] = useState(false);

  const hintsAbort = useRef<AbortController | null>(null);
  const hintsKey = useRef<string>('');

  const questionSteps = useMemo(() => questionStepsFor(propertyType), [propertyType]);
  const flowSteps = useMemo(() => allStepsFor(propertyType), [propertyType]);
  const stepIndex = Math.max(0, flowSteps.indexOf(step));
  const progressRang = progressIndex(step);

  const setParams = useCallback(
    (patch: Record<string, string | null>, nextStep?: EstimationStepId) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') p.delete(k);
        else p.set(k, v);
      }
      if (nextStep) p.set('step', nextStep);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Une seule requête de contexte, quand l’adresse est résolue.
  useEffect(() => {
    if (!lat || !lng || !postalCode) {
      setContexte(null);
      hintsKey.current = '';
      return;
    }
    const key = `${banId}|${lat}|${lng}|${postalCode}`;
    if (key === hintsKey.current && contexte?.resolved) return;

    hintsAbort.current?.abort();
    const ctrl = new AbortController();
    hintsAbort.current = ctrl;

    const t = window.setTimeout(() => {
      void fetch('/api/dashboard/estimation/hints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          banId: banId || null,
          latitude: Number(lat),
          longitude: Number(lng),
          postalCode,
          city: city || null,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: ContextePanneau | null) => {
          if (!data || ctrl.signal.aborted) return;
          hintsKey.current = key;
          setContexte(data);
          if (data.dpeKnown && !dpeLocal) setDpeLocal(data.dpeKnown);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setContexte(null);
        });
    }, 400);

    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une fois à l’adresse uniquement
  }, [banId, lat, lng, postalCode]);

  useEffect(() => {
    void fetch('/api/dashboard/estimation')
      .then((r) => r.json())
      .then((data: { estimations?: HistoryRow[] }) => setHistory(data.estimations ?? []))
      .catch(() => undefined);
  }, [result?.id]);

  const goBack = () => {
    const i = flowSteps.indexOf(step);
    if (i <= 0) return;
    setParams({}, flowSteps[i - 1]);
  };

  function buildFeatures(): EstimationFeatureKey[] {
    const f: EstimationFeatureKey[] = [];
    if (parking === true) f.push('parking');
    if (cave === true) f.push('cave');
    if (balcon === true) f.push('balcon_terrasse');
    return f;
  }

  async function runCompute() {
    setComputing(true);
    setLiveSteps([]);
    setResult(null);
    setAgentPct(0);
    setAgentJustification('');
    setParams(
      {
        surface: surfaceLocal || null,
        rooms: roomsLocal || null,
        floor: floorLocal || null,
        ascenseur:
          elevatorLocal === true ? '1' : elevatorLocal === false ? '0' : null,
        etat: etatLocal || null,
        dpe: dpeLocal || null,
      },
      'calcul',
    );

    try {
      const res = await fetch('/api/dashboard/estimation/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          postalCode,
          city: city || null,
          banId: banId || null,
          latitude: Number(lat),
          longitude: Number(lng),
          propertyType,
          surfaceM2: Number(surfaceLocal),
          rooms: Number(roomsLocal),
          floor: floorLocal && floorLocal !== 'inconnu' ? floorLocal : null,
          hasElevator: elevatorLocal,
          conditionRating: etatLocal ? Number(etatLocal) : null,
          dpeClass: dpeLocal || null,
          features: buildFeatures(),
          duplex,
          terrainM2: terrainM2 ? Number(terrainM2) : null,
          niveaux: niveaux ? Number(niveaux) : null,
          sousSol: sousSol === true,
          sousSolM2: sousSolM2 ? Number(sousSolM2) : null,
          sousSolAmenage,
          garagePlaces: garagePlaces ? Number(garagePlaces) : null,
          dependances: dependances === true,
          balconM2: balconM2 ? Number(balconM2) : null,
          chargesMensuelles: charges ? Number(charges) : null,
        }),
      });

      if (!res.ok || !res.body) {
        setParams({}, 'secteur_non_couvert');
        setComputing(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let msg: {
            type: string;
            step?: EstimationStep;
            id?: string;
            shareToken?: string;
            result?: {
              available: boolean;
              value: number | null;
              low: number | null;
              high: number | null;
              pricePerM2: number | null;
              reliability: number;
              reliabilityLabel: string;
              comparables: ComparableSale[];
              context: Record<string, unknown>;
              sources?: EstimationSourceId[];
              steps?: EstimationStep[];
              corrections?: CorrectionLine[];
            };
          };
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          if (msg.type === 'step' && msg.step) {
            setLiveSteps((prev) => [...prev, msg.step!]);
          } else if (msg.type === 'result' && msg.result && msg.id) {
            const ctx = msg.result.context ?? {};
            if (ctx.degradationCode === 'secteur_non_couvert' || !msg.result.available) {
              setResult({
                id: msg.id,
                shareToken: msg.shareToken ?? null,
                ...msg.result,
                sources: [],
                steps: msg.result.steps ?? [],
                corrections: msg.result.corrections ?? [],
              });
              setParams({}, 'secteur_non_couvert');
              continue;
            }
            const sources = normalizeEstimationSources(
              msg.result.sources?.length
                ? msg.result.sources
                : sourcesFromContext(msg.result.context),
            );
            setResult({
              id: msg.id,
              shareToken: msg.shareToken ?? null,
              ...msg.result,
              sources,
              steps: msg.result.steps ?? [],
              corrections: msg.result.corrections ?? readCorrections(ctx, []),
            });
            setParams({}, 'resultat');
          }
        }
      }
    } catch {
      setParams({}, 'secteur_non_couvert');
    } finally {
      setComputing(false);
    }
  }

  const mandats = useMemo(
    () => (result ? readBiensEnVente(result.context) : []),
    [result],
  );

  const shareUrl = useMemo(() => {
    if (!result?.shareToken) return null;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/avis/${result.shareToken}`;
  }, [result?.shareToken]);

  const marketValue = result?.value ?? 0;
  const agentValue = Math.round(marketValue * (1 + agentPct / 100));
  const agentOk = Math.abs(agentPct) <= 5 || agentJustification.trim().length >= 3;

  async function persistAgentAdjustment() {
    if (!result?.id || result.id === 'local' || !result.value) return;
    if (!agentOk) {
      toast.error('Indiquez une justification pour une correction au-delà de 5 %');
      return;
    }
    setSavingAgent(true);
    try {
      const res = await fetch(`/api/dashboard/estimation/${result.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustmentPct: agentPct,
          justification: agentJustification.trim(),
          marketValue: result.value,
          agentValue,
        }),
      });
      if (!res.ok) {
        toast.error('Enregistrement impossible');
        return;
      }
      const data = (await res.json()) as { context?: Record<string, unknown> };
      if (data.context) {
        setResult((r) => (r ? { ...r, context: data.context! } : r));
      }
      toast.success('Avis du négociateur enregistré');
    } finally {
      setSavingAgent(false);
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    void persistAgentAdjustment().then(() => {
      void navigator.clipboard.writeText(shareUrl).then(() => toast.success('Lien copié'));
    });
  }

  function whatsappShare() {
    if (!shareUrl) return;
    void persistAgentAdjustment().then(() => {
      const text = `Avis de valeur — ${address}\n${shareUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    });
  }

  async function revokeShare() {
    if (!result?.id || result.id === 'local') return;
    const res = await fetch(`/api/dashboard/estimation/${result.id}/revoke`, { method: 'POST' });
    if (res.ok) {
      toast.success('Lien révoqué');
      setResult((r) => (r ? { ...r, shareToken: null } : r));
    }
  }

  async function revokeHistoryShare(id: string) {
    const res = await fetch(`/api/dashboard/estimation/${id}/revoke`, { method: 'POST' });
    if (!res.ok) {
      toast.error('Révocation impossible');
      return;
    }
    toast.success('Lien révoqué');
    setHistory((rows) =>
      rows.map((r) =>
        r.id === id ? { ...r, share_revoked_at: new Date().toISOString(), share_token: null } : r,
      ),
    );
    if (result?.id === id) setResult((r) => (r ? { ...r, shareToken: null } : r));
  }

  function printPdf() {
    void persistAgentAdjustment().then(() => window.print());
  }

  function resetAll() {
    setResult(null);
    setLiveSteps([]);
    setContexte(null);
    hintsKey.current = '';
    setSurfaceLocal('');
    setRoomsLocal('');
    setFloorLocal('');
    setElevatorLocal(null);
    setDuplex(false);
    setCave(null);
    setParking(null);
    setBalcon(null);
    setBalconM2('');
    setCharges('');
    setTerrainM2('');
    setNiveaux('');
    setSousSol(null);
    setSousSolM2('');
    setSousSolAmenage(false);
    setGaragePlaces('');
    setDependances(null);
    setEtatLocal('');
    setDpeLocal('');
    setAgentPct(0);
    setAgentJustification('');
    setParams(
      {
        address: null,
        cp: null,
        city: null,
        ban: null,
        lat: null,
        lng: null,
        type: null,
        surface: null,
        rooms: null,
        floor: null,
        ascenseur: null,
        etat: null,
        dpe: null,
        duplex: null,
        cave: null,
        parking: null,
        balcon: null,
        balconM2: null,
        charges: null,
        terrain: null,
        niveaux: null,
        ss: null,
        ssM2: null,
        ssAmenage: null,
        garage: null,
        dep: null,
      },
      'adresse',
    );
  }

  const panneauEtape =
    step === 'adresse' ? 'adresse' : step === 'etat_dpe' ? 'dpe' : 'bien';
  const facadeUrl =
    lat && lng ? `/api/facade/geo?lat=${lat}&lng=${lng}&format=liste` : null;

  const nextAfterSurface = propertyType === 'maison' ? 'niveaux_terrain' : 'etage_ascenseur';
  const nextAfterAnnexes = 'etat_dpe';

  return (
    <div
      className="mx-auto w-full max-w-5xl py-6 md:px-6"
      style={{ '--est-accent': '#E8743C' } as React.CSSProperties}
    >
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-semibold tracking-tight text-ink" style={{ fontSize: 22 }}>
            Estimation
          </h1>
          <p className="mt-1 text-pretty text-mute" style={{ fontSize: 14 }}>
            {vue === 'widget'
              ? 'Intégrez l’estimation sur le site de votre agence et recevez les demandes dans Priimo.'
              : 'Avis de valeur à partir des ventes DVF — le vendeur voit d’où vient le chiffre.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <EstimationViewSwitch value={vue} onChange={setVue} showWidget={isDirector} />
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            disabled={vue !== 'outil'}
            aria-hidden={vue !== 'outil'}
            tabIndex={vue === 'outil' ? 0 : -1}
            className={`rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03] ${
              vue === 'outil' ? '' : 'invisible pointer-events-none'
            }`}
          >
            Historique
          </button>
        </div>
      </header>

      {isDirector ? (
        <div
          className={vue === 'widget' ? '' : 'hidden'}
          aria-hidden={vue !== 'widget'}
        >
          <SectionWidget embedded />
        </div>
      ) : null}

      {vue === 'outil' ? (
        <>
          {showHistory ? (
            <section className="mb-6 rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
              <h2 className="mb-3 text-[14px] font-semibold text-text-strong">Estimations récentes</h2>
              {history.length === 0 ? (
                <p className="text-[13px] text-text-muted">Aucune estimation pour le moment.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {history.map((h) => {
                    const activeShare =
                      h.share_token &&
                      !h.share_revoked_at &&
                      (!h.share_expires_at || Date.parse(h.share_expires_at) > Date.now());
                    const shareHref = activeShare
                      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/avis/${h.share_token}`
                      : null;
                    return (
                      <li
                        key={h.id}
                        className="flex flex-col gap-2 border-b border-black/[0.04] py-2 text-[13px] last:border-0"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{h.address}</p>
                            <p className="text-text-muted">
                              {new Intl.DateTimeFormat('fr-FR').format(Date.parse(h.created_at))}
                              {h.view_count > 0
                                ? ` · ${h.view_count} vue${h.view_count > 1 ? 's' : ''}`
                                : ''}
                            </p>
                          </div>
                          {h.available && h.price_low != null && h.price_high != null ? (
                            <p className="tabular-nums font-medium text-ink">
                              {formatEuro(h.price_low)} – {formatEuro(h.price_high)}
                            </p>
                          ) : (
                            <p className="text-text-muted">Indisponible</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {shareHref ? (
                            <>
                              <a
                                href={shareHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[12.5px] font-medium text-accent hover:underline"
                              >
                                Lien public
                              </a>
                              <button
                                type="button"
                                onClick={() => void revokeHistoryShare(h.id)}
                                className="text-[12.5px] font-medium text-text-muted hover:text-ink"
                              >
                                Révoquer
                              </button>
                            </>
                          ) : (
                            <span className="text-[12.5px] text-text-subtle">Lien inactif</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {step !== 'resultat' &&
          step !== 'calcul' &&
          step !== 'secteur_non_couvert' &&
          questionSteps.includes(step) ? (
            <div className="mb-6">
              <Progression
                index={progressRang}
                total={PROGRESS_TOTAL}
                nom={STEP_LABELS[step]}
                tone="neutral"
              />
              <div className="mt-3 flex items-center gap-2">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-text-muted hover:text-ink"
                  >
                    <ChevronLeft size={16} aria-hidden />
                    Retour
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div
              className="min-w-0"
              style={{ animation: 'fadeIn 0.18s ease-out' }}
              key={step}
            >
              {step === 'adresse' ? (
                <section className="flex flex-col gap-4">
                  <h2 className="text-balance text-[17px] font-semibold text-ink">
                    Quelle est l’adresse du bien ?
                  </h2>
                  <AddressAutocomplete
                    id="est-address"
                    value={address}
                    onChange={(sel: SelectedAddress | null) => {
                      if (!sel) return;
                      hintsKey.current = '';
                      setParams(
                        {
                          address: sel.label,
                          cp: sel.postcode,
                          city: sel.city,
                          ban: sel.id ?? null,
                          lat: String(sel.latitude),
                          lng: String(sel.longitude),
                        },
                        undefined,
                      );
                    }}
                    placeholder="Ex. 12 rue des Maraîchers, Paris"
                  />
                  <WorkspaceButton
                    type="button"
                    disabled={!address || !postalCode || !lat || !lng}
                    onClick={() => setParams({}, 'type')}
                  >
                    Continuer
                  </WorkspaceButton>
                </section>
              ) : null}

              {step === 'type' ? (
                <section className="flex flex-col gap-3">
                  <h2 className="text-balance text-[17px] font-semibold text-ink">Type de bien</h2>
                  {(['appartement', 'maison'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setParams({ type: t }, 'surface_pieces')}
                      className={`rounded-clay border px-4 py-3.5 text-left text-[15px] font-medium ${
                        propertyType === t
                          ? 'border-accent bg-accent/5 text-ink'
                          : 'border-black/10 bg-white text-ink hover:bg-black/[0.02]'
                      }`}
                    >
                      {t === 'appartement' ? 'Appartement' : 'Maison'}
                    </button>
                  ))}
                </section>
              ) : null}

              {step === 'surface_pieces' ? (
                <section className="flex flex-col gap-5">
                  <h2 className="text-balance text-[17px] font-semibold text-ink">
                    {propertyType === 'maison' ? 'Surface et pièces' : 'Surface et pièces'}
                  </h2>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="est-surface" className="text-[13px] font-medium text-ink">
                      Surface habitable (m²)
                    </label>
                    <input
                      id="est-surface"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      className={INPUT_CLASS}
                      value={surfaceLocal}
                      onChange={(e) => setSurfaceLocal(e.target.value.replace(/[^\d]/g, ''))}
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="est-rooms" className="text-[13px] font-medium text-ink">
                      Nombre de pièces
                    </label>
                    <input
                      id="est-rooms"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      className={INPUT_CLASS}
                      value={roomsLocal}
                      onChange={(e) => setRoomsLocal(e.target.value.replace(/[^\d]/g, ''))}
                    />
                  </div>
                  <WorkspaceButton
                    type="button"
                    disabled={!surfaceLocal || Number(surfaceLocal) <= 0 || !roomsLocal || Number(roomsLocal) <= 0}
                    onClick={() =>
                      setParams(
                        { surface: surfaceLocal, rooms: roomsLocal },
                        nextAfterSurface as EstimationStepId,
                      )
                    }
                  >
                    Continuer
                  </WorkspaceButton>
                </section>
              ) : null}

              {step === 'etage_ascenseur' ? (
                <section className="flex flex-col gap-5">
                  <div>
                    <h2 className="text-balance text-[17px] font-semibold text-ink">Étage</h2>
                    <p className="mt-1 text-pretty text-[13px] text-text-muted">
                      L’étage est l’un des critères les plus déterminants du prix.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {FLOOR_OPTIONS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFloorLocal(f)}
                        className={`rounded-lg border px-2 py-2.5 text-[13.5px] font-medium ${
                          floorLocal === f
                            ? 'border-accent bg-accent/5 text-ink'
                            : 'border-black/10 bg-white text-ink hover:bg-black/[0.02]'
                        }`}
                      >
                        {f === 'inconnu' ? 'Je ne sais pas' : f}
                      </button>
                    ))}
                  </div>
                  {!floorLocal || floorLocal === 'inconnu' ? <OptionalHint /> : null}

                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] font-medium text-ink">Ascenseur</p>
                    <TriBool value={elevatorLocal} onChange={setElevatorLocal} />
                    {elevatorLocal == null ? <OptionalHint /> : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] font-medium text-ink">Duplex</p>
                    <TriBool
                      value={duplex ? true : null}
                      onChange={(v) => setDuplex(v === true)}
                      labels={{ yes: 'Oui', no: 'Non', unknown: 'Non renseigné' }}
                    />
                  </div>

                  <WorkspaceButton
                    type="button"
                    onClick={() =>
                      setParams(
                        {
                          floor: floorLocal || 'inconnu',
                          ascenseur:
                            elevatorLocal === true
                              ? '1'
                              : elevatorLocal === false
                                ? '0'
                                : null,
                          duplex: duplex ? '1' : null,
                        },
                        'annexes_appart',
                      )
                    }
                  >
                    Continuer
                  </WorkspaceButton>
                </section>
              ) : null}

              {step === 'annexes_appart' ? (
                <section className="flex flex-col gap-5">
                  <h2 className="text-balance text-[17px] font-semibold text-ink">Annexes</h2>

                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] font-medium text-ink">Cave</p>
                    <TriBool value={cave} onChange={setCave} />
                    {cave == null ? <OptionalHint /> : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] font-medium text-ink">Parking ou garage</p>
                    <TriBool value={parking} onChange={setParking} />
                    {parking == null ? <OptionalHint /> : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] font-medium text-ink">Balcon ou terrasse</p>
                    <TriBool value={balcon} onChange={setBalcon} />
                    {balcon === true ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        placeholder="Surface (m²)"
                        className={INPUT_CLASS}
                        value={balconM2}
                        onChange={(e) => setBalconM2(e.target.value.replace(/[^\d]/g, ''))}
                      />
                    ) : null}
                    {balcon == null ? <OptionalHint /> : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="est-charges" className="text-[13px] font-medium text-ink">
                      Charges mensuelles (€)
                    </label>
                    <input
                      id="est-charges"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className={INPUT_CLASS}
                      value={charges}
                      onChange={(e) => setCharges(e.target.value.replace(/[^\d]/g, ''))}
                    />
                    {!charges ? <OptionalHint /> : null}
                  </div>

                  <WorkspaceButton
                    type="button"
                    onClick={() =>
                      setParams(
                        {
                          cave: cave === true ? '1' : cave === false ? '0' : null,
                          parking: parking === true ? '1' : parking === false ? '0' : null,
                          balcon: balcon === true ? '1' : balcon === false ? '0' : null,
                          balconM2: balconM2 || null,
                          charges: charges || null,
                        },
                        nextAfterAnnexes,
                      )
                    }
                  >
                    Continuer
                  </WorkspaceButton>
                </section>
              ) : null}

              {step === 'niveaux_terrain' ? (
                <section className="flex flex-col gap-5">
                  <h2 className="text-balance text-[17px] font-semibold text-ink">
                    Niveaux et terrain
                  </h2>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="est-terrain" className="text-[13px] font-medium text-ink">
                      Surface du terrain (m²)
                    </label>
                    <input
                      id="est-terrain"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className={INPUT_CLASS}
                      value={terrainM2}
                      onChange={(e) => setTerrainM2(e.target.value.replace(/[^\d]/g, ''))}
                      autoFocus
                    />
                    {!terrainM2 ? <OptionalHint /> : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="est-niveaux" className="text-[13px] font-medium text-ink">
                      Nombre de niveaux
                    </label>
                    <input
                      id="est-niveaux"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      className={INPUT_CLASS}
                      value={niveaux}
                      onChange={(e) => setNiveaux(e.target.value.replace(/[^\d]/g, ''))}
                    />
                    {!niveaux ? <OptionalHint /> : null}
                  </div>
                  <WorkspaceButton
                    type="button"
                    onClick={() =>
                      setParams(
                        { terrain: terrainM2 || null, niveaux: niveaux || null },
                        'annexes_maison',
                      )
                    }
                  >
                    Continuer
                  </WorkspaceButton>
                </section>
              ) : null}

              {step === 'annexes_maison' ? (
                <section className="flex flex-col gap-5">
                  <h2 className="text-balance text-[17px] font-semibold text-ink">Annexes</h2>

                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] font-medium text-ink">Sous-sol</p>
                    <TriBool value={sousSol} onChange={setSousSol} />
                    {sousSol === true ? (
                      <>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          placeholder="Surface du sous-sol (m²)"
                          className={INPUT_CLASS}
                          value={sousSolM2}
                          onChange={(e) => setSousSolM2(e.target.value.replace(/[^\d]/g, ''))}
                        />
                        <label className="flex items-center gap-2 text-[13px] text-ink">
                          <input
                            type="checkbox"
                            checked={sousSolAmenage}
                            onChange={(e) => setSousSolAmenage(e.target.checked)}
                            className="size-4 rounded border-black/20"
                          />
                          Sous-sol aménagé
                        </label>
                      </>
                    ) : null}
                    {sousSol == null ? <OptionalHint /> : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="est-garage" className="text-[13px] font-medium text-ink">
                      Garage — nombre de places
                    </label>
                    <input
                      id="est-garage"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className={INPUT_CLASS}
                      value={garagePlaces}
                      onChange={(e) => setGaragePlaces(e.target.value.replace(/[^\d]/g, ''))}
                    />
                    {!garagePlaces ? <OptionalHint /> : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] font-medium text-ink">Dépendances</p>
                    <TriBool value={dependances} onChange={setDependances} />
                    {dependances == null ? <OptionalHint /> : null}
                  </div>

                  <WorkspaceButton
                    type="button"
                    onClick={() => {
                      if (garagePlaces && Number(garagePlaces) > 0) setParking(true);
                      setParams(
                        {
                          ss: sousSol === true ? '1' : sousSol === false ? '0' : null,
                          ssM2: sousSolM2 || null,
                          ssAmenage: sousSolAmenage ? '1' : null,
                          garage: garagePlaces || null,
                          dep:
                            dependances === true ? '1' : dependances === false ? '0' : null,
                          parking:
                            garagePlaces && Number(garagePlaces) > 0
                              ? '1'
                              : parking === true
                                ? '1'
                                : null,
                        },
                        'etat_dpe',
                      );
                    }}
                  >
                    Continuer
                  </WorkspaceButton>
                </section>
              ) : null}

              {step === 'etat_dpe' ? (
                <section className="flex flex-col gap-5">
                  <h2 className="text-balance text-[17px] font-semibold text-ink">État et DPE</h2>

                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] font-medium text-ink">État général</p>
                    <div className="flex flex-col gap-2">
                      {CONDITION_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setEtatLocal(String(c.value))}
                          className={`rounded-clay border px-4 py-3 text-left text-[15px] font-medium ${
                            etatLocal === String(c.value)
                              ? 'border-accent bg-accent/5 text-ink'
                              : 'border-black/10 bg-white text-ink hover:bg-black/[0.02]'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    {!etatLocal ? <OptionalHint /> : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] font-medium text-ink">Étiquette DPE</p>
                    {contexte?.dpeKnown ? (
                      <p className="text-[12.5px] text-text-muted">
                        Pré-rempli depuis les diagnostics de l’immeuble ({contexte.dpeKnown}).
                      </p>
                    ) : null}
                    <div className="grid grid-cols-4 gap-2">
                      {DPE_OPTIONS.map((letter) => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => setDpeLocal(letter)}
                          className={`rounded-lg border px-2 py-2.5 text-[13.5px] font-medium ${
                            dpeLocal === letter
                              ? 'border-accent bg-accent/5 text-ink'
                              : 'border-black/10 bg-white text-ink hover:bg-black/[0.02]'
                          }`}
                        >
                          {letter === 'inconnu' ? 'Inconnue' : letter}
                        </button>
                      ))}
                    </div>
                    {!dpeLocal || dpeLocal === 'inconnu' ? <OptionalHint /> : null}
                  </div>

                  <WorkspaceButton
                    type="button"
                    onClick={() => void runCompute()}
                  >
                    Calculer l’avis de valeur
                  </WorkspaceButton>
                </section>
              ) : null}

              {step === 'calcul' ? (
                <EtapesCalcul steps={liveSteps} encours={computing} />
              ) : null}

              {step === 'secteur_non_couvert' ? (
                <SecteurNonCouvert
                  postalCode={postalCode}
                  city={city || null}
                  address={address}
                  onRestart={resetAll}
                />
              ) : null}

              {step === 'resultat' && result ? (
                <section className="flex flex-col gap-5 print:gap-4">
                  <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-text-muted hover:text-ink print:hidden"
                  >
                    <ChevronLeft size={16} aria-hidden />
                    Nouvelle estimation
                  </button>

                  <p className="text-[13px] text-text-muted">{address}</p>

                  {typeof result.context.degradationLabel === 'string' &&
                  result.context.degradationLabel ? (
                    <p className="rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-pretty text-[12.5px] text-text-muted">
                      {result.context.degradationLabel}
                    </p>
                  ) : null}

                  <ValeurCentrale
                    value={result.value}
                    low={result.low}
                    high={result.high}
                    pricePerM2={result.pricePerM2}
                    dispersionElevee={result.context.dispersionElevee === true}
                    reliability={result.reliability}
                    summary={{
                      comparables:
                        readNumber(result.context, 'quartierVentes') ?? result.comparables.length,
                      radiusM: readNumber(result.context, 'radiusM') ?? 200,
                      trimestre:
                        typeof result.context.trimestreLabel === 'string'
                          ? result.context.trimestreLabel
                          : null,
                      immeubleVentes: readNumber(result.context, 'immeubleVentes') ?? 0,
                    }}
                  />

                  {result.value != null && agentPct !== 0 ? (
                    <p className="text-pretty text-[14px] text-ink">
                      Valeur de marché calculée : {formatEuro(result.value)}. Avis du négociateur :{' '}
                      <span className="font-semibold">{formatEuro(agentValue)}</span>
                      {Math.abs(agentPct) > 5 && agentJustification.trim()
                        ? ` — ${agentJustification.trim()}`
                        : ''}
                      .
                    </p>
                  ) : null}

                  <SourceBadges sources={result.sources} />

                  {result.corrections.length > 0 ? (
                    <DetailCalcul
                      lines={result.corrections}
                      low={result.low}
                      high={result.high}
                    />
                  ) : null}

                  <div>
                    <button
                      type="button"
                      onClick={() => setComparablesOpen((v) => !v)}
                      className="flex w-full items-center justify-between rounded-clay border border-black/[0.06] bg-surface px-4 py-3 text-left shadow-clay-sm"
                    >
                      <span className="text-[14px] font-semibold text-ink">
                        Ventes comparables ({result.comparables.length})
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-text-muted transition-transform ${comparablesOpen ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </button>
                    {comparablesOpen ? (
                      <div className="mt-2 overflow-x-auto rounded-clay border border-black/[0.06]">
                        <table className="w-full text-left text-[12.5px]">
                          <thead className="border-b border-black/[0.06] text-text-subtle">
                            <tr>
                              <th className="px-3 py-2 font-medium">Date</th>
                              <th className="px-3 py-2 font-medium">Surface</th>
                              <th className="px-3 py-2 font-medium">Prix</th>
                              <th className="px-3 py-2 font-medium">€/m² act.</th>
                              <th className="px-3 py-2 font-medium">Voie</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.comparables.map((c, i) => (
                              <tr key={`${c.date}-${i}`} className="border-b border-black/[0.04]">
                                <td className="px-3 py-2 tabular-nums">{formatDate(c.date)}</td>
                                <td className="px-3 py-2 tabular-nums">
                                  {c.surfaceM2 != null ? `${c.surfaceM2} m²` : '—'}
                                </td>
                                <td className="px-3 py-2 tabular-nums">
                                  {c.price != null ? formatEuro(c.price) : '—'}
                                </td>
                                <td className="px-3 py-2 tabular-nums">
                                  {c.pricePerM2Adjusted != null
                                    ? `${c.pricePerM2Adjusted.toLocaleString('fr-FR')}`
                                    : '—'}
                                </td>
                                <td className="px-3 py-2">
                                  {c.sameBuilding ? 'Même immeuble' : c.voie ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>

                  {result.value != null ? (
                    <div className="flex flex-col gap-3">
                      <AjustementAgent
                        marketValue={result.value}
                        pct={agentPct}
                        justification={agentJustification}
                        onPctChange={setAgentPct}
                        onJustificationChange={setAgentJustification}
                      />
                      {agentPct !== 0 ? (
                        <WorkspaceButton
                          type="button"
                          disabled={!agentOk || savingAgent || result.id === 'local'}
                          onClick={() => void persistAgentAdjustment()}
                        >
                          Enregistrer l’avis
                        </WorkspaceButton>
                      ) : null}
                    </div>
                  ) : null}

                  <Methode steps={result.steps} />

                  {mandats.length > 0 ? (
                    <div className="print:hidden">
                      <button
                        type="button"
                        onClick={() => setMandatsOpen((v) => !v)}
                        aria-expanded={mandatsOpen}
                        className="flex w-full items-center justify-between rounded-clay border border-black/[0.06] bg-surface px-4 py-3 text-left shadow-clay-sm"
                      >
                        <span className="text-[14px] font-semibold text-ink">
                          Vos mandats en cours dans le {postalCode} ({mandats.length})
                        </span>
                        <ChevronDown
                          size={18}
                          className={`text-text-muted transition-transform ${mandatsOpen ? 'rotate-180' : ''}`}
                          aria-hidden
                        />
                      </button>
                      {mandatsOpen ? (
                        <ul className="mt-2 rounded-clay border border-black/[0.06]">
                          {mandats.map((bien) => (
                            <li
                              key={bien.id}
                              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/[0.04] px-4 py-2.5 text-[13px] last:border-0"
                            >
                              <span className="min-w-0 truncate text-ink">{bien.address}</span>
                              <span className="tabular-nums text-text-muted">
                                {[
                                  bien.price != null ? formatEuroFr(bien.price) : null,
                                  bien.surfaceM2 != null ? `${bien.surfaceM2} m²` : null,
                                  bien.rooms != null ? `${bien.rooms} p.` : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="text-pretty text-[12px] text-text-subtle">
                    Avis de valeur à titre indicatif — ne constitue pas une expertise immobilière au
                    sens de la réglementation.
                  </p>

                  <div className="flex flex-col gap-2 print:hidden">
                    <p className="text-[12.5px] font-medium text-text-subtle">{agencyName}</p>
                    <div className="flex flex-wrap gap-2">
                      <WorkspaceButton
                        type="button"
                        onClick={whatsappShare}
                        disabled={!shareUrl || !agentOk}
                      >
                        <span className="inline-flex items-center gap-2">
                          <WhatsAppIcon size={16} />
                          WhatsApp
                        </span>
                      </WorkspaceButton>
                      <button
                        type="button"
                        onClick={copyLink}
                        disabled={!shareUrl || !agentOk}
                        className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03] disabled:opacity-50"
                      >
                        <Copy size={14} aria-hidden />
                        Copier le lien
                      </button>
                      <button
                        type="button"
                        onClick={printPdf}
                        disabled={!agentOk}
                        className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03] disabled:opacity-50"
                      >
                        <ExternalLink size={14} aria-hidden />
                        Export PDF
                      </button>
                      {shareUrl ? (
                        <button
                          type="button"
                          onClick={() => void revokeShare()}
                          className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03]"
                        >
                          <Link2Off size={14} aria-hidden />
                          Révoquer
                        </button>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            {step !== 'resultat' && step !== 'secteur_non_couvert' ? (
              <div className="lg:sticky lg:top-4 lg:self-start">
                <PanneauContexte
                  contexte={contexte}
                  etape={panneauEtape}
                  adresse={address || null}
                  facadeUrl={facadeUrl}
                  propertyType={propertyType}
                />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
