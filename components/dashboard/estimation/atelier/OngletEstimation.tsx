'use client';

import { useEffect, useState } from 'react';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { Field } from '@/components/dashboard/workspace/Field';
import { ChampSaisi } from './ChampSaisi';
import { formatEuro } from '@/lib/estimation/resultat';
import type { EstimationObjet } from '@/lib/estimation/objet';
import { nombreSaisi } from '@/lib/estimation/objet';
import type { DecompositionValeur } from '@/lib/estimation/valeur';
import { parseRapportExclus, basculerExclusion } from '@/lib/rapport/genere/exclus';
import { formatDateCourte, formatPrixM2, formatSurface } from '@/lib/rapport/genere/format';

type AjustementVu = { id: string; label: string; amountEur?: number };
type VenteVu = {
  id: string;
  date: string;
  surfaceM2: number;
  prix: number;
  prixM2: number;
  sameBuilding?: boolean;
  voie?: string | null;
};
type ImpossibleVu = { motif: string; action: string };

function lireNombre(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
}

export default function OngletEstimation({
  estimation,
  decomposition,
  capitalisation,
  calculating,
  onPatch,
  onCalculer,
}: {
  estimation: EstimationObjet;
  decomposition: DecompositionValeur | null;
  capitalisation: DecompositionValeur | null;
  calculating: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  onCalculer: (input: {
    netVendeur: boolean;
    travauxEur: number;
    decoteOccupationEur: number;
    autresEur: number;
    justification: string;
    exclusIds?: string[];
  }) => void;
}) {
  const ctx = estimation.context;
  const moteurValeur = lireNombre(ctx.moteurValeur) ?? (estimation.available ? estimation.priceValue : null);
  const prixAgent = lireNombre(ctx.prixAgent);
  const impossible = (ctx.impossible ?? null) as ImpossibleVu | null;
  const ajustements = (Array.isArray(ctx.ajustements) ? ctx.ajustements : []) as AjustementVu[];
  const exclus = parseRapportExclus(estimation.rapportExclus);
  const [net, setNet] = useState(true);
  const [travaux, setTravaux] = useState(0);
  const [decote, setDecote] = useState(0);
  const [autres, setAutres] = useState(0);
  const [justif, setJustif] = useState('');
  const [prixSaisi, setPrixSaisi] = useState(prixAgent != null ? String(prixAgent) : '');

  const [connues, setConnues] = useState<VenteVu[]>([]);
  const retenues = Array.isArray(estimation.comparables)
    ? (estimation.comparables as Array<Record<string, unknown>>).map((v, i) => ({
        id: String(v.id ?? v.idMutation ?? `${v.date ?? i}-${v.price ?? i}`),
        date: String(v.date ?? ''),
        surfaceM2: Number(v.surfaceM2) || 0,
        prix: Number(v.price ?? v.prix) || 0,
        prixM2: Number(v.pricePerM2 ?? v.prixM2) || 0,
        sameBuilding: v.sameBuilding === true,
        voie: typeof v.voie === 'string' ? v.voie : null,
      }))
    : [];

  useEffect(() => {
    if (retenues.length === 0) return;
    setConnues((prev) => {
      const map = new Map(prev.map((v) => [v.id, v]));
      for (const v of retenues) map.set(v.id, v);
      return [...map.values()];
    });
  }, [estimation.id, estimation.comparables]);

  useEffect(() => {
    setPrixSaisi(prixAgent != null ? String(prixAgent) : '');
  }, [prixAgent]);

  function lancer(exclusIds?: string[]) {
    if (calculating) return;
    onCalculer({
      netVendeur: net,
      travauxEur: travaux,
      decoteOccupationEur: decote,
      autresEur: autres,
      justification: justif,
      exclusIds,
    });
  }

  const fourchetteBasse = estimation.priceLow;
  const fourchetteHaute = estimation.priceHigh;
  const prixM2 =
    moteurValeur != null && estimation.surfaceM2
      ? Math.round(moteurValeur / estimation.surfaceM2)
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-pretty text-[13.5px] text-text-muted">
          Le moteur propose. Vous gardez le dernier mot.
        </p>
        <WorkspaceButton type="button" onClick={() => lancer()} disabled={calculating}>
          {calculating ? 'Calcul…' : moteurValeur != null || impossible ? 'Recalculer' : 'Calculer'}
        </WorkspaceButton>
      </div>

      {calculating ? (
        <div
          className="rounded-clay border border-black/[0.06] bg-surface px-5 py-4 shadow-clay-sm"
          aria-busy="true"
          aria-label="Calcul en cours"
        >
          <div className="h-3.5 w-24 animate-pulse rounded bg-black/[0.06]" />
          <div className="mt-3 h-10 w-44 animate-pulse rounded bg-black/[0.08]" />
        </div>
      ) : impossible && moteurValeur == null ? (
        <div className="rounded-clay border border-black/[0.08] bg-surface px-5 py-4 shadow-clay-sm">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-text-muted">
            Estimation impossible
          </p>
          <p className="mt-2 text-pretty text-[15px] font-medium text-text-strong">{impossible.motif}</p>
          <p className="mt-1 text-pretty text-[13.5px] text-text-muted">{impossible.action}</p>
        </div>
      ) : moteurValeur != null ? (
        <div className="rounded-clay border border-black/[0.06] bg-surface px-5 py-4 shadow-clay-sm">
          <p className="text-[12.5px] text-text-muted">Prix proposé par le moteur</p>
          <p className="mt-1 font-display text-[32px] font-bold tabular-nums text-text-strong">
            {formatEuro(moteurValeur)}
          </p>
          {prixM2 != null && estimation.surfaceM2 != null ? (
            <p className="mt-1 text-[13.5px] tabular-nums text-text-muted">
              {formatPrixM2(prixM2)} · {formatSurface(estimation.surfaceM2)}
            </p>
          ) : null}
          {fourchetteBasse != null && fourchetteHaute != null ? (
            <p className="mt-1 text-[13.5px] tabular-nums text-text-muted">
              Fourchette {formatEuro(fourchetteBasse)} – {formatEuro(fourchetteHaute)}
            </p>
          ) : null}
          {estimation.reliabilityLabel ? (
            <p className="mt-2 text-[13px] font-semibold text-text-strong">{estimation.reliabilityLabel}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-pretty text-[13.5px] text-text-muted">
          Calculez pour obtenir une proposition, ou saisissez le prix à la main.
        </p>
      )}

      <Field label="Prix final de l’agent" htmlFor="est-prix-agent">
        <ChampSaisi
          id="est-prix-agent"
          inputMode="numeric"
          value={prixSaisi}
          onCommit={(raw) => {
            const n = nombreSaisi(raw);
            setPrixSaisi(n != null && n > 0 ? String(n) : '');
            onPatch({ prixAgent: n != null && n > 0 ? n : null });
          }}
        />
      </Field>

      {ajustements.length > 0 ? (
        <section>
          <h3 className="text-[14px] font-semibold text-text-strong">Ajustements appliqués</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {ajustements.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 text-[13.5px]">
                <span className="text-text">{a.label}</span>
                {a.amountEur != null ? (
                  <span className="tabular-nums text-text-muted">
                    {a.amountEur > 0 ? '+' : ''}
                    {formatEuro(a.amountEur)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="text-[14px] font-semibold text-text-strong">Ventes retenues</h3>
        <p className="mt-1 text-pretty text-[13px] text-text-muted">
          Retirez une vente pour recalculer tout de suite. Vous pouvez la rétablir.
        </p>
        {connues.length === 0 && retenues.length === 0 ? (
          <p className="mt-2 text-pretty text-[13px] text-text-muted">Aucune vente retenue pour l’instant.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {(connues.length > 0 ? connues : retenues).map((v) => {
              const retiree = exclus.comparables.includes(v.id);
              return (
                <li key={v.id} className="flex items-center justify-between gap-2 rounded-clay px-1 py-1">
                  <span className={`min-w-0 text-[13px] ${retiree ? 'text-text-muted line-through' : 'text-text'}`}>
                    {v.sameBuilding ? 'Immeuble · ' : ''}
                    {formatSurface(v.surfaceM2)} · {formatEuro(v.prix)}
                    {v.prixM2 > 0 ? ` · ${formatPrixM2(v.prixM2)}` : ''}
                    {v.date ? ` · ${formatDateCourte(v.date)}` : ''}
                  </span>
                  <WorkspaceButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const next = basculerExclusion(exclus.comparables, v.id);
                      onPatch({
                        rapportExclus: { comparables: next, annonces: exclus.annonces },
                      });
                      lancer(next);
                    }}
                  >
                    {retiree ? 'Rétablir' : 'Retirer'}
                  </WorkspaceButton>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <details className="rounded-clay border border-black/[0.06] px-3 py-2">
        <summary className="min-h-11 cursor-pointer text-[13.5px] font-semibold text-text">
          Honoraires et déductions
        </summary>
        <div className="mt-3 flex flex-col gap-3 pb-2">
          <label className="flex min-h-10 items-center gap-2 text-[13.5px]">
            <input type="checkbox" checked={net} onChange={(e) => setNet(e.target.checked)} />
            Afficher en net vendeur
          </label>
          <Field label="Honoraires (%)" htmlFor="est-hon">
            <ChampSaisi
              id="est-hon"
              inputMode="decimal"
              value={estimation.honorairesPct === 0 ? '' : String(estimation.honorairesPct)}
              onCommit={(raw) => {
                const n = nombreSaisi(raw.replace(/[^\d.,]/g, ''));
                onPatch({ honorairesPct: n == null ? 0 : Math.min(20, Math.max(0, n)) });
              }}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Travaux à déduire (€)" htmlFor="est-trav">
              <ChampSaisi
                id="est-trav"
                inputMode="numeric"
                value={travaux === 0 ? '' : String(travaux)}
                onCommit={(raw) => setTravaux(nombreSaisi(raw) ?? 0)}
              />
            </Field>
            <Field label="Décote occupation (€)" htmlFor="est-decote">
              <ChampSaisi
                id="est-decote"
                inputMode="numeric"
                value={decote === 0 ? '' : String(decote)}
                onCommit={(raw) => setDecote(nombreSaisi(raw) ?? 0)}
              />
            </Field>
            <Field label="Autre ajustement (€)" htmlFor="est-autres">
              <ChampSaisi
                id="est-autres"
                inputMode="numeric"
                value={autres === 0 ? '' : String(autres)}
                onCommit={(raw) => setAutres(nombreSaisi(raw) ?? 0)}
              />
            </Field>
          </div>
        </div>
      </details>

      {decomposition && capitalisation ? (
        <p className="text-pretty text-[12.5px] text-text-muted">
          Capitalisation locative : {formatEuro(capitalisation.valeur)} — affichée à part, jamais
          moyennée avec la comparaison.
        </p>
      ) : null}
    </div>
  );
}
