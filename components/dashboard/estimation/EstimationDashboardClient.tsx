'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { formatEuro as formatEuroFr } from '@/lib/estimation/resultat';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { toast } from 'sonner';
import SectionWidget from '@/components/dashboard/settings/SectionWidget';
import EstimationViewSwitch, {
  type EstimationVue,
  estimationHref,
} from '@/components/dashboard/estimation/EstimationViewSwitch';

type StepId =
  | 'adresse'
  | 'type'
  | 'surface'
  | 'pieces'
  | 'etage'
  | 'etat'
  | 'dpe'
  | 'calcul'
  | 'resultat';

const STEPS: StepId[] = ['adresse', 'type', 'surface', 'pieces', 'etage', 'etat', 'dpe', 'calcul', 'resultat'];

/** Les étapes que l'agent doit remplir : « 3 sur 7 » se compte là-dessus. */
const QUESTION_STEPS: StepId[] = ['adresse', 'type', 'surface', 'pieces', 'etage', 'etat', 'dpe'];

const STEP_NAMES: Record<StepId, string> = {
  adresse: 'Adresse',
  type: 'Type de bien',
  surface: 'Surface',
  pieces: 'Pièces',
  etage: 'Étage',
  etat: 'État général',
  dpe: 'Étiquette DPE',
  calcul: 'Calcul',
  resultat: 'Résultat',
};

const CONDITION_OPTIONS: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: 'À rénover' },
  { value: 2, label: 'Correct' },
  { value: 3, label: 'Bon état' },
  { value: 4, label: 'Excellent' },
];

const DPE_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'inconnu'] as const;
const FLOOR_OPTIONS = ['inconnu', 'RDC', ...Array.from({ length: 15 }, (_, i) => String(i + 1))];

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
};

