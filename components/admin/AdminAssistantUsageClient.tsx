'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AdminAssistantUsage } from '@/app/api/admin/assistant-usage/route';

function formatNombre(n: number): string {
  return n.toLocaleString('fr-FR');
}

function moisLisible(mois: string): string {
  const [annee, m] = mois.split('-');
  if (!annee || !m) return mois;
  const d = new Date(Date.UTC(Number(annee), Number(m) - 1, 1));
  if (Number.isNaN(d.getTime())) return mois;
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export default function AdminAssistantUsageClient() {
  const [data, setData] = useState<AdminAssistantUsage | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/assistant-usage');
        const body = (await res.json()) as AdminAssistantUsage & { error?: string };
        if (!res.ok) {
          setErreur(body.error ?? 'Chargement impossible.');
          return;
        }
        setData(body);
      } catch {
        setErreur('Chargement impossible.');
      }
    })();
  }, []);

  const parMois = useMemo(() => {
    const groupes = new Map<string, AdminAssistantUsage['usage']>();
    for (const row of data?.usage ?? []) {
      const list = groupes.get(row.mois) ?? [];
      list.push(row);
      groupes.set(row.mois, list);
    }
    return [...groupes.entries()];
  }, [data]);

  if (erreur) return <p className="text-sm text-[var(--danger)]">{erreur}</p>;
  if (!data) return <p className="text-sm text-mute">Chargement…</p>;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-lg font-semibold text-ink">Consommation de l&apos;assistant</h1>
        <p className="mt-1 text-sm text-mute">
          Tokens facturés par agence et par mois. Plafond mensuel en vigueur :{' '}
          <strong className="font-semibold text-ink">{formatNombre(data.plafondMensuel)}</strong> tokens
          par agence.
        </p>
      </section>

      {parMois.length === 0 ? (
        <p className="text-sm text-mute">Aucune consommation enregistrée.</p>
      ) : (
        parMois.map(([mois, rows]) => {
          const total = rows.reduce((n, r) => n + r.tokens, 0);
          return (
            <section key={mois}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold capitalize text-ink">{moisLisible(mois)}</h2>
                <span className="text-sm tabular-nums text-mute">{formatNombre(total)} tokens</span>
              </div>
              <div className="mt-2 overflow-x-auto rounded-xl border border-black/[0.08] bg-white">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-black/[0.06] text-left text-xs uppercase tracking-wide text-mute">
                      <th className="px-3 py-2 font-semibold">Agence</th>
                      <th className="px-3 py-2 text-right font-semibold">Tokens</th>
                      <th className="px-3 py-2 text-right font-semibold">Part du plafond</th>
                      <th className="px-3 py-2 text-right font-semibold">Messages</th>
                      <th className="px-3 py-2 text-right font-semibold">Conversations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const part = Math.round((row.tokens / data.plafondMensuel) * 100);
                      return (
                        <tr key={`${row.agencyId}-${row.mois}`} className="border-b border-black/[0.04] last:border-0">
                          <td className="px-3 py-2 text-ink">{row.agencyName}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-ink">
                            {formatNombre(row.tokens)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums ${
                              part >= 100 ? 'font-semibold text-[var(--danger)]' : 'text-mute'
                            }`}
                          >
                            {part}&nbsp;%
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-mute">
                            {formatNombre(row.messages)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-mute">
                            {formatNombre(row.conversations)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      <section>
        <h2 className="text-sm font-semibold text-ink">Formulations les plus fréquentes</h2>
        <p className="mt-1 text-sm text-mute">
          Ce que les agents demandent réellement. Les tournures fréquentes encore
          non couvertes par le routeur déterministe sont les prochaines à y ajouter.
        </p>
        {data.formes.length === 0 ? (
          <p className="mt-2 text-sm text-mute">Aucune question enregistrée.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-black/[0.08] bg-white">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs uppercase tracking-wide text-mute">
                  <th className="px-3 py-2 font-semibold">Tournure</th>
                  <th className="px-3 py-2 font-semibold">Exemple</th>
                  <th className="px-3 py-2 text-right font-semibold">Fois</th>
                  <th className="px-3 py-2 text-right font-semibold">Sans résultat</th>
                </tr>
              </thead>
              <tbody>
                {data.formes.map((f) => (
                  <tr key={f.forme} className="border-b border-black/[0.04] last:border-0">
                    <td className="px-3 py-2 font-medium text-ink">{f.forme}</td>
                    <td className="max-w-[22rem] truncate px-3 py-2 text-mute">{f.exemple}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{f.occurrences}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-mute">{f.sansResultat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
