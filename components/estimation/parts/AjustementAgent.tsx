'use client';

function formatEuro(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

const JUSTIFICATION_EXAMPLES = [
  'Vue dégagée',
  'Travaux à prévoir',
  'Bien atypique',
] as const;

/**
 * Bloc réservé au professionnel : correction −15 % … +15 % avec justification
 * obligatoire au-delà de 5 %. C’est ce qui distingue un avis de valeur d’un
 * calculateur automatique.
 */
export default function AjustementAgent({
  marketValue,
  pct,
  justification,
  onPctChange,
  onJustificationChange,
}: {
  marketValue: number;
  pct: number;
  justification: string;
  onPctChange: (pct: number) => void;
  onJustificationChange: (text: string) => void;
}) {
  const agentValue = Math.round(marketValue * (1 + pct / 100));
  const needsJustification = Math.abs(pct) > 5;

  return (
    <section className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm print:border-black/20">
      <h3 className="text-[14px] font-semibold text-ink">Avis du négociateur</h3>
      <p className="mt-1 text-pretty text-[12.5px] text-text-muted">
        Ajustez la valeur calculée pour refléter votre lecture du bien. Au-delà de 5 %, une
        justification est requise — elle figure sur le rapport partagé.
      </p>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="agent-adj" className="text-[13px] font-medium text-ink">
            Correction
          </label>
          <span className="tabular-nums text-[13px] font-semibold text-ink">
            {pct > 0 ? '+' : ''}
            {pct} % · {formatEuro(agentValue)}
          </span>
        </div>
        <input
          id="agent-adj"
          type="range"
          min={-15}
          max={15}
          step={1}
          value={pct}
          onChange={(e) => onPctChange(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--est-accent,#E8743C)]"
          aria-valuetext={`${pct} pour cent, soit ${formatEuro(agentValue)}`}
        />
        <div className="mt-1 flex justify-between text-[11px] text-text-subtle">
          <span>−15 %</span>
          <span>0</span>
          <span>+15 %</span>
        </div>
      </div>

      {needsJustification ? (
        <div className="mt-4">
          <label htmlFor="agent-justif" className="mb-1.5 block text-[13px] font-medium text-ink">
            Justification
          </label>
          <input
            id="agent-justif"
            type="text"
            value={justification}
            onChange={(e) => onJustificationChange(e.target.value)}
            placeholder="Ex. vue dégagée, travaux à prévoir…"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            required
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {JUSTIFICATION_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => onJustificationChange(ex)}
                className="rounded-md border border-black/10 bg-white px-2 py-1 text-[12px] text-text-muted hover:bg-black/[0.02] hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-pretty text-[12.5px] text-text-muted">
        Valeur de marché calculée : {formatEuro(marketValue)}. Avis du négociateur :{' '}
        <span className="font-medium text-ink">{formatEuro(agentValue)}</span>
        {needsJustification && justification.trim() ? ` — ${justification.trim()}` : '.'}
      </p>
    </section>
  );
}