/** Un mandat de l'agence, tel que le moteur le renvoie dans le contexte. */
type BienEnVente = {
  id: string;
  address: string;
  price: number | null;
  surfaceM2: number | null;
  rooms: number | null;
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

export default function EstimationDashboardClient({
  agencyName,
  sectorPostcodes = [],
  initialVue = 'outil',
}: {
  agencyName: string;
  sectorPostcodes?: string[];
  initialVue?: EstimationVue;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [vue, setVueState] = useState<EstimationVue>(initialVue);

  useEffect(() => {
    setVueState(initialVue);
  }, [initialVue]);

  const setVue = useCallback(
    (next: EstimationVue) => {
      setVueState(next);
      const params = new URLSearchParams(window.location.search);
      router.replace(estimationHref(params, next), { scroll: false });
    },
    [router],
  );

  const step = (searchParams.get('step') as StepId) || 'adresse';
  const address = searchParams.get('address') ?? '';
  const postalCode = searchParams.get('cp') ?? '';
  const city = searchParams.get('city') ?? '';
  const banId = searchParams.get('ban') ?? '';
  const lat = searchParams.get('lat') ?? '';
  const lng = searchParams.get('lng') ?? '';
  const propertyType = (searchParams.get('type') as 'appartement' | 'maison' | '') || '';
  const surface = searchParams.get('surface') ?? '';
  const rooms = searchParams.get('rooms') ?? '';
  const floor = searchParams.get('floor') ?? '';
  const condition = searchParams.get('etat') ?? '';
  const dpe = searchParams.get('dpe') ?? '';

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

  const sectorPostcodeFilter = useMemo(
    () => (sectorPostcodes.length === 1 ? sectorPostcodes[0] : undefined),
    [sectorPostcodes],
  );

  const setParams = useCallback(
    (patch: Record<string, string | null>, nextStep?: StepId) => {
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

  const stepIndex = Math.max(0, STEPS.indexOf(step));
  const questionRang = Math.max(1, QUESTION_STEPS.indexOf(step) + 1);

  // Le panneau de contexte ne dit rien tant que l'adresse n'est pas rattachée.
  useEffect(() => {
    if (!lat || !lng || !postalCode) {
      setContexte(null);
      return;
    }
    const t = window.setTimeout(() => {
      void fetch('/api/dashboard/estimation/hints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banId: banId || null,
          latitude: Number(lat),
          longitude: Number(lng),
          postalCode,
          city: city || null,
          propertyType: propertyType || null,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: ContextePanneau | null) => {
          if (!data) return;
          setContexte(data);
          if (data.dpeKnown && !searchParams.get('dpe')) setParams({ dpe: data.dpeKnown });
        })
        .catch(() => setContexte(null));
    }, 120);
    return () => window.clearTimeout(t);
  }, [banId, lat, lng, postalCode, propertyType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetch('/api/dashboard/estimation')
      .then((r) => r.json())
      .then((data: { estimations?: HistoryRow[] }) => setHistory(data.estimations ?? []))
      .catch(() => undefined);
  }, [result?.id]);

  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (i <= 0) return;
    setParams({}, STEPS[i - 1]);
  };

  async function runCompute() {
    setComputing(true);
    setLiveSteps([]);
    setResult(null);
    setParams({}, 'calcul');

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
          surfaceM2: Number(surface),
          rooms: Number(rooms),
          floor: floor || null,
          conditionRating: condition ? Number(condition) : null,
          dpeClass: dpe || null,
        }),
      });

      if (!res.ok || !res.body) {
        toast.error('Calcul impossible');
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
          const msg = JSON.parse(line) as {
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
            };
            error?: string;
          };
          if (msg.type === 'step' && msg.step) {
            setLiveSteps((prev) => [...prev, msg.step!]);
          } else if (msg.type === 'result' && msg.result && msg.id) {
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
            });
            setParams({}, 'resultat');
          } else if (msg.type === 'error') {
            toast.error(msg.error ?? 'Erreur');
          }
        }
      }
    } catch {
      toast.error('Calcul interrompu');
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

  function copyLink() {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl).then(() => toast.success('Lien copié'));
  }

  function whatsappShare() {
    if (!shareUrl) return;
    const text = `Avis de valeur — ${address}\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  async function revokeShare() {
    if (!result?.id) return;
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
    window.print();
  }

  const panneauEtape = step === 'adresse' ? 'adresse' : step === 'dpe' ? 'dpe' : 'bien';
  const facadeUrl =
    lat && lng ? `/api/facade/geo?lat=${lat}&lng=${lng}&format=liste` : null;

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
          <EstimationViewSwitch value={vue} onChange={setVue} />
          {vue === 'outil' ? (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03]"
            >
              Historique
            </button>
          ) : null}
        </div>
      </header>

      {vue === 'widget' ? (
        <SectionWidget embedded />
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

      {step !== 'resultat' && step !== 'calcul' ? (
        <div className="mb-6">
          <Progression
            index={questionRang}
            total={QUESTION_STEPS.length}
            nom={STEP_NAMES[step]}
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
        <div className="min-w-0">

      {step === 'adresse' ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-[17px] font-semibold text-ink text-balance">Quelle est l’adresse du bien ?</h2>
          <AddressAutocomplete
            id="est-address"
            value={address}
            postcodeFilter={sectorPostcodeFilter}
            onChange={(sel: SelectedAddress | null) => {
              if (!sel) return;
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
            placeholder={
              sectorPostcodes.length === 1
                ? `Ex. 12 rue des Maraîchers, ${sectorPostcodes[0]}`
                : 'Ex. 12 rue des Maraîchers, Paris'
            }
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
          <h2 className="text-[17px] font-semibold text-ink text-balance">Type de bien</h2>
          {(['appartement', 'maison'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setParams({ type: t }, 'surface')}
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

      {step === 'surface' ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-[17px] font-semibold text-ink text-balance">Surface habitable (m²)</h2>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="w-full rounded-lg border border-black/10 px-4 py-3 text-[16px] tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            value={surface}
            onChange={(e) => setParams({ surface: e.target.value.replace(/[^\d]/g, '') })}
            autoFocus
          />
          <WorkspaceButton
            type="button"
            disabled={!surface || Number(surface) <= 0}
            onClick={() => setParams({}, 'pieces')}
          >
            Continuer
          </WorkspaceButton>
        </section>
      ) : null}

      {step === 'pieces' ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-[17px] font-semibold text-ink text-balance">Nombre de pièces</h2>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="w-full rounded-lg border border-black/10 px-4 py-3 text-[16px] tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            value={rooms}
            onChange={(e) => setParams({ rooms: e.target.value.replace(/[^\d]/g, '') })}
            autoFocus
          />
          <WorkspaceButton
            type="button"
            disabled={!rooms || Number(rooms) <= 0}
            onClick={() => setParams({}, 'etage')}
          >
            Continuer
          </WorkspaceButton>
        </section>
      ) : null}

      {step === 'etage' ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-semibold text-ink text-balance">Étage</h2>
          <p className="text-[13px] text-text-muted">« Je ne sais pas » n’est pas pénalisant.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {FLOOR_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setParams({ floor: f }, 'etat')}
                className={`rounded-lg border px-2 py-2.5 text-[13.5px] font-medium ${
                  floor === f
                    ? 'border-accent bg-accent/5 text-ink'
                    : 'border-black/10 bg-white text-ink hover:bg-black/[0.02]'
                }`}
              >
                {f === 'inconnu' ? 'Je ne sais pas' : f}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 'etat' ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-semibold text-ink text-balance">État général</h2>
          {CONDITION_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setParams({ etat: String(c.value) }, 'dpe')}
              className={`rounded-clay border px-4 py-3.5 text-left text-[15px] font-medium ${
                condition === String(c.value)
                  ? 'border-accent bg-accent/5 text-ink'
                  : 'border-black/10 bg-white text-ink hover:bg-black/[0.02]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </section>
      ) : null}

      {step === 'dpe' ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-semibold text-ink text-balance">Étiquette DPE</h2>
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
                onClick={() => {
                  setParams({ dpe: letter });
                  void runCompute();
                }}
                className={`rounded-lg border px-2 py-2.5 text-[13.5px] font-medium ${
                  dpe === letter
                    ? 'border-accent bg-accent/5 text-ink'
                    : 'border-black/10 bg-white text-ink hover:bg-black/[0.02]'
                }`}
              >
                {letter === 'inconnu' ? 'Inconnue' : letter}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 'calcul' ? <EtapesCalcul steps={liveSteps} encours={computing} /> : null}

      {step === 'resultat' && result ? (
        <section className="flex flex-col gap-5 print:gap-4">
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setLiveSteps([]);
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
                  etat: null,
                  dpe: null,
                },
                'adresse',
              );
            }}
            className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-text-muted hover:text-ink print:hidden"
          >
            <ChevronLeft size={16} aria-hidden />
            Nouvelle estimation
          </button>

          <p className="text-[13px] text-text-muted">{address}</p>

          <ValeurCentrale
            value={result.value}
            low={result.low}
            high={result.high}
            pricePerM2={result.pricePerM2}
            dispersionElevee={result.context.dispersionElevee === true}
            reliability={result.reliability}
            summary={{
              comparables: readNumber(result.context, 'quartierVentes') ?? result.comparables.length,
              radiusM: readNumber(result.context, 'radiusM') ?? 200,
              trimestre:
                typeof result.context.trimestreLabel === 'string'
                  ? result.context.trimestreLabel
                  : null,
              immeubleVentes: readNumber(result.context, 'immeubleVentes') ?? 0,
            }}
          />

          <SourceBadges sources={result.sources} />

          <Methode steps={result.steps} />

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

          {typeof result.context.coproLots === 'number' ||
          (typeof result.context.dpeKnown === 'string' && result.context.dpeKnown) ? (
            <div className="rounded-clay border border-black/[0.06] bg-surface px-4 py-3 text-[13px] text-text-muted shadow-clay-sm">
              {typeof result.context.coproLots === 'number' ? (
                <p>
                  Copropriété : {result.context.coproLots} lots
                  {typeof result.context.coproPeriode === 'string' && result.context.coproPeriode
                    ? ` · ${result.context.coproPeriode}`
                    : ''}
                </p>
              ) : null}
              {typeof result.context.dpeKnown === 'string' && result.context.dpeKnown ? (
                <p>DPE retenu : {result.context.dpeKnown}</p>
              ) : null}
            </div>
          ) : null}

          {/* Vos mandats en cours dans le même code postal — le suffixe
              « (agence) » ne disait rien : le bloc s'ouvre maintenant sur le
              détail, et disparaît quand il n'y a rien à montrer. */}
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
            Avis de valeur à titre indicatif — ne constitue pas une expertise immobilière au sens de
            la réglementation.
          </p>

          <div className="flex flex-col gap-2 print:hidden">
            <p className="text-[12.5px] font-medium text-text-subtle">{agencyName}</p>
            <div className="flex flex-wrap gap-2">
              <WorkspaceButton type="button" onClick={whatsappShare} disabled={!shareUrl}>
                <span className="inline-flex items-center gap-2">
                  <WhatsAppIcon size={16} />
                  WhatsApp
                </span>
              </WorkspaceButton>
              <button
                type="button"
                onClick={copyLink}
                disabled={!shareUrl}
                className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03] disabled:opacity-50"
              >
                <Copy size={14} aria-hidden />
                Copier le lien
              </button>
              <button
                type="button"
                onClick={printPdf}
                className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03]"
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

        {/* Ce que la base sait déjà : se remplit à mesure des réponses.
            Masqué sur l'écran de résultat, où l'information est reprise en
            détail dans la valeur et la méthode. */}
        {step !== 'resultat' ? (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <PanneauContexte
              contexte={contexte}
              etape={panneauEtape}
              adresse={address || null}
              facadeUrl={facadeUrl}
            />
          </div>
        ) : null}
      </div>
        </>
      ) : null}
    </div>
  );
}
