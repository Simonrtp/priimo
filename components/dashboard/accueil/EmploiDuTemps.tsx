'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { dateKeyParis } from '@/lib/today/calendar';
import { grouperParJour, joursDeLaSemaine } from '@/lib/agenda/semaine';
import {
  LIBELLE_VUE,
  VUES,
  ancreDecalee,
  cleAgenda,
  grilleMois,
  libelleVue,
  type CaseMois,
  type VueAgenda,
} from '@/lib/agenda/vues';
import type { AgendaEvenement, AgendaReponse } from '@/lib/agenda/types';

function consommerRetourOAuth(): string | null {
  const params = new URLSearchParams(window.location.search);
  const flag = params.get('agenda');
  if (!flag) return null;
  if (flag === 'connected') toast.success('Google Agenda connecté');
  else if (flag === 'denied') toast.error('Connexion Agenda refusée');
  else if (flag === 'missing_table') {
    toast.error('Table calendar_connexions absente — appliquer la migration Supabase.');
  } else if (flag === 'no_api') {
    toast.error('Active Google Calendar API dans la console Cloud, puis réessaie.');
  } else if (flag === 'bad_secret') {
    toast.error('Le secret OAuth est invalide — recopie-le depuis la console Google.');
  } else if (flag === 'token') {
    toast.error('URI de redirection Google différente de celle du .env');
  } else if (flag === 'crypto') {
    toast.error('GMAIL_TOKEN_ENCRYPTION_KEY manquante — redémarre npm run dev.');
  } else if (flag === 'error' || flag === 'invalid_state' || flag === 'not_configured') {
    toast.error('Connexion Agenda impossible');
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('agenda');
  window.history.replaceState({}, '', url.pathname + url.search);
  return flag;
}

/** Midi UTC = même jour civil à Paris, quelle que soit l'heure d'été. */
function midiDe(ancre: string): Date {
  return new Date(`${ancre}T12:00:00Z`);
}

/**
 * L'agenda Google de l'adresse pro, en jour, semaine ou mois.
 *
 * La semaine en cours arrive déjà remplie par le serveur. Les autres plages se
 * chargent à la demande et restent en mémoire : revenir en arrière est gratuit.
 */
export default function EmploiDuTemps({ initial }: { initial: AgendaReponse }) {
  const [connexion, setConnexion] = useState(initial);
  const [busy, setBusy] = useState(false);

  const aujourdhui = useMemo(() => dateKeyParis(new Date()), []);
  const [vue, setVue] = useState<VueAgenda>('semaine');
  const [ancre, setAncre] = useState(aujourdhui);
  const [plages, setPlages] = useState<Record<string, AgendaEvenement[]>>(() =>
    initial.cle ? { [initial.cle]: initial.events } : {},
  );

  const connecte = Boolean(connexion.connected);
  const cle = cleAgenda(vue, ancre);
  const plage = plages[cle];

  useEffect(() => {
    const flag = consommerRetourOAuth();
    if (flag !== 'connected' || initial.connected) return;
    let actif = true;
    void (async () => {
      try {
        const res = await fetch('/api/dashboard/integrations/calendar/events');
        const json = (await res.json()) as AgendaReponse;
        if (!actif) return;
        setConnexion(json);
        if (json.cle) setPlages((prev) => ({ ...prev, [json.cle as string]: json.events ?? [] }));
      } catch {
        /* le serveur a déjà tenté ; on garde l'état initial */
      }
    })();
    return () => {
      actif = false;
    };
  }, [initial.connected]);

  useEffect(() => {
    if (!connecte || plage) return;
    let actif = true;
    void (async () => {
      try {
        const vueDemandee = vue === 'mois' ? 'mois' : 'semaine';
        const res = await fetch(
          `/api/dashboard/integrations/calendar/events?vue=${vueDemandee}&ancre=${ancre}`,
        );
        const json = (await res.json()) as AgendaReponse;
        if (!actif) return;
        setPlages((prev) => ({ ...prev, [json.cle ?? cle]: json.events ?? [] }));
      } catch {
        if (actif) setPlages((prev) => ({ ...prev, [cle]: [] }));
      }
    })();
    return () => {
      actif = false;
    };
  }, [ancre, cle, connecte, plage, vue]);

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

  if (!connecte) {
    return <CarteConnexionGoogle busy={busy} onConnecter={() => void connecter()} />;
  }

  const evenements = plage ?? [];
  const attente = !plage;
  const duJour = evenements.filter((ev) => ev.jour === ancre);
  const total = vue === 'jour' ? duJour.length : evenements.length;

  return (
    <section className="flex h-full min-w-0 flex-col rounded-clay-lg bg-surface p-5 shadow-clay">
      <EnteteAgenda email={connexion.calendarEmail} total={attente ? 0 : total} />
      <BarreVues
        vue={vue}
        libelle={libelleVue(vue, ancre)}
        onVue={setVue}
        onDecaler={(delta) => setAncre(ancreDecalee(vue, ancre, delta))}
      />
      {/* Plafond de la zone défilante : c'est lui qui borne la hauteur de la
          carte, donc celle de la rangée. Sans plafond, une semaine chargée
          étirerait la carte sur tout l'écran. */}
      <div
        className={`mt-3 min-h-0 flex-1 overflow-y-auto pr-0.5 ${
          vue === 'mois' ? 'max-h-[380px]' : 'max-h-[320px]'
        }`}
      >
        {vue === 'jour' ? (
          <VueJour evenements={duJour} attente={attente} />
        ) : vue === 'semaine' ? (
          <VueSemaine ancre={ancre} aujourdhui={aujourdhui} evenements={evenements} attente={attente} />
        ) : (
          <VueMois
            ancre={ancre}
            aujourdhui={aujourdhui}
            evenements={evenements}
            onJour={(cleJour) => {
              setVue('jour');
              setAncre(cleJour);
            }}
          />
        )}
      </div>
    </section>
  );
}

/** « 14:30 » → « 14h30 », « 13:00 » → « 13h ». */
function heureFr(hhmm: string | null): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':');
  const heure = String(Number(h));
  return m === '00' ? `${heure}h` : `${heure}h${m}`;
}

