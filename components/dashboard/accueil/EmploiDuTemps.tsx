'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { dateKeyParis } from '@/lib/today/calendar';
import { grouperParJour, joursDeLaSemaine } from '@/lib/agenda/semaine';
import type { AgendaEvenement } from '@/lib/agenda/types';

type AgendaReponse = {
  connected: boolean;
  calendarEmail?: string;
  emailPro?: string;
  error?: string;
  events?: AgendaEvenement[];
};

function consommerRetourOAuth() {
  const params = new URLSearchParams(window.location.search);
  const flag = params.get('agenda');
  if (!flag) return;
  if (flag === 'connected') toast.success('Google Agenda connecté');
  else if (flag === 'denied') toast.error('Connexion Agenda refusée');
  else if (flag === 'error' || flag === 'invalid_state' || flag === 'not_configured') {
    toast.error('Connexion Agenda impossible');
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('agenda');
  window.history.replaceState({}, '', url.pathname + url.search);
}

/**
 * Semaine en cours, lue sur Google Agenda de l'adresse pro.
 */
export default function EmploiDuTemps() {
  const [busy, setBusy] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [data, setData] = useState<AgendaReponse | null>(null);

  const maintenant = useMemo(() => new Date(), []);
  const aujourdhui = dateKeyParis(maintenant);
  const jours = useMemo(() => joursDeLaSemaine(maintenant, aujourdhui), [maintenant, aujourdhui]);
  const parJour = useMemo(() => grouperParJour(data?.events ?? []), [data?.events]);

  useEffect(() => {
    consommerRetourOAuth();
    let actif = true;
    void (async () => {
      try {
        const res = await fetch('/api/dashboard/integrations/calendar/events');
        const json = (await res.json()) as AgendaReponse;
        if (actif) setData(json);
      } catch {
        if (actif) setData({ connected: false, events: [] });
      } finally {
        if (actif) setChargement(false);
      }
    })();
    return () => {
      actif = false;
    };
  }, []);

  async function connecter() {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/integrations/calendar/start');
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        toast.error(json.error ?? 'OAuth Agenda indisponible');
        return;
      }
      window.location.href = json.url;
    } catch {
      toast.error('Impossible de démarrer la connexion Agenda');
    } finally {
      setBusy(false);
    }
  }

  const connecte = Boolean(data?.connected);
  const email = data?.calendarEmail || data?.emailPro;

  if (chargement) {
    return (
      <section className="flex h-full min-w-0 flex-col items-center justify-center rounded-clay-lg bg-surface p-5 shadow-clay">
        <p className="text-[13px] text-text-muted">Chargement de la semaine…</p>
      </section>
    );
  }

  if (!connecte) {
    return (
      <CarteConnexionGoogle
        erreur={data?.error}
        busy={busy}
        onConnecter={() => void connecter()}
      />
    );
  }

  return (
    <section className="flex h-full min-w-0 flex-col rounded-clay-lg bg-surface p-5 shadow-clay">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays size={16} strokeWidth={2.3} className="shrink-0 text-blue-dark" aria-hidden />
          <h2 className="font-display text-balance text-[15px] font-bold text-blue-dark">
            Mon emploi du temps
          </h2>
        </div>
        <a
          href="https://calendar.google.com/calendar/r/week"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[12px] font-semibold text-text-muted transition-colors hover:text-text-strong"
        >
          Voir dans Google Agenda →
        </a>
      </div>

      {email ? (
        <p className="mt-1 truncate text-[11px] text-text-subtle">{email}</p>
      ) : null}

      <div className="mt-3 hidden min-h-0 flex-1 sm:block">
            <table className="w-full table-fixed border-collapse">
              <caption className="sr-only">Emploi du temps de la semaine en cours</caption>
              <thead>
                <tr>
                  {jours.map((jour) => (
                    <th
                      key={jour.cle}
                      scope="col"
                      className="border-b border-black/[0.06] px-1 py-1.5 text-center text-[11px] font-semibold text-text-muted"
                      style={{ backgroundColor: jour.aujourdhui ? '#EAF1FB' : '#F6F7F9' }}
                    >
                      {jour.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="align-top">
                  {jours.map((jour) => {
                    const evs = parJour[jour.cle] ?? [];
                    return (
                      <td
                        key={jour.cle}
                        className="border-r border-black/[0.04] px-1.5 py-2 last:border-r-0"
                        style={jour.aujourdhui ? { backgroundColor: '#F7FAFE' } : undefined}
                      >
                        {evs.length === 0 ? (
                          <p className="text-center text-[11px] text-text-subtle">—</p>
                        ) : (
                          <ul className="flex flex-col gap-1.5">
                            {evs.map((ev) => (
                              <li key={ev.id} className="min-w-0">
                                <p className="text-[10px] font-semibold tabular-nums text-blue-dark">
                                  {ev.journee ? 'Journée' : ev.debut}
                                </p>
                                <p className="line-clamp-2 text-[11px] leading-snug text-text-strong">
                                  {ev.titre}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

      <ul className="mt-3 flex flex-col gap-2 sm:hidden">
            {jours.map((jour) => {
              const evs = parJour[jour.cle] ?? [];
              return (
                <li
                  key={jour.cle}
                  className="rounded-clay px-3 py-2"
                  style={{ backgroundColor: jour.aujourdhui ? '#EAF1FB' : '#F6F7F9' }}
                >
                  <p className="text-[12px] font-semibold text-text-muted">{jour.label}</p>
                  {evs.length === 0 ? (
                    <p className="mt-0.5 text-[12px] text-text-subtle">Rien de prévu</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {evs.map((ev) => (
                        <li key={ev.id} className="text-pretty text-[13px] text-text-strong">
                          <span className="font-semibold tabular-nums text-blue-dark">
                            {ev.journee ? 'Journée' : ev.debut}
                          </span>
                          {' · '}
                          {ev.titre}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
    </section>
  );
}

const GOOGLE = {
  ink: '#202124',
  mute: '#5f6368',
  line: '#dadce0',
  chip: '#f1f3f4',
  blue: '#1a73e8',
} as const;

function CarteConnexionGoogle({
  erreur,
  busy,
  onConnecter,
}: {
  erreur?: string;
  busy: boolean;
  onConnecter: () => void;
}) {
  return (
    <section
      className="flex h-full min-w-0 flex-col justify-between gap-6 rounded-clay-lg bg-white p-6"
      style={{
        border: `1px solid ${GOOGLE.line}`,
        boxShadow: '0 1px 2px 0 rgba(60,64,67,.15), 0 1px 3px 1px rgba(60,64,67,.08)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/google.png" alt="" width={40} height={40} className="size-10 shrink-0" />
          <p className="text-[13px] font-medium" style={{ color: GOOGLE.mute }}>
            Google Agenda
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onConnecter}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2.5 rounded-clay bg-white px-4 text-[14px] font-medium outline-offset-2 focus-visible:outline focus-visible:outline-2 disabled:opacity-60"
          style={{ color: GOOGLE.ink, border: `1px solid #747775`, outlineColor: GOOGLE.blue }}
        >
          <img src="/google.png" alt="" width={18} height={18} className="size-[18px]" />
          {busy ? 'Ouverture de Google…' : 'Choisir mon agenda'}
        </button>
      </div>

      <div className="min-w-0">
        <h2
          className="text-balance text-[22px] font-normal leading-tight"
          style={{ color: GOOGLE.ink }}
        >
          Voilà la connexion
        </h2>
        <p className="mt-2 text-pretty text-[13px] leading-relaxed" style={{ color: GOOGLE.mute }}>
          Je choisis l’agenda à afficher — lecture seule, rien n’est modifié. Google proposera
          tous mes comptes.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className="rounded-full px-3.5 py-2 text-[13px]"
          style={{ backgroundColor: GOOGLE.chip, color: GOOGLE.ink }}
        >
          Lecture seule
        </p>
        {erreur ? (
          <p className="text-pretty text-[12px]" style={{ color: GOOGLE.mute }}>
            {erreur}
          </p>
        ) : (
          <p className="text-[12px]" style={{ color: GOOGLE.mute }}>
            Rien n’est écrit dans l’agenda.
          </p>
        )}
      </div>
    </section>
  );
}
