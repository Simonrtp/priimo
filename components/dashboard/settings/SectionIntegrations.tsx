'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ExternalLink, Link2Off, Mail, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';

type GmailStatus = {
  connected: boolean;
  gmailAddress?: string;
  etat?: string;
  dernierErreur?: string | null;
};

type CalendarStatus = {
  connected: boolean;
  calendarEmail?: string;
  emailPro?: string;
  etat?: string;
  dernierErreur?: string | null;
};

/**
 * Connexions portails + Gmail.
 * Rappelle clairement que les abonnements portails restent à la charge de l'agence.
 */
export default function SectionIntegrations() {
  const { isDirector } = useUser();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [agenda, setAgenda] = useState<CalendarStatus | null>(null);

  async function loadStatus() {
    try {
      const [gmailRes, calRes] = await Promise.all([
        fetch('/api/dashboard/integrations/gmail/status'),
        fetch('/api/dashboard/integrations/calendar/status'),
      ]);
      if (gmailRes.ok) setGmail((await gmailRes.json()) as GmailStatus);
      if (calRes.ok) setAgenda((await calRes.json()) as CalendarStatus);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadStatus();
    const params = new URLSearchParams(window.location.search);
    const gmailFlag = params.get('gmail');
    const agendaFlag = params.get('agenda');
    if (gmailFlag === 'connected') toast.success('Gmail connecté');
    else if (gmailFlag === 'watch_error') {
      toast.success('Gmail connecté — watch Pub/Sub à finaliser');
    } else if (gmailFlag === 'denied') toast.error('Connexion Gmail refusée');
    else if (gmailFlag === 'error' || gmailFlag === 'invalid_state') {
      toast.error('Connexion Gmail impossible');
    }
    if (agendaFlag === 'connected') toast.success('Google Agenda connecté');
    else if (agendaFlag === 'denied') toast.error('Connexion Agenda refusée');
    else if (agendaFlag === 'error' || agendaFlag === 'invalid_state') {
      toast.error('Connexion Agenda impossible');
    }
    if (!gmailFlag && !agendaFlag) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('gmail');
    url.searchParams.delete('agenda');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, []);

  async function connectGmail() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/dashboard/integrations/gmail/start');
      const data = (await res.json()) as { url?: string; note?: string; error?: string };
      if (data.note) setNote(data.note);
      if (!res.ok || !data.url) {
        toast.error(data.error ?? 'OAuth Gmail indisponible');
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error('Impossible de démarrer la connexion Gmail');
    } finally {
      setBusy(false);
    }
  }

  async function connectAgenda() {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/integrations/calendar/start?next=settings');
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? 'OAuth Agenda indisponible');
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error('Impossible de démarrer la connexion Agenda');
    } finally {
      setBusy(false);
    }
  }

  async function disconnectAgenda() {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/integrations/calendar/disconnect', {
        method: 'POST',
      });
      if (!res.ok) {
        toast.error('Déconnexion impossible');
        return;
      }
      toast.success('Google Agenda déconnecté');
      setAgenda({ connected: false });
    } catch {
      toast.error('Déconnexion impossible');
    } finally {
      setBusy(false);
    }
  }

  async function disconnectGmail() {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/integrations/gmail/disconnect', {
        method: 'POST',
      });
      if (!res.ok) {
        toast.error('Déconnexion impossible');
        return;
      }
      toast.success('Gmail déconnecté (jeton révoqué chez Google)');
      setGmail({ connected: false });
    } catch {
      toast.error('Déconnexion impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-2 hidden font-semibold text-ink md:block" style={{ fontSize: 18 }}>
        Connexions
      </h2>
      <p className="mb-5 max-w-2xl text-pretty text-mute" style={{ fontSize: 14 }}>
        Diffusez nos mandats et récupérez les demandes portail. Priimo ne paie ni ne revend les
        abonnements SeLoger Pro, Bien&apos;ici Pro ou Logic-Immo : ils restent facturés directement
        à l&apos;agence (hors des 199&nbsp;€).
      </p>

      <div className="flex max-w-2xl flex-col gap-4">
        {isDirector ? (
          <div className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
            <div className="flex items-start gap-3">
              <Megaphone className="mt-0.5 size-5 text-text-subtle" strokeWidth={2} aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-text-strong" style={{ fontSize: 15 }}>
                  Portails (via passerelle)
                </h3>
                <p className="mt-1 text-[13px] text-text-muted">
                  Une seule intégration technique (Ubiflow ou Diffuze) traduit nos annonces. Activez
                  chaque portail une fois le compte Pro ouvert chez l&apos;éditeur — facturation
                  séparée, hors abonnement Priimo.
                </p>
                <p className="mt-2 text-[12.5px] text-text-subtle">
                  Configuration passerelle côté serveur (variables UBIFLOW_* / DIFFUZE_*). État des
                  connexions : table diffusion_portails.
                </p>
                <a
                  href="/dashboard/statistiques/origines"
                  className="mt-3 inline-flex text-[13px] font-medium text-ink underline underline-offset-2"
                >
                  Voir les statistiques par origine
                </a>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-5 text-text-subtle" strokeWidth={2} aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-text-strong" style={{ fontSize: 15 }}>
                Gmail — demandes entrantes
              </h3>
              <p className="mt-1 text-[13px] text-text-muted">
                Lecture seule (gmail.readonly), notifications push. Seuls les emails des domaines
                portail en liste blanche sont ouverts — jamais le reste de la boîte.
              </p>
              {note ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                  {note}
                </p>
              ) : null}
              {gmail?.connected ? (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-[13px] text-text">
                    Connecté :{' '}
                    <span className="font-medium tabular-nums">{gmail.gmailAddress}</span>
                    {gmail.etat && gmail.etat !== 'actif' ? (
                      <span className="text-text-muted"> ({gmail.etat})</span>
                    ) : null}
                  </p>
                  {gmail.dernierErreur ? (
                    <p className="text-[12.5px] text-amber-800">{gmail.dernierErreur}</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void disconnectGmail()}
                    className="inline-flex w-fit items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-soft-gray/40 disabled:opacity-60"
                  >
                    <Link2Off size={14} strokeWidth={2} aria-hidden />
                    {busy ? 'Déconnexion…' : 'Déconnecter (révoquer chez Google)'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connectGmail()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-soft-gray/40 disabled:opacity-60"
                >
                  <ExternalLink size={14} strokeWidth={2} aria-hidden />
                  {busy ? 'Redirection…' : 'Connecter Gmail'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 size-5 text-text-subtle" strokeWidth={2} aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-text-strong" style={{ fontSize: 15 }}>
                Google Agenda — mon emploi du temps
              </h3>
              <p className="mt-1 text-[13px] text-text-muted">
                Lecture seule. Google propose mes comptes : je choisis l’agenda à afficher
                sur l’accueil.
              </p>
              {agenda?.connected ? (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-[13px] text-text">
                    Connecté :{' '}
                    <span className="font-medium tabular-nums">{agenda.calendarEmail}</span>
                    {agenda.etat && agenda.etat !== 'actif' ? (
                      <span className="text-text-muted"> ({agenda.etat})</span>
                    ) : null}
                  </p>
                  {agenda.dernierErreur ? (
                    <p className="text-[12.5px] text-amber-800">{agenda.dernierErreur}</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void disconnectAgenda()}
                    className="inline-flex w-fit items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-soft-gray/40 disabled:opacity-60"
                  >
                    <Link2Off size={14} strokeWidth={2} aria-hidden />
                    {busy ? 'Déconnexion…' : 'Déconnecter Google Agenda'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connectAgenda()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-soft-gray/40 disabled:opacity-60"
                >
                  <ExternalLink size={14} strokeWidth={2} aria-hidden />
                  {busy ? 'Redirection…' : 'Connecter mon Google Agenda'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
