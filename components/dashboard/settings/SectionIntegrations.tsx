'use client';

import { CalendarDays, Megaphone } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';

const PILULE_A_VENIR =
  'inline-flex cursor-default items-center rounded-full bg-black/[0.08] px-3 py-1.5 text-[12.5px] font-semibold text-text-muted';

/**
 * Connexions portails. Google Agenda n’est pas encore disponible :
 * on le montre grisé, sans bouton de configuration.
 */
export default function SectionIntegrations() {
  const { isDirector } = useUser();

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

        <div
          aria-disabled="true"
          className="rounded-clay border border-black/[0.06] bg-black/[0.03] p-4"
        >
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 size-5 text-text-muted" strokeWidth={2} aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-text-muted" style={{ fontSize: 15 }}>
                Google Agenda
              </h3>
              <p className="mt-1 text-[13px] text-text-muted">
                Mes rendez-vous sur l’accueil. Pas encore disponible, donc pas configurable.
              </p>
              <span className={`mt-3 ${PILULE_A_VENIR}`}>À venir</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
