'use client';

import { MapPin } from 'lucide-react';
import { tachesMiseEnPlace } from '@/lib/accueil/mise-en-place';
import { ouvrirAtelierSecteur } from '@/lib/zones/atelier-event';
import { BOUTON_CARTE_VIDE } from './CarteVideAccueil';

/**
 * En haut de Ma semaine : seulement le secteur, tant qu’il n’est pas dessiné.
 * L’agenda n’est pas encore disponible : il n’est pas proposé ici.
 */
export default function CarteMiseEnPlace({ aUnSecteur }: { aUnSecteur: boolean }) {
  const taches = tachesMiseEnPlace({ aUnSecteur });

  if (taches.length === 0) return null;

  return (
    <section
      aria-labelledby="accueil-mise-en-place"
      className="rounded-clay-lg bg-surface p-5 shadow-clay"
    >
      <h2 id="accueil-mise-en-place" className="font-semibold text-ink" style={{ fontSize: 16 }}>
        Ce qu’il reste à faire
      </h2>
      <p className="mt-1 text-pretty text-[13.5px] leading-relaxed text-text-muted">
        Les rues que je travaille : mon secteur de prospection.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {taches.map((tache) =>
          tache === 'secteur' ? (
            <li
              key={tache}
              className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-ink"
                  aria-hidden
                >
                  <MapPin size={16} strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink">Créer mon secteur</p>
                  <p className="mt-0.5 text-pretty text-[12.5px] leading-snug text-text-muted">
                    J’en définis un, ou plusieurs.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={ouvrirAtelierSecteur}
                className={`${BOUTON_CARTE_VIDE} shrink-0`}
              >
                Créer mon secteur
              </button>
            </li>
          ) : null,
        )}
      </ul>
    </section>
  );
}