function EnteteAgenda({ email, total }: { email?: string | null; total?: number }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays
            size={16}
            strokeWidth={2.3}
            className="shrink-0 text-primary-600"
            aria-hidden
          />
          <h2 className="font-display text-balance text-[15px] font-bold text-text-strong">
            Mon emploi du temps
            {total ? (
              <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 align-middle text-[12px] font-bold text-primary-700">
                {total}
              </span>
            ) : null}
          </h2>
        </div>
        <a
          href="https://calendar.google.com/calendar/r/week"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[12px] font-semibold text-text-muted transition-colors hover:text-text-strong"
        >
          Ouvrir Google Agenda
        </a>
      </div>
      {email ? <p className="mt-1 truncate text-[11px] text-text-subtle">{email}</p> : null}
    </>
  );
}

function BarreVues({
  vue,
  libelle,
  onVue,
  onDecaler,
}: {
  vue: VueAgenda;
  libelle: string;
  onVue?: (vue: VueAgenda) => void;
  onDecaler?: (delta: number) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <div
        role="group"
        aria-label="Vue de l’agenda"
        className="flex rounded-clay bg-surface-2 p-1 shadow-clay-inset"
      >
        {VUES.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === vue}
            disabled={!onVue}
            onClick={() => onVue?.(v)}
            className={`rounded-[12px] px-2.5 py-1 text-[12px] font-semibold transition-colors duration-fluid-subtle ${
              v === vue
                ? 'bg-surface text-text-strong shadow-clay-sm'
                : 'text-text-muted hover:text-text-strong'
            }`}
          >
            {LIBELLE_VUE[v]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Période précédente"
          disabled={!onDecaler}
          onClick={() => onDecaler?.(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-clay bg-surface text-text-muted shadow-clay-sm transition hover:text-text-strong active:shadow-clay-pressed"
        >
          <ChevronLeft size={16} strokeWidth={2.2} aria-hidden />
        </button>
        <span className="min-w-[96px] text-center text-[12px] font-semibold text-text-strong">
          {libelle}
        </span>
        <button
          type="button"
          aria-label="Période suivante"
          disabled={!onDecaler}
          onClick={() => onDecaler?.(1)}
          className="flex h-8 w-8 items-center justify-center rounded-clay bg-surface text-text-muted shadow-clay-sm transition hover:text-text-strong active:shadow-clay-pressed"
        >
          <ChevronRight size={16} strokeWidth={2.2} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * Une tuile de rendez-vous. Au survol elle se déroule : le titre coupé
 * s'affiche en entier, la tuile pousse celles du dessous dans la colonne.
 */
function Creneau({ ev, large }: { ev: AgendaEvenement; large?: boolean }) {
  return (
    <div className="group/creneau relative min-w-0 rounded-[10px] bg-surface-2 px-2 py-1.5 shadow-clay-sm transition-shadow duration-fluid-subtle hover:shadow-clay">
      <p className="truncate text-[12px] font-bold tabular-nums text-primary-700 group-hover/creneau:whitespace-normal">
        {ev.journee ? 'Journée' : heureFr(ev.debut)}
        {!ev.journee && ev.fin ? (
          <span
            className={`ml-1 font-semibold text-text-subtle ${
              large ? '' : 'hidden group-hover/creneau:inline'
            }`}
          >
            → {heureFr(ev.fin)}
          </span>
        ) : null}
      </p>
      <p
        className={`text-[12px] leading-snug text-text-strong ${
          large ? 'text-pretty' : 'line-clamp-2 group-hover/creneau:line-clamp-none'
        }`}
      >
        {ev.titre}
      </p>
    </div>
  );
}

function VueJour({
  evenements,
  attente,
}: {
  evenements: readonly AgendaEvenement[];
  attente?: boolean;
}) {
  if (evenements.length === 0) {
    return attente ? (
      <div className="min-h-[76px]" />
    ) : (
      <p className="text-[13px] text-text-muted">Rien de prévu ce jour-là.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {evenements.map((ev) => (
        <li key={ev.id}>
          <Creneau ev={ev} large />
        </li>
      ))}
    </ul>
  );
}

function VueSemaine({
  ancre,
  aujourdhui,
  evenements,
  attente,
}: {
  ancre: string;
  aujourdhui: string;
  evenements: readonly AgendaEvenement[];
  attente?: boolean;
}) {
  const jours = joursDeLaSemaine(midiDe(ancre), aujourdhui);
  const parJour = grouperParJour(evenements);
  const joursOccupes = jours.filter((jour) => (parJour[jour.cle] ?? []).length > 0);

  return (
    <>
      <table className="hidden w-full table-fixed border-collapse sm:table">
        <caption className="sr-only">Emploi du temps de la semaine</caption>
        <thead>
          <tr>
            {jours.map((jour) => (
              <th key={jour.cle} scope="col" className="px-1 pb-2 align-middle">
                <span
                  className={
                    jour.aujourdhui
                      ? 'inline-block rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-bold text-white'
                      : 'inline-block px-2 py-0.5 text-[11px] font-semibold text-text-muted'
                  }
                >
                  {jour.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="align-top">
            {jours.map((jour) => (
              <td key={jour.cle} className="px-0.5">
                <div
                  className={`flex min-h-[76px] flex-col gap-1.5 p-1.5 ${
                    jour.aujourdhui ? 'rounded-clay bg-primary-50' : ''
                  }`}
                >
                  {(parJour[jour.cle] ?? []).map((ev) => (
                    <Creneau key={ev.id} ev={ev} />
                  ))}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="sm:hidden">
        {joursOccupes.length === 0 ? (
          attente ? (
            <div className="min-h-[76px]" />
          ) : (
            <p className="text-[13px] text-text-muted">Rien de prévu cette semaine.</p>
          )
        ) : (
          <ul className="flex flex-col gap-2.5">
            {joursOccupes.map((jour) => (
              <li key={jour.cle} className="flex gap-3">
                <span
                  className={
                    jour.aujourdhui
                      ? 'mt-0.5 h-fit shrink-0 rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-bold text-white'
                      : 'mt-0.5 h-fit shrink-0 px-2 py-0.5 text-[11px] font-semibold text-text-muted'
                  }
                >
                  {jour.label}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {(parJour[jour.cle] ?? []).map((ev) => (
                    <Creneau key={ev.id} ev={ev} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

const INITIALES_JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

function VueMois({
  ancre,
  aujourdhui,
  evenements,
  onJour,
}: {
  ancre: string;
  aujourdhui: string;
  evenements: readonly AgendaEvenement[];
  onJour: (cle: string) => void;
}) {
  const semaines = grilleMois(ancre, aujourdhui);
  const parJour = grouperParJour(evenements);

  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">Mois en cours, un bouton par jour</caption>
      <thead>
        <tr>
          {INITIALES_JOURS.map((initiale, i) => (
            <th
              key={`${initiale}-${i}`}
              scope="col"
              className="pb-1.5 text-center text-[11px] font-semibold text-text-subtle"
            >
              {initiale}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {semaines.map((semaine) => (
          <tr key={semaine[0]?.cle} className="align-top">
            {semaine.map((jour) => (
              <CaseJourMois
                key={jour.cle}
                jour={jour}
                evenements={parJour[jour.cle] ?? []}
                onJour={onJour}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CaseJourMois({
  jour,
  evenements,
  onJour,
}: {
  jour: CaseMois;
  evenements: readonly AgendaEvenement[];
  onJour: (cle: string) => void;
}) {
  const visibles = evenements.slice(0, 2);
  const reste = evenements.length - visibles.length;

  return (
    <td className="p-0.5">
      <button
        type="button"
        onClick={() => onJour(jour.cle)}
        aria-label={`${libelleVue('jour', jour.cle)}, ${evenements.length} rendez-vous`}
        className={`flex min-h-[54px] w-full flex-col gap-0.5 rounded-[10px] p-1 text-left transition-shadow duration-fluid-subtle hover:shadow-clay-sm ${
          jour.aujourdhui ? 'bg-primary-50' : ''
        } ${jour.horsMois ? 'opacity-40' : ''}`}
      >
        <span
          className={`text-[11px] font-bold tabular-nums ${
            jour.aujourdhui ? 'text-primary-700' : 'text-text-muted'
          }`}
        >
          {jour.numero}
        </span>

        <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
          {visibles.map((ev) => (
            <span
              key={ev.id}
              className="truncate rounded-[6px] bg-surface-2 px-1 text-[10px] font-bold tabular-nums text-primary-700 shadow-clay-sm"
            >
              {ev.journee ? 'Journée' : heureFr(ev.debut)}
            </span>
          ))}
          {reste > 0 ? (
            <span className="px-1 text-[10px] font-semibold text-text-subtle">+{reste}</span>
          ) : null}
        </span>

        <span className="flex gap-0.5 sm:hidden" aria-hidden>
          {evenements.slice(0, 3).map((ev) => (
            <span key={ev.id} className="size-1.5 rounded-full bg-primary-400" />
          ))}
        </span>
      </button>
    </td>
  );
}

/** Même carte, cases vides : le contenu arrive juste après. */
export function EmploiDuTempsSquelette() {
  const aujourdhui = dateKeyParis(new Date());
  return (
    <section className="flex h-full min-w-0 flex-col rounded-clay-lg bg-surface p-5 shadow-clay">
      <EnteteAgenda />
      <BarreVues vue="semaine" libelle={libelleVue('semaine', aujourdhui)} />
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-0.5">
        <VueSemaine ancre={aujourdhui} aujourdhui={aujourdhui} evenements={[]} attente />
      </div>
    </section>
  );
}

const GOOGLE = {
  ink: '#202124',
  line: '#dadce0',
  blue: '#1a73e8',
} as const;

function CarteConnexionGoogle({
  busy,
  onConnecter,
}: {
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
          <h2 className="text-[15px] font-medium" style={{ color: GOOGLE.ink }}>
            Google Agenda
          </h2>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onConnecter}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2.5 rounded-clay bg-white px-4 text-[14px] font-medium outline-offset-2 focus-visible:outline focus-visible:outline-2 disabled:opacity-60"
          style={{ color: GOOGLE.ink, border: `1px solid #747775`, outlineColor: GOOGLE.blue }}
        >
          <img src="/google.png" alt="" width={18} height={18} className="size-[18px]" />
          Choisir mon compte
        </button>
      </div>
    </section>
  );
}
