'use client';

import Link from 'next/link';
import { CardEyebrow } from '@/components/dashboard/workspace/WorkspaceCard';
import type { SearchHit } from '@/lib/assistant/search';
import PrimIaIcon from './PrimIaIcon';

/**
 * Résultats de recherche. Le lien « Demander à l'assistant » n'apparaît que
 * lorsque la recherche ne trouve rien : c'est le seul pont entre les deux.
 */
export default function AssistantSearchHits({
  hits,
  query,
  onAskAssistant,
  onClose,
}: {
  hits: readonly SearchHit[];
  query: string;
  onAskAssistant?: () => void;
  onClose?: () => void;
}) {
  if (hits.length === 0) {
    return (
      <div className="px-4 py-3">
        <p className="text-[13px] text-text-muted">Aucun résultat pour « {query} ».</p>
        {onAskAssistant ? (
          <button
            type="button"
            onClick={onAskAssistant}
            className="mt-2 inline-flex min-h-[36px] items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-primary-600 transition-colors duration-fluid-subtle ease-in-out hover:bg-primary-50"
          >
            <PrimIaIcon size={15} />
            Demander à Prim&apos;IA
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <CardEyebrow>Résultats ({hits.length})</CardEyebrow>
      <ul className="mt-2 flex max-h-[min(42vh,18rem)] flex-col gap-0.5 overflow-y-auto">
        {hits.map((hit) => (
          <li key={`${hit.kind}-${hit.id}`}>
            <Link
              href={hit.href}
              onClick={onClose}
              className="flex w-full min-w-0 items-start justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{hit.label}</span>
                {hit.snippet ? (
                  <span className="mt-0.5 block truncate text-[12px] text-text-muted">{hit.snippet}</span>
                ) : null}
              </span>
              <span className="shrink-0 pt-0.5 text-[11px] font-medium uppercase text-mute">
                {hit.subtitle}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
