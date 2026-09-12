'use client';

import CurseurCritere from './CurseurCritere';
import RadarQualite from './RadarQualite';
import {
  CRITERES_GRILLE,
  CRITERES_TOTAL,
  FAMILLES_GRILLE,
  axesRadar,
  criteresRenseignes,
  lireCritere,
  type GrilleSaisie,
} from '@/lib/estimation/grille';
import type { AxeRadar } from '@/lib/estimation/grille';

export default function OngletCaracteristiques({
  grille,
  radarSecteur,
  onChange,
}: {
  grille: GrilleSaisie;
  radarSecteur: AxeRadar[];
  onChange: (grille: GrilleSaisie) => void;
}) {
  const n = criteresRenseignes(grille);
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13.5px] font-semibold tabular-nums text-text-strong">
        {n} / {CRITERES_TOTAL}
      </p>
      <p className="text-[12px] text-text-muted">
        1 Mauvais · 2 Médiocre · 3 Moyen · 4 Bon · 5 Très bon
      </p>
      <RadarQualite bien={axesRadar(grille)} secteur={radarSecteur} />
      {FAMILLES_GRILLE.map((famille) => (
        <section key={famille.id} className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
          <h3 className="mb-3 text-[14px] font-semibold text-text-strong">{famille.libelle}</h3>
          <ul className="flex flex-col gap-3">
            {CRITERES_GRILLE.filter((c) => c.famille === famille.id).map((c) => {
              const row = lireCritere(grille, c.id);
              return (
                <li key={c.id}>
                  <CurseurCritere
                    id={c.id}
                    libelle={c.libelle}
                    valeur={row.valeur}
                    onChange={(valeur) =>
                      onChange({
                        ...grille,
                        [c.id]: { valeur, source: 'agent' },
                      })
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
