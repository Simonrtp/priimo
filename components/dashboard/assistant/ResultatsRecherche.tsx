'use client';

import {
  ArrowUpRight,
  FileText,
  Home,
  MapPin,
  MessageSquare,
  Target,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { SearchHit, SearchHitKind } from '@/lib/assistant/search';
import AssistantIcon from './AssistantIcon';

import type { AdresseTrouvee } from '@/lib/ban-recherche';

/** Une ligne choisissable : une fiche, une adresse, ou la question à l'assistant. */
export type ChoixRecherche =
  | { type: 'fiche'; hit: SearchHit }
  | { type: 'adresse'; adresse: AdresseTrouvee }
  | { type: 'assistant' };

const ICONE_FICHE: Record<SearchHitKind, LucideIcon> = {
  contact: UserRound,
  bien: Home,
  lead: Target,
  note: FileText,
  interaction: MessageSquare,
};

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-subtle">{titre}</p>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function Ligne({
  actif,
  onChoisir,
  onSurvol,
  icone: Icone,
  titre,
  detail,
  suffixe,
  id,
}: {
  actif: boolean;
  onChoisir: () => void;
  onSurvol: () => void;
  icone: LucideIcon;
  titre: string;
  detail: string | null;
  suffixe: React.ReactNode;
  id: string;
}) {
  return (
    <li id={id} role="option" aria-selected={actif}>
      <button
        type="button"
        // mousedown : le champ ne perd pas le focus avant que le choix parte.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onChoisir}
        onMouseMove={onSurvol}
        className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-fluid-subtle ease-in-out ${
          actif ? 'bg-primary-50' : ''
        }`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-bg-subtle text-text-muted">
          <Icone size={15} strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-text-strong">{titre}</span>
          {detail ? <span className="mt-px block truncate text-[12px] text-text-muted">{detail}</span> : null}
        </span>
        <span className="shrink-0 text-[11px] font-medium text-text-subtle">{suffixe}</span>
      </button>
    </li>
  );
}

/**
 * Ce que la barre a trouvé, dans l'ordre où l'agent en a besoin : ses fiches,
 * puis les adresses de France, puis — toujours en dernier — la question à
 * « Mon assistant ». Une seule barre, trois façons d'y répondre.
 */
export default function ResultatsRecherche({
  query,
  fiches,
  adresses,
  recherche,
  actif,
  onActif,
  onChoisir,
  idPrefix,
  surCarte,
}: {
  query: string;
  fiches: readonly SearchHit[];
  adresses: readonly AdresseTrouvee[];
  recherche: boolean;
  actif: number;
  onActif: (i: number) => void;
  onChoisir: (choix: ChoixRecherche) => void;
  idPrefix: string;
  /** Sur la carte, une fiche située y amène au lieu d'ouvrir sa page. */
  surCarte: boolean;
}) {
  const rien = fiches.length === 0 && adresses.length === 0;
  const indexAssistant = fiches.length + adresses.length;

  return (
    <div role="listbox" aria-label="Résultats" className="p-1.5">
      {fiches.length ? (
        <Groupe titre="Vos fiches">
          {fiches.map((hit, i) => (
            <Ligne
              key={`${hit.kind}-${hit.id}`}
              id={`${idPrefix}-${i}`}
              actif={actif === i}
              onSurvol={() => onActif(i)}
              onChoisir={() => onChoisir({ type: 'fiche', hit })}
              icone={ICONE_FICHE[hit.kind]}
              titre={hit.label}
              detail={hit.snippet}
              suffixe={surCarte && hit.lieu ? <MapPin size={13} strokeWidth={2} aria-label="Sur la carte" /> : hit.subtitle}
            />
          ))}
        </Groupe>
      ) : null}

      {adresses.length ? (
        <Groupe titre="Adresses">
          {adresses.map((a, j) => {
            const i = fiches.length + j;
            return (
              <Ligne
                key={a.id}
                id={`${idPrefix}-${i}`}
                actif={actif === i}
                onSurvol={() => onActif(i)}
                onChoisir={() => onChoisir({ type: 'adresse', adresse: a })}
                icone={MapPin}
                titre={a.label}
                detail={a.contexte}
                suffixe={
                  <span className="inline-flex items-center gap-0.5">
                    Carte
                    <ArrowUpRight size={12} strokeWidth={2.2} aria-hidden />
                  </span>
                }
              />
            );
          })}
        </Groupe>
      ) : null}

      {rien ? (
        <p className="px-3 py-2.5 text-[13px] text-text-muted" role="status">
          {recherche ? 'Recherche…' : `Aucune fiche ni adresse pour « ${query} ».`}
        </p>
      ) : null}

      <div className={`${rien ? '' : 'mt-1 border-t border-black/[0.06] pt-1.5'}`}>
        <ul>
          <li id={`${idPrefix}-${indexAssistant}`} role="option" aria-selected={actif === indexAssistant}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChoisir({ type: 'assistant' })}
              onMouseMove={() => onActif(indexAssistant)}
              className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-fluid-subtle ease-in-out ${
                actif === indexAssistant ? 'bg-primary-50' : ''
              }`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary-50 text-primary-600">
                <AssistantIcon size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-primary-700">Demander à Mon assistant</span>
                <span className="mt-px block truncate text-[12px] text-text-muted">« {query} »</span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
