'use client';

import { useState } from 'react';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { Field, TextInput } from '@/components/dashboard/workspace/Field';
import DetailCalcul from '@/components/estimation/parts/DetailCalcul';
import { formatEuro } from '@/lib/estimation/resultat';
import type { EstimationObjet } from '@/lib/estimation/objet';
import type { DecompositionValeur } from '@/lib/estimation/valeur';

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
  const affiche = decomposition ?? null;
  const valeur = net ? affiche?.netVendeur ?? estimation.priceValue : affiche?.valeur ?? estimation.priceValue;

  return (
    <div className="flex flex-col gap-5">
      <label className="flex min-h-10 items-center gap-2 text-[13.5px]">
        <input type="checkbox" checked={net} onChange={(e) => setNet(e.target.checked)} />
        Afficher en net vendeur
      </label>
      <Field label="Honoraires (%)" htmlFor="est-hon">
        <TextInput
          id="est-hon"
          inputMode="decimal"
          value={estimation.honorairesPct}
          onChange={(e) => onPatch({ honorairesPct: Number(e.target.value) || 5 })}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Travaux à déduire (€)" htmlFor="est-trav">
          <TextInput
            id="est-trav"
            inputMode="numeric"
            value={travaux || ''}
            onChange={(e) => setTravaux(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Décote occupation (€)" htmlFor="est-decote">
          <TextInput
            id="est-decote"
            inputMode="numeric"
            value={decote || ''}
            onChange={(e) => setDecote(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Autre ajustement (€)" htmlFor="est-autres">
          <TextInput
            id="est-autres"
            value={autres || ''}
            onChange={(e) => setAutres(Number(e.target.value) || 0)}
          />
        </Field>
      </div>
      <Field label="Justification" htmlFor="est-justif">
        <TextInput
          id="est-justif"
          value={justif}
          onChange={(e) => setJustif(e.target.value)}
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

      {affiche ? <DetailCalcul lines={affiche.lignes} low={affiche.low} high={affiche.high} /> : null}

      {capitalisation ? (
        <div>
          <h3 className="mb-2 text-[14px] font-semibold text-text-strong">Capitalisation</h3>
          <DetailCalcul lines={capitalisation.lignes} low={null} high={null} />
        </div>
      ) : null}
    </div>
  );
}
