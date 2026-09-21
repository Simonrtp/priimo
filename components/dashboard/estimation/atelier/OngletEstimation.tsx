'use client';

import { useEffect, useState } from 'react';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { Field } from '@/components/dashboard/workspace/Field';
import { ChampSaisi } from './ChampSaisi';
import DetailCalcul from '@/components/estimation/parts/DetailCalcul';
import { formatEuro } from '@/lib/estimation/resultat';
import type { EstimationObjet } from '@/lib/estimation/objet';
import { nombreSaisi } from '@/lib/estimation/objet';
import type { DecompositionValeur } from '@/lib/estimation/valeur';
import { parseRapportExclus, basculerExclusion } from '@/lib/rapport/genere/exclus';
import type { VenteComparable } from '@/lib/rapport/genere/comparables';
import type { AnnonceMarche } from '@/lib/rapport/genere/types';
import { formatDateCourte, formatPrixM2, formatSurface } from '@/lib/rapport/genere/format';

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
  }) => void;
}) {
  const [net, setNet] = useState(true);
  const [travaux, setTravaux] = useState(0);
  const [decote, setDecote] = useState(0);
  const [autres, setAutres] = useState(0);
  const [justif, setJustif] = useState('');
  const [ventes, setVentes] = useState<VenteComparable[]>([]);
  const [ventesReserve, setVentesReserve] = useState<VenteComparable[]>([]);
  const [annonces, setAnnonces] = useState<AnnonceMarche[]>([]);
  const [annoncesReserve, setAnnoncesReserve] = useState<AnnonceMarche[]>([]);
  const exclus = parseRapportExclus(estimation.rapportExclus);
  const affiche = decomposition ?? null;
  const valeur = net ? affiche?.netVendeur ?? estimation.priceValue : affiche?.valeur ?? estimation.priceValue;

  useEffect(() => {
    let ignore = false;
    void fetch(`/api/dashboard/estimation/${estimation.id}/rapport`)
      .then((r) => r.json())
      .then((data: { dossier?: { comparables?: VenteComparable[]; comparablesReserve?: VenteComparable[]; annonces?: AnnonceMarche[]; annoncesReserve?: AnnonceMarche[] } }) => {
        if (ignore || !data.dossier) return;
        setVentes(data.dossier.comparables ?? []);
        setVentesReserve(data.dossier.comparablesReserve ?? []);
        setAnnonces(data.dossier.annonces ?? []);
        setAnnoncesReserve(data.dossier.annoncesReserve ?? []);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [estimation.id, estimation.rapportExclus, estimation.surfaceM2, estimation.priceValue]);

  return (
    <div className="flex flex-col gap-5">
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
            if (n == null) {
              onPatch({ honorairesPct: 0 });
              return;
            }
            onPatch({ honorairesPct: Math.min(20, Math.max(0, n)) });
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
      <Field label="Justification" htmlFor="est-justif">
        <ChampSaisi
          id="est-justif"
          value={justif}
          onCommit={setJustif}
        />
      </Field>

      <WorkspaceButton
        type="button"
        disabled={calculating}
        onClick={() =>
          onCalculer({
            netVendeur: net,
            travauxEur: travaux,
            decoteOccupationEur: decote,
            autresEur: autres,
            justification: justif,
          })
        }
      >
        {calculating ? 'Calcul…' : 'Calculer'}
      </WorkspaceButton>

      {valeur != null ? (
        <div className="rounded-clay border border-black/[0.06] bg-surface px-5 py-4 shadow-clay-sm">
          <p className="text-[12.5px] text-text-muted">{net ? 'Net vendeur' : 'Valeur'}</p>
          <p className="mt-1 font-display text-[32px] font-bold tabular-nums text-text-strong">
            {formatEuro(valeur)}
          </p>
          {(affiche?.low ?? estimation.priceLow) != null &&
          (affiche?.high ?? estimation.priceHigh) != null ? (
            <p className="mt-1 text-[13.5px] tabular-nums text-text-muted">
              {formatEuro(affiche?.low ?? estimation.priceLow ?? 0)} –{' '}
              {formatEuro(affiche?.high ?? estimation.priceHigh ?? 0)}
            </p>
          ) : null}
        </div>
      ) : null}

      <Field label="Remarques de l’expert" htmlFor="est-remarques">
        <ChampSaisi
          id="est-remarques"
          value={estimation.remarquesExpert ?? ''}
          onCommit={(raw) => onPatch({ remarquesExpert: raw.trim() || null })}
        />
      </Field>

      {affiche ? <DetailCalcul lines={affiche.lignes} low={affiche.low} high={affiche.high} /> : null}

      {capitalisation ? (
        <div>
          <h3 className="mb-2 text-[14px] font-semibold text-text-strong">Capitalisation</h3>
          <DetailCalcul lines={capitalisation.lignes} low={null} high={null} />
        </div>
      ) : null}

      <section>
        <h3 className="text-[14px] font-semibold text-text-strong">Ventes comparables</h3>
        <p className="mt-1 text-pretty text-[13px] text-text-muted">
          Ces ventes figurent au rapport. Retirez celles qui ne conviennent pas ; vous pouvez les rétablir.
        </p>
        <ListeSelection
          items={[...ventes, ...ventesReserve].map((v) => ({
            id: v.id,
            label: `${formatSurface(v.surfaceM2)} · ${formatEuro(v.prix)}${v.prixM2 != null ? ` · ${formatPrixM2(v.prixM2)}` : ''}${v.date ? ` · ${formatDateCourte(v.date)}` : ''}`,
            retiree: exclus.comparables.includes(v.id),
          }))}
          onToggle={(id) =>
            onPatch({
              rapportExclus: {
                comparables: basculerExclusion(exclus.comparables, id),
                annonces: exclus.annonces,
              },
            })
          }
        />
      </section>

      <section>
        <h3 className="text-[14px] font-semibold text-text-strong">Annonces concurrentes</h3>
        <p className="mt-1 text-pretty text-[13px] text-text-muted">
          Annonces relevées pour la zone. Retirez celles qui ne doivent pas figurer à l’étude.
        </p>
        <ListeSelection
          items={[...annonces, ...annoncesReserve].map((a) => ({
            id: a.id,
            label: `${a.surfaceM2 != null ? formatSurface(a.surfaceM2) : 'Surface inconnue'}${a.prix != null ? ` · ${formatEuro(a.prix)}` : ''}${a.dateReleve ? ` · ${formatDateCourte(a.dateReleve)}` : ''}`,
            retiree: exclus.annonces.includes(a.id),
          }))}
          onToggle={(id) =>
            onPatch({
              rapportExclus: {
                comparables: exclus.comparables,
                annonces: basculerExclusion(exclus.annonces, id),
              },
            })
          }
        />
      </section>
    </div>
  );
}

function ListeSelection({
  items,
  onToggle,
}: {
  items: Array<{ id: string; label: string; retiree: boolean }>;
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-pretty text-[13px] text-text-muted">Aucune ligne pour l’instant.</p>;
  }
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-2 rounded-clay px-1 py-1">
          <span className={`min-w-0 truncate text-[13px] ${item.retiree ? 'text-text-muted line-through' : 'text-text'}`}>
            {item.label}
          </span>
          <WorkspaceButton type="button" variant="secondary" onClick={() => onToggle(item.id)}>
            {item.retiree ? 'Rétablir' : 'Retirer'}
          </WorkspaceButton>
        </li>
      ))}
    </ul>
  );
}
