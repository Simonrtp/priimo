'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import SourceBadges from '@/components/estimation/SourceBadges';
import ValeurCentrale from '@/components/estimation/parts/ValeurCentrale';
import DetailCalcul from '@/components/estimation/parts/DetailCalcul';
import type { EstimationSourceId } from '@/lib/estimation/sources';
import { normalizeEstimationSources, sourcesFromContext } from '@/lib/estimation/sources';
import type { CorrectionLine } from '@/lib/estimation/corrections';

type AgentAdjustment = {
  pct: number;
  justification: string | null;
  marketValue: number | null;
  agentValue: number | null;
};

type AvisPayload = {
  address: string;
  postalCode: string | null;
  city: string | null;
  available: boolean;
  value: number | null;
  reliability: number;
  low: number | null;
  high: number | null;
  pricePerM2: number | null;
  reliabilityLabel: string | null;
  comparables: Array<{
    date: string;
    surfaceM2: number | null;
    price: number | null;
    pricePerM2Adjusted: number | null;
    voie: string | null;
    sameBuilding: boolean;
  }>;
  context: Record<string, unknown>;
  sources?: EstimationSourceId[];
  agencyName: string;
  agencyPhone: string | null;
  agencyEmail: string | null;
  negotiatorName: string | null;
  error?: string;
};

function formatEuro(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function readNumber(context: Record<string, unknown>, key: string): number | null {
  const value = context[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readAgent(context: Record<string, unknown>): AgentAdjustment | null {
  const raw = context.agentAdjustment;
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const pct = typeof a.pct === 'number' ? a.pct : Number(a.pct);
  if (!Number.isFinite(pct) || pct === 0) return null;
  return {
    pct,
    justification: typeof a.justification === 'string' ? a.justification : null,
    marketValue: typeof a.marketValue === 'number' ? a.marketValue : null,
    agentValue: typeof a.agentValue === 'number' ? a.agentValue : null,
  };
}

function readCorrections(context: Record<string, unknown>): CorrectionLine[] {
  const raw = context.corrections;
  if (!Array.isArray(raw)) return [];
  return raw as CorrectionLine[];
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(t);
}

export default function AvisPublicPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<AvisPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.token;
    if (!token) return;
    void fetch(`/api/avis/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = (await res.json()) as AvisPayload & { error?: string };
        if (!res.ok) {
          setError(json.error ?? 'Lien indisponible');
          return;
        }
        setData(json);
      })
      .catch(() => setError('Lien indisponible'));
  }, [params.token]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
        <p className="text-[16px] font-medium text-ink">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
        <p className="text-[14px] text-mute">Chargement de l’avis…</p>
      </main>
    );
  }

  const sources = normalizeEstimationSources(
    data.sources?.length ? data.sources : sourcesFromContext(data.context),
  );
  const context = (data.context ?? {}) as Record<string, unknown>;
  const agent = readAgent(context);
  const corrections = readCorrections(context);
  const marketValue = agent?.marketValue ?? data.value;
  const agentValue = agent?.agentValue ?? null;

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 py-10">
      <header className="mb-8 border-b border-black/[0.06] pb-6">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-text-subtle">
          {data.agencyName}
        </p>
        {data.negotiatorName ? (
          <p className="mt-1 text-[14px] text-ink">{data.negotiatorName}</p>
        ) : null}
        {(data.agencyPhone || data.agencyEmail) && (
          <p className="mt-1 text-[13px] text-text-muted">
            {[data.agencyPhone, data.agencyEmail].filter(Boolean).join(' · ')}
          </p>
        )}
      </header>

      <p className="text-[13px] text-text-muted">Avis de valeur</p>
      <h1 className="mt-1 text-pretty font-semibold text-ink" style={{ fontSize: 20 }}>
        {data.city ? `${data.city}${data.postalCode ? ` (${data.postalCode})` : ''}` : data.address}
      </h1>

      <div className="mt-5" style={{ '--est-accent': '#E8743C' } as React.CSSProperties}>
        <ValeurCentrale
          value={data.available ? data.value : null}
          low={data.low}
          high={data.high}
          pricePerM2={data.pricePerM2}
          dispersionElevee={context.dispersionElevee === true}
          reliability={data.reliability}
          summary={{
            comparables: readNumber(context, 'quartierVentes') ?? data.comparables.length,
            radiusM: readNumber(context, 'radiusM') ?? 200,
            trimestre:
              typeof context.trimestreLabel === 'string' ? context.trimestreLabel : null,
            immeubleVentes: readNumber(context, 'immeubleVentes') ?? 0,
          }}
        />
      </div>

      {agent && marketValue != null && agentValue != null ? (
        <p className="mt-4 text-pretty text-[14px] leading-relaxed text-ink">
          Valeur de marché calculée : {formatEuro(marketValue)}. Avis du négociateur :{' '}
          <span className="font-semibold">{formatEuro(agentValue)}</span>
          {agent.justification ? ` — ${agent.justification}` : ''}.
        </p>
      ) : null}

      {typeof context.degradationLabel === 'string' && context.degradationLabel ? (
        <p className="mt-3 text-pretty text-[12.5px] text-text-muted">{context.degradationLabel}</p>
      ) : null}

      <SourceBadges sources={sources} className="mt-6" />

      {corrections.length > 0 ? (
        <div className="mt-6">
          <DetailCalcul lines={corrections} low={data.low} high={data.high} />
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="text-[14px] font-semibold text-ink">Ventes comparables (anonymisées)</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {data.comparables.slice(0, 12).map((c, i) => (
            <li
              key={`${c.date}-${i}`}
              className="rounded-xl border border-black/[0.06] bg-white px-3.5 py-2.5 text-[13px]"
            >
              <p className="font-medium text-ink">
                {c.sameBuilding ? 'Même immeuble' : c.voie ?? 'Secteur'}
              </p>
              <p className="mt-0.5 tabular-nums text-text-muted">
                {formatDate(c.date)}
                {c.surfaceM2 != null ? ` · ${c.surfaceM2} m²` : ''}
                {c.price != null ? ` · ${formatEuro(c.price)}` : ''}
                {c.pricePerM2Adjusted != null
                  ? ` · ${c.pricePerM2Adjusted.toLocaleString('fr-FR')} €/m²`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-pretty text-[12px] leading-relaxed text-text-subtle">
        Avis de valeur à titre indicatif — ne constitue pas une expertise immobilière au sens de la
        réglementation. Adresses exactes des biens comparables non communiquées.
      </p>
    </main>
  );
}
