'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { BilanSemaine } from '@/lib/activite/bilan';
import ObjectifsDialog from './ObjectifsDialog';

/**
 * Violet de l'objectif, aux mêmes paliers que `COULEUR_FAMILLE` : voile pour
 * l'aplat, pastel appuyé derrière l'icône, pastille pour la piste, teinte
 * pleine pour la barre. Le violet ne recoupe ni les cinq familles, ni l'indigo
 * de marque, ni l'orange des leads.
 */
const OBJECTIF = {
  teinte: '#7C4DD3',
  pastelFort: '#DCCFF7',
  pastille: '#EBE3FA',
  voile: '#F5F1FD',
} as const;

const MANDAT = {
  pastelFort: '#D5EADF',
} as const;

/**
 * Une seule ligne, pas trois cartes : la progression de la période à gauche,
 * l'objectif mensuel de mandats à droite. Le mandat garde sa ligne propre
 * parce qu'il se pilote au mois, pas à la semaine.
 *
 * Même dessin que les compteurs juste en dessous : aplat voilé, icône posée
 * sur un carré pastel, piste plus claire que la barre.
 */
export default function BandeauObjectif({
  bilan,
  membre,
  membreNom = null,
  onObjectifsChanges,
}: {
  bilan: BilanSemaine;
  /** Le collaborateur dont on regarde — et règle — les objectifs. */
  membre: string;
  /** Renseigné seulement quand ce n'est pas soi : un directeur règle son équipe. */
  membreNom?: string | null;
  /** Les chiffres à l'écran sont périmés dès qu'un objectif change. */
  onObjectifsChanges?: () => void;
}) {
  const [reglage, setReglage] = useState(false);
  const { progressionHebdo, mandatsDuMois } = bilan;
  const pctMandats =
    mandatsDuMois.objectif > 0
      ? Math.min(100, Math.round((mandatsDuMois.valeur / mandatsDuMois.objectif) * 100))
      : 0;

  return (
    <section
      className="group/objectif flex flex-col gap-4 rounded-clay-lg px-5 py-4 shadow-clay-sm sm:flex-row sm:items-center sm:gap-8"
      style={{ backgroundColor: OBJECTIF.voile }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px] transition-transform duration-fluid ease-soft group-hover/objectif:scale-105 motion-reduce:transition-none"
          style={{ backgroundColor: OBJECTIF.pastelFort }}
        >
          {/* Les deux dessins superposés : fondu croisé, sans saut de mise en page. */}
          <img
            src="/cibles.png"
            alt=""
            width={36}
            height={36}
            className="absolute inset-0 m-auto size-9 transition-[opacity,transform] duration-fluid ease-soft group-hover/objectif:scale-110 group-hover/objectif:opacity-0 motion-reduce:transition-none"
          />
          <img
            src="/cibles-contour.png"
            alt=""
            width={36}
            height={36}
            className="absolute inset-0 m-auto size-9 opacity-0 transition-[opacity,transform] duration-fluid ease-soft group-hover/objectif:scale-110 group-hover/objectif:opacity-100 motion-reduce:transition-none"
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-semibold text-text-muted">Objectif de la période</p>
            <p
              className="font-display text-[17px] font-bold"
              style={{ color: OBJECTIF.teinte }}
            >
              {progressionHebdo} %
            </p>
          </div>
          <div
            // Piste un cran plus foncée que l'aplat, sinon la barre flotte sur
            // un fond qu'on ne distingue plus.
            className="mt-2 h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: OBJECTIF.pastille }}
            role="progressbar"
            aria-valuenow={progressionHebdo}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progression de la période : ${progressionHebdo} %`}
          >
            <span
              className="block h-full rounded-full transition-[width] duration-fluid"
              style={{ width: `${progressionHebdo}%`, backgroundColor: OBJECTIF.teinte }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px] transition-transform duration-fluid ease-soft group-hover/objectif:scale-105 motion-reduce:transition-none"
          style={{ backgroundColor: MANDAT.pastelFort }}
        >
          <img
            src="/validation.png"
            alt=""
            width={36}
            height={36}
            className="absolute inset-0 m-auto size-9 transition-[opacity,transform] duration-fluid ease-soft group-hover/objectif:scale-110 group-hover/objectif:opacity-0 motion-reduce:transition-none"
          />
          <img
            src="/validation-contour.png"
            alt=""
            width={36}
            height={36}
            className="absolute inset-0 m-auto size-9 opacity-0 transition-[opacity,transform] duration-fluid ease-soft group-hover/objectif:scale-110 group-hover/objectif:opacity-100 motion-reduce:transition-none"
          />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-text-muted">Mandats ce mois</p>
          <p className="font-display text-[17px] font-bold leading-tight text-text-strong">
            {mandatsDuMois.valeur}
            <span className="text-[13px] font-medium text-text-subtle">
              {' '}
              / {mandatsDuMois.objectif}
            </span>
            <span className="sr-only"> — {pctMandats} % de l’objectif mensuel</span>
          </p>
        </div>
      </div>

      {/* Le réglage ne s'impose pas : il se découvre au survol de la carte, ou
          au clavier. Sur mobile il n'y a pas de survol, donc il reste posé. */}
      <button
        type="button"
        onClick={() => setReglage(true)}
        className="inline-flex shrink-0 translate-y-1 items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[12px] font-semibold text-text-strong opacity-0 shadow-clay-sm transition-[opacity,transform] duration-fluid ease-soft pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 group-hover/objectif:pointer-events-auto group-hover/objectif:translate-y-0 group-hover/objectif:opacity-100 group-focus-within/objectif:pointer-events-auto group-focus-within/objectif:translate-y-0 group-focus-within/objectif:opacity-100 motion-reduce:transition-none sm:self-center [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100"
        style={{ backgroundColor: OBJECTIF.pastelFort }}
      >
        <SlidersHorizontal size={13} strokeWidth={2.4} aria-hidden />
        Modifier les objectifs
      </button>

      {reglage ? (
        <ObjectifsDialog
          initial={bilan.objectifsPoses}
          membre={membre}
          membreNom={membreNom}
          onClose={() => setReglage(false)}
          onEnregistre={() => onObjectifsChanges?.()}
        />
      ) : null}
    </section>
  );
}
