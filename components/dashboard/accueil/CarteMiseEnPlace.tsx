'use client';

import { useState } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { tachesMiseEnPlace, type TacheMiseEnPlace } from '@/lib/accueil/mise-en-place';
import { ouvrirAtelierSecteur } from '@/lib/zones/atelier-event';
import { BOUTON_CARTE_VIDE } from './CarteVideAccueil';

const LIGNES: Record<
  TacheMiseEnPlace,
  { titre: string; detail: string; cta: string; Icon: typeof CalendarDays }
> = {
  agenda: {
    titre: 'Connecter mon agenda',
    detail: 'Mes rendez-vous de la semaine, à côté de mes adresses.',
    cta: 'Connecter',
    Icon: CalendarDays,
  },
  secteur: {
    titre: 'Faire mon secteur',
    detail: 'Le contour de mes tournées, une fois pour toutes.',
    cta: 'Faire mon secteur',
    Icon: MapPin,
  },
};

/**
 * En haut de Ma semaine : seulement ce qui manque encore — l’agenda Google
 * et/ou le secteur. Disparaît dès que les deux sont faits.
 */
export default function CarteMiseEnPlace({
  agendaConnecte,
  aUnSecteur,
}: {
  agendaConnecte: boolean;
  aUnSecteur: boolean;
}) {
  const taches = tachesMiseEnPlace({ agendaConnecte, aUnSecteur });
  const [busy, setBusy] = useState(false);

  if (taches.length === 0) return null;

  async function connecterAgenda() {
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

  return (
    <section
      aria-labelledby="accueil-mise-en-place"
      className="rounded-clay-lg bg-surface p-5 shadow-clay"
    >
      <h2 id="accueil-mise-en-place" className="font-semibold text-ink" style={{ fontSize: 16 }}>
        Ce qu’il reste à faire
      </h2>
      <p className="mt-1 text-pretty text-[13.5px] leading-relaxed text-text-muted">
        L’agenda pour mes rendez-vous. Le secteur pour mes tournées.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {taches.map((tache) => {
          const ligne = LIGNES[tache];
          const Icon = ligne.Icon;
          return (
            <li
              key={tache}
              className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-ink"
                  aria-hidden
                >
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink">{ligne.titre}</p>
                  <p className="mt-0.5 text-pretty text-[12.5px] leading-snug text-text-muted">
                    {ligne.detail}
                  </p>
                </div>
              </div>
              {tache === 'agenda' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connecterAgenda()}
                  className={`${BOUTON_CARTE_VIDE} shrink-0`}
                >
                  {busy ? 'Ouverture…' : ligne.cta}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={ouvrirAtelierSecteur}
                  className={`${BOUTON_CARTE_VIDE} shrink-0`}
                >
                  {ligne.cta}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
