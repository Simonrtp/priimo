'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { CardEyebrow } from '@/components/dashboard/workspace/WorkspaceCard';
import type { SearchHit } from '@/lib/assistant/search';

export default function AssistantSearchHits({
  hits,
  query,
  onAskAi,
  onClose,
  loadingAi,
}: {
  hits: readonly SearchHit[];
  query: string;
  onAskAi?: () => void;
  onClose?: () => void;
  loadingAi?: boolean;
}) {
  if (hits.length === 0) {
    return (
      <div className="border-b border-black/[0.06] px-4 py-3">
        <p className="text-[13px] text-text-muted">Aucun résultat pour « {query} ».</p>
        {onAskAi ? (
          <button
            type="button"
            onClick={onAskAi}
            disabled={loadingAi}
            className="mt-3 inline-flex min-h-[36px] items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-primary-600 transition-colors hover:bg-primary-50 disabled:opacity-50"
          >
            <Sparkles size={15} strokeWidth={2} aria-hidden />
            Poser la question à l&apos;assistant
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-b border-black/[0.06] px-4 py-3">
      <CardEyebrow>Résultats ({hits.length})</CardEyebrow>
      <ul className="mt-2 flex max-h-[min(42vh,18rem)] flex-col gap-0.5 overflow-y-auto">
        {hits.map((hit) => (
          <li key={`${hit.kind}-${hit.id}`}>
            <Link
              href={hit.href}
              onClick={onClose}
              className="flex w-full min-w-0 items-start justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.04]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{hit.label}</span>
                {hit.snippet ? (
                  <span className="mt-0.5 block truncate text-[12px] text-text-muted">{hit.snippet}</span>
                ) : null}
              </span>
              <span className="shrink-0 pt-0.5 text-[11px] font-medium uppercase text-mute">{hit.subtitle}</span>
            </Link>
          </li>
        ))}
      </ul>
      {onAskAi ? (
        <button
          type="button"
          onClick={onAskAi}
          disabled={loadingAi}
          className="mt-3 inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-lg border border-black/[0.06] bg-surface px-3 py-2 text-[13px] font-semibold text-text transition-colors hover:bg-black/[0.03] disabled:opacity-50"
        >
          <Sparkles size={15} strokeWidth={2} aria-hidden />
          {loadingAi ? 'Analyse en cours…' : 'Poser une question à l\'assistant'}
        </button>
      ) : null}
    </div>
  );
}
