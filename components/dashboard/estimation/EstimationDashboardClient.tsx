'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Calculator,
  ChevronDown,
  ChevronLeft,
  Copy,
  ExternalLink,
  Link2Off,
  Loader2,
} from 'lucide-react';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import type { EstimationStep, ComparableSale } from '@/lib/estimation/dvf-engine';
import type { EstimationSourceId } from '@/lib/estimation/sources';
import { normalizeEstimationSources, sourcesFromContext } from '@/lib/estimation/sources';
import SourceBadges from '@/components/estimation/SourceBadges';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { toast } from 'sonner';

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
  low: number | null;
  high: number | null;
  pricePerM2: number | null;
  reliability: number;
  reliabilityLabel: string;
  comparables: ComparableSale[];
  context: Record<string, unknown>;
  sources: EstimationSourceId[];
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
}: {
  agencyName: string;
  sectorPostcodes?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  const [hints, setHints] = useState<{ ventes: number; coproLots: number | null; dpe: string | null } | null>(null);
  const [liveSteps, setLiveSteps] = useState<EstimationStep[]>([]);
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [comparablesOpen, setComparablesOpen] = useState(false);
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
  const progress = step === 'resultat' ? 100 : Math.round((stepIndex / (STEPS.length - 2)) * 100);

  useEffect(() => {
    if (!banId) {
      setHints(null);
      return;
    }
    const t = window.setTimeout(() => {
      void fetch(`/api/dashboard/estimation/hints?banId=${encodeURIComponent(banId)}`)
        .then((r) => r.json())
        .then((data: { ventes?: number; coproLots?: number | null; dpe?: string | null }) => {
          setHints({
            ventes: data.ventes ?? 0,
            coproLots: data.coproLots ?? null,
            dpe: data.dpe ?? null,
          });
          if (data.dpe && !searchParams.get('dpe')) {
            setParams({ dpe: data.dpe });
          }
        })
        .catch(() => setHints(null));
    }, 120);
    return () => window.clearTimeout(t);
  }, [banId]); // eslint-disable-line react-hooks/exhaustive-deps

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
              low: number | null;
              high: number | null;
              pricePerM2: number | null;
              reliability: number;
              reliabilityLabel: string;
              comparables: ComparableSale[];
              context: Record<string, unknown>;
              sources?: EstimationSourceId[];
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

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 md:px-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold tracking-tight text-ink" style={{ fontSize: 22 }}>
            Estimation
          </h1>
          <p className="mt-1 text-pretty text-mute" style={{ fontSize: 14 }}>
            Avis de valeur à partir des ventes DVF — le vendeur voit d’où vient le chiffre.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="shrink-0 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03]"
        >
          Historique
        </button>
      </header>

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
          <div className="h-1 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
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
          {hints ? (
            <p className="text-[12.5px] text-text-muted">
              {hints.ventes > 0
                ? `${hints.ventes} vente${hints.ventes > 1 ? 's' : ''} connue${hints.ventes > 1 ? 's' : ''} sur cet immeuble`
                : 'Aucune vente connue sur cet immeuble'}
              {hints.coproLots != null ? ` · Copropriété ${hints.coproLots} lots` : ''}
              {hints.dpe ? ` · DPE ${hints.dpe}` : ''}
            </p>
          ) : null}
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
          {hints?.dpe ? (
            <p className="text-[12.5px] text-text-muted">Pré-rempli depuis l’adresse ({hints.dpe}).</p>
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

      {step === 'calcul' ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-ink">
            {computing ? <Loader2 className="size-5 animate-spin text-accent" aria-hidden /> : <Calculator className="size-5 text-accent" aria-hidden />}
            <h2 className="text-[17px] font-semibold text-balance">Calcul en cours</h2>
          </div>
          <ul className="flex flex-col gap-2">
            {liveSteps.map((s) => (
              <li
                key={`${s.id}:${s.label}`}
                className="rounded-clay border border-black/[0.06] bg-surface px-3.5 py-2.5 text-[13.5px] text-ink shadow-clay-sm"
              >
                {s.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

          <div>
            <p className="text-[13px] text-text-muted">{address}</p>
            {result.available && result.low != null && result.high != null ? (
              <>
                <p className="mt-2 font-semibold tracking-tight text-ink tabular-nums" style={{ fontSize: 28 }}>
                  {formatEuro(result.low)} – {formatEuro(result.high)}
                </p>
                {result.pricePerM2 != null ? (
                  <p className="mt-1 text-[15px] tabular-nums text-text-muted">
                    {result.pricePerM2.toLocaleString('fr-FR')} €/m² retenu
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-[16px] font-medium text-ink">
                Pas assez de ventes comparables pour une fourchette.
              </p>
            )}
          </div>

          <p className="text-pretty text-[14px] text-ink">{result.reliabilityLabel}</p>

          <SourceBadges sources={result.sources} />

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
              <p>DPE connu : {result.context.dpeKnown}</p>
            ) : null}
            {typeof result.context.biensEnVenteSecteur === 'number' &&
            result.context.biensEnVenteSecteur > 0 ? (
              <p>{result.context.biensEnVenteSecteur} biens en vente dans le secteur (agence)</p>
            ) : null}
          </div>

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
  );
}
